"""Keyword search over course structure/content + semantic search over chunks."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Chapter, Chunk, Course, Document, Lesson, Topic, User
from app.schemas.search import SearchResponse, SearchResult
from app.services.embeddings import embed_query
from app.services.security import get_current_user
from app.services.vectorstore import top_k_chunks

router = APIRouter(tags=["search"])

MAX_RESULTS = 20


def _snippet(text: str, needle: str, radius: int = 80) -> str:
    lower = text.lower()
    pos = lower.find(needle.lower())
    if pos == -1:
        return text[: radius * 2].strip()
    start = max(0, pos - radius)
    end = min(len(text), pos + len(needle) + radius)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(min_length=2, max_length=200),
    course_id: int | None = None,
    mode: str = Query("keyword", pattern="^(keyword|semantic)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    course_stmt = select(Course.id, Course.title).where(Course.user_id == current_user.id)
    if course_id is not None:
        course_stmt = course_stmt.where(Course.id == course_id)
    course_rows = (await db.execute(course_stmt)).all()
    course_titles = {row.id: row.title for row in course_rows}
    course_ids = list(course_titles.keys())
    if not course_ids:
        return SearchResponse(query=q, mode=mode, results=[])

    if mode == "semantic":
        results = await _semantic_search(db, q, course_ids, course_titles)
    else:
        results = await _keyword_search(db, q, course_ids, course_titles)
    return SearchResponse(query=q, mode=mode, results=results[:MAX_RESULTS])


async def _keyword_search(
    db: AsyncSession, q: str, course_ids: list[int], course_titles: dict[int, str]
) -> list[SearchResult]:
    pattern = f"%{q.lower()}%"
    results: list[SearchResult] = []

    for cid, title in course_titles.items():
        if q.lower() in title.lower():
            results.append(
                SearchResult(
                    type="course", id=cid, title=title, snippet=_snippet(title, q),
                    course_id=cid, course_title=title,
                )
            )

    chapters = (
        await db.execute(
            select(Chapter).where(
                Chapter.course_id.in_(course_ids),
                or_(func.lower(Chapter.title).like(pattern), func.lower(Chapter.summary).like(pattern)),
            )
        )
    ).scalars().all()
    for ch in chapters:
        results.append(
            SearchResult(
                type="chapter", id=ch.id, title=ch.title,
                snippet=_snippet(ch.summary or ch.title, q),
                course_id=ch.course_id, course_title=course_titles[ch.course_id], chapter_id=ch.id,
            )
        )

    topic_rows = (
        await db.execute(
            select(Topic, Chapter.course_id, Lesson.id.label("first_lesson_id"))
            .join(Chapter, Topic.chapter_id == Chapter.id)
            .outerjoin(Lesson, Lesson.topic_id == Topic.id)
            .where(Chapter.course_id.in_(course_ids), func.lower(Topic.title).like(pattern))
        )
    ).all()
    seen_topics: set[int] = set()
    for topic, cid, first_lesson_id in topic_rows:
        if topic.id in seen_topics:
            continue
        seen_topics.add(topic.id)
        results.append(
            SearchResult(
                type="topic", id=topic.id, title=topic.title, snippet=_snippet(topic.title, q),
                course_id=cid, course_title=course_titles[cid],
                chapter_id=topic.chapter_id, lesson_id=first_lesson_id,
            )
        )

    lesson_rows = (
        await db.execute(
            select(Lesson, Chapter.course_id, Chapter.id.label("chapter_id"))
            .join(Topic, Lesson.topic_id == Topic.id)
            .join(Chapter, Topic.chapter_id == Chapter.id)
            .where(
                Chapter.course_id.in_(course_ids),
                or_(
                    func.lower(Lesson.title).like(pattern),
                    func.lower(cast(Lesson.content, String)).like(pattern),
                ),
            )
        )
    ).all()
    for lesson, cid, chapter_id_ in lesson_rows:
        body = ""
        if lesson.content:
            body = " ".join(
                f"{s.get('heading', '')} {s.get('body', '')}" for s in lesson.content.get("sections", [])
            )
        results.append(
            SearchResult(
                type="lesson", id=lesson.id, title=lesson.title,
                snippet=_snippet(body or lesson.title, q),
                course_id=cid, course_title=course_titles[cid],
                lesson_id=lesson.id, chapter_id=chapter_id_,
            )
        )
    return results


async def _semantic_search(
    db: AsyncSession, q: str, course_ids: list[int], course_titles: dict[int, str]
) -> list[SearchResult]:
    doc_rows = (
        await db.execute(
            select(Course.id, Course.document_id).where(Course.id.in_(course_ids))
        )
    ).all()
    doc_to_course = {row.document_id: row.id for row in doc_rows}
    if not doc_to_course:
        return []

    query_vec = await embed_query(q)
    hits = await top_k_chunks(db, query_vec, document_ids=list(doc_to_course.keys()), k=MAX_RESULTS)
    results: list[SearchResult] = []
    for chunk, score in hits:
        cid = doc_to_course.get(chunk.document_id)
        if cid is None:
            continue
        results.append(
            SearchResult(
                type="passage", id=chunk.id,
                title=f"Pages {chunk.page_start}-{chunk.page_end}",
                snippet=chunk.text[:220].strip() + ("…" if len(chunk.text) > 220 else ""),
                course_id=cid, course_title=course_titles[cid], score=round(score, 4),
            )
        )
    return results
