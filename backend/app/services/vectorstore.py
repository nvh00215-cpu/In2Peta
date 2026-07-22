"""Dialect-agnostic vector search over document chunks.

Postgres: pgvector cosine-distance query executed in the database.
SQLite: embeddings are stored as JSON; cosine similarity is computed in Python
with numpy (documents are capped at 300 pages, so this stays fast).
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import numpy as np

from app.config import settings
from app.models import Chunk
from app.services.embeddings import cosine_similarity


async def top_k_chunks(
    db: AsyncSession,
    query_embedding: list[float],
    *,
    document_ids: list[int],
    k: int = 5,
    page_range: tuple[int, int] | None = None,
) -> list[tuple[Chunk, float]]:
    """Return the k most similar chunks (with similarity scores) within the given documents."""
    if not document_ids:
        return []

    if settings.is_postgres:
        from pgvector.sqlalchemy import Vector  # noqa: F401  (registers the type)

        distance = Chunk.embedding.cast(Vector(settings.embedding_dim)).cosine_distance(query_embedding)
        stmt = (
            select(Chunk, distance.label("distance"))
            .where(Chunk.document_id.in_(document_ids), Chunk.embedding.is_not(None))
        )
        if page_range:
            stmt = stmt.where(Chunk.page_end >= page_range[0], Chunk.page_start <= page_range[1])
        stmt = stmt.order_by(distance).limit(k)
        rows = (await db.execute(stmt)).all()
        return [(chunk, 1.0 - float(dist)) for chunk, dist in rows]

    stmt = select(Chunk).where(Chunk.document_id.in_(document_ids), Chunk.embedding.is_not(None))
    if page_range:
        stmt = stmt.where(Chunk.page_end >= page_range[0], Chunk.page_start <= page_range[1])
    chunks = (await db.execute(stmt)).scalars().all()
    if not chunks:
        return []
    q = np.asarray(query_embedding)
    scored = [(chunk, cosine_similarity(chunk.embedding, q.tolist())) for chunk in chunks]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:k]
