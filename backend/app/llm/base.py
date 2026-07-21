"""LLM provider abstraction.

`complete()` returns the full response text; `stream()` yields token deltas.
The optional `task` hint ("summarize" | "outline" | "lesson" | "quiz" | "chat")
lets the mock provider return realistic, schema-valid canned output. Real
providers ignore it.
"""
import asyncio
import json
import logging
import random
from abc import ABC, abstractmethod
from typing import AsyncIterator

import httpx

logger = logging.getLogger(__name__)

RETRYABLE_STATUS = {429, 500, 502, 503, 504}
MAX_RETRIES = 8


class LLMError(Exception):
    pass


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def complete(
        self,
        messages: list[dict],
        *,
        task: str = "generic",
        temperature: float = 0.3,
        max_tokens: int = 4096,
        json_mode: bool = False,
        model: str | None = None,
    ) -> str: ...

    @abstractmethod
    def stream(
        self,
        messages: list[dict],
        *,
        task: str = "chat",
        temperature: float = 0.5,
        max_tokens: int = 2048,
    ) -> AsyncIterator[str]: ...


class OpenAICompatProvider(LLMProvider):
    """Shared implementation for OpenAI-compatible chat-completions APIs (Groq, OpenRouter)."""

    base_url: str
    api_key: str
    model: str
    extra_headers: dict = {}

    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise LLMError(
                f"{self.name} selected but its API key is not configured. "
                "Set the key in .env or use MOCK_LLM=true for a keyless demo."
            )
        self.api_key = api_key
        self.model = model

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}", **self.extra_headers}

    async def complete(
        self,
        messages,
        *,
        task="generic",
        temperature=0.3,
        max_tokens=4096,
        json_mode=False,
        model: str | None = None,
    ) -> str:
        use_model = model or self.model
        payload: dict = {
            "model": use_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        last_error: Exception | None = None
        async with httpx.AsyncClient(timeout=120) as client:
            for attempt in range(MAX_RETRIES):
                try:
                    logger.info(
                        "%s complete task=%s model=%s attempt=%s",
                        self.name,
                        task,
                        use_model,
                        attempt + 1,
                    )
                    resp = await client.post(
                        f"{self.base_url}/chat/completions", json=payload, headers=self._headers()
                    )
                    if resp.status_code in RETRYABLE_STATUS:
                        retry_after = resp.headers.get("retry-after")
                        if retry_after and retry_after.isdigit():
                            delay = float(retry_after) + random.uniform(0, 1)
                        elif resp.status_code == 429:
                            # Groq free-tier RPM/TPM: longer exponential backoff
                            delay = min(90.0, (15 * (2**attempt)) + random.uniform(0, 2))
                        else:
                            delay = (2**attempt) + random.uniform(0, 1)
                        body_preview = (resp.text or "")[:300]
                        last_error = LLMError(
                            f"{self.name} HTTP {resp.status_code}: {body_preview}"
                        )
                        logger.warning(
                            "%s returned %s (attempt %s/%s), backing off %.1fs — %s",
                            self.name,
                            resp.status_code,
                            attempt + 1,
                            MAX_RETRIES,
                            delay,
                            body_preview,
                        )
                        await asyncio.sleep(delay)
                        continue
                    resp.raise_for_status()
                    return resp.json()["choices"][0]["message"]["content"]
                except httpx.HTTPError as exc:
                    last_error = exc
                    await asyncio.sleep((2**attempt) + random.uniform(0, 1))
        raise LLMError(f"{self.name} request failed after {MAX_RETRIES} attempts: {last_error}")

    async def stream(self, messages, *, task="chat", temperature=0.5, max_tokens=2048) -> AsyncIterator[str]:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", f"{self.base_url}/chat/completions", json=payload, headers=self._headers()
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise LLMError(f"{self.name} stream failed ({resp.status_code}): {body[:300]!r}")
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        break
                    try:
                        delta = json.loads(data)["choices"][0]["delta"].get("content")
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
                    if delta:
                        yield delta
