"""Embeddings via the Google Gemini API (or deterministic mocks).

Public API is unchanged: `embed_texts` / `embed_query` / `cosine_similarity`.
Real calls hit `generativelanguage.googleapis.com` with `GEMINI_API_KEY`.
`MOCK_EMBEDDINGS=true` keeps offline demos working without a key.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import math

import httpx
import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

_BATCH_SIZE = 32
_EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:batchEmbedContents"
)


def _mock_embedding(text: str) -> list[float]:
    seed = int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:8], "big")
    rng = np.random.default_rng(seed)
    vec = rng.standard_normal(settings.embedding_dim)
    vec /= np.linalg.norm(vec) or 1.0
    return vec.tolist()


def _l2_normalize(values: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


def _require_api_key() -> str:
    key = (settings.gemini_api_key or "").strip()
    if not key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to backend/.env to use Google embeddings "
            "(same key works for Gemini chat later). Or set MOCK_EMBEDDINGS=true for demos."
        )
    return key


async def _embed_batch(texts: list[str], *, task_type: str) -> list[list[float]]:
    """Embed one batch via Gemini batchEmbedContents."""
    key = _require_api_key()
    model = settings.embedding_model
    url = _EMBED_URL.format(model=model)
    payload = {
        "requests": [
            {
                "model": f"models/{model}",
                "content": {"parts": [{"text": text}]},
                "taskType": task_type,
                "outputDimensionality": settings.embedding_dim,
            }
            for text in texts
        ]
    }
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
    }

    delay = 1.0
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 429 and attempt < 3:
                retry_after = resp.headers.get("retry-after")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else delay
                logger.warning("Gemini embeddings 429; retrying in %.1fs", wait)
                await asyncio.sleep(wait)
                delay = min(delay * 2, 30)
                continue
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"Gemini embeddings HTTP {resp.status_code}: {resp.text[:800]}"
                )
            data = resp.json()
            embeddings = data.get("embeddings") or []
            if len(embeddings) != len(texts):
                raise RuntimeError(
                    f"Gemini embeddings count mismatch: got {len(embeddings)}, "
                    f"expected {len(texts)}"
                )
            out: list[list[float]] = []
            for item in embeddings:
                values = item.get("values")
                if not values:
                    raise RuntimeError("Gemini embedding response missing values")
                # gemini-embedding-001 needs manual normalize when truncated;
                # normalizing always is safe for cosine search.
                out.append(_l2_normalize([float(v) for v in values]))
            return out
        except httpx.HTTPError as exc:
            last_error = exc
            if attempt < 3:
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            raise RuntimeError(f"Gemini embeddings request failed: {exc}") from exc
    raise RuntimeError(f"Gemini embeddings failed after retries: {last_error}")


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if settings.mock_embeddings:
        return [_mock_embedding(t) for t in texts]

    results: list[list[float]] = []
    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]
        results.extend(await _embed_batch(batch, task_type="RETRIEVAL_DOCUMENT"))
    return results


async def embed_query(text: str) -> list[float]:
    if settings.mock_embeddings:
        return _mock_embedding(text)
    vectors = await _embed_batch([text], task_type="RETRIEVAL_QUERY")
    return vectors[0]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va, vb = np.asarray(a), np.asarray(b)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(va @ vb / denom) if denom else 0.0
