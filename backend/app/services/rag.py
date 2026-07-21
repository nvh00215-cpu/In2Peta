"""RAG context assembly for the AI tutor chat."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Chapter, ChatMessage, Course, Topic
from app.prompts import chat as chat_prompt
from app.services.embeddings import embed_query
from app.services.progress import completed_lesson_ids, course_lesson_ids_in_order
from app.services.vectorstore import top_k_chunks

HISTORY_LIMIT = 10
TOP_K = 5


async def _course_toc(db: AsyncSession, course_id: int) -> tuple[str, dict[int, str]]:
    """Returns (toc markdown, {lesson_id: 'Chapter > Topic > Lesson'})."""
    chapters = (
        (
            await db.execute(
                select(Chapter)
                .where(Chapter.course_id == course_id)
                .order_by(Chapter.position)
                .options(selectinload(Chapter.topics).selectinload(Topic.lessons))
            )
        )
        .scalars()
        .all()
    )
    lines: list[str] = []
    lesson_paths: dict[int, str] = {}
    for chapter in chapters:
        lines.append(f"Chapter {chapter.position}: {chapter.title}")
        for topic in chapter.topics:
            lines.append(f"  - {topic.title}")
            for lesson in topic.lessons:
                lines.append(f"      * {lesson.title}")
                lesson_paths[lesson.id] = f"{chapter.title} > {topic.title} > {lesson.title}"
    return "\n".join(lines), lesson_paths


async def build_chat_messages(
    db: AsyncSession,
    *,
    course: Course,
    user_id: int,
    session_id: int,
    user_message: str,
) -> list[dict]:
    toc, lesson_paths = await _course_toc(db, course.id)

    # Learner progress summary (used for "what should I learn next?")
    ordered = await course_lesson_ids_in_order(db, course.id)
    done = await completed_lesson_ids(db, user_id, ordered)
    next_lesson_id = next((lid for lid in ordered if lid not in done), None)
    progress_summary = f"{len(done)} of {len(ordered)} lessons completed."
    if next_lesson_id is not None:
        progress_summary += f" Next uncompleted lesson: {lesson_paths.get(next_lesson_id, 'n/a')}."
    else:
        progress_summary += " All lessons completed — recommend chapter quizzes or review."

    # Retrieve relevant source passages for the current question.
    query_vec = await embed_query(user_message)
    hits = await top_k_chunks(db, query_vec, document_ids=[course.document_id], k=TOP_K)
    passages = "\n\n---\n\n".join(f"[pages {c.page_start}-{c.page_end}]\n{c.text}" for c, _ in hits)

    system = chat_prompt.build_system(course.title, toc, progress_summary, passages)

    history_rows = (
        (
            await db.execute(
                select(ChatMessage)
                .where(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.id.desc())
                .limit(HISTORY_LIMIT)
            )
        )
        .scalars()
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in reversed(history_rows)]

    return [system, *history, {"role": "user", "content": user_message}]
