"""Database engine, session factory and cross-dialect helper types.

The app runs against SQLite (local dev) or Postgres+pgvector (production).
`EmbeddingVector` transparently stores embeddings as a pgvector column on
Postgres and as a JSON-encoded TEXT column on SQLite.
"""
import json
from typing import AsyncGenerator

from pgvector.sqlalchemy import Vector
from sqlalchemy import types
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class EmbeddingVector(types.TypeDecorator):
    """384-dim embedding: pgvector `vector` on Postgres, JSON text on SQLite."""

    impl = types.Text
    cache_ok = True
    comparator_factory = Vector.Comparator

    def __init__(self, dim: int = 384):
        super().__init__()
        self.dim = dim

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(types.Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        return json.dumps([round(float(x), 7) for x in value])

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return list(value)
        return json.loads(value)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session