"""The three-stage AI course-generation pipeline.

Stage 0 (ingest):   PDF text -> overlapping chunks with page ranges -> embeddings -> DB.
Stage 1 (outline):  map-reduce — summarize ~8k-token blocks into dense notes, then a
                    single LLM call produces a strict-JSON course skeleton (validated
                    with Pydantic; one retry that feeds the validation error back).
Stage 2 (lessons):  fan-out — per lesson stub, retrieve relevant chunks (page range +
                    similarity) and write structured lesson content. LLM calls run
                    concurrently under an asyncio.Semaphore; same validate+retry-once.

course.generation_stage is updated (and committed) at every step so the frontend
poller can show live progress. Unrecoverable errors mark the course `failed`.
"""
import asyncio
import json
import logging
from dataclasses import dataclass

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import async_session_factory
from app.llm import get_llm
from app.models import Chapter, Chunk, Course, Document, Lesson, Topic
from app.prompts import lesson as lesson_prompt
from app.prompts import outline as outline_prompt
from app.prompts import summarize as summarize_prompt
from app.schemas.generation import CourseOutline, GeneratedLesson
from app.services import pdf as pdf_service
from app.services.chunking import chunk_pages
from app.services.embeddings import embed_query, embed_texts
from app.services.vectorstore import top_k_chunks

logger = logging.getLogger(__name__)

SUMMARY_BLOCK_CHARS = 32_000  # ~8k tokens per map block


def parse_json_response(text: str) -> dict:
    """Tolerantly extract a JSON object from an LLM response."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("Response contains no JSON object")
    return json.loads(text[start : end + 1])


@dataclass
class _LessonJob:
    lesson_id: int
    lesson_title: str
    topic_title: str
    chapter_title: str
    page_start: int
    page_end: int
    number: int  # 1-based position in course reading order


async def _set_stage(db: AsyncSession, course: Course, stage: str) -> None:
    course.generation_stage = stage
    await db.commit()
    logger.info("course %s: %s", course.id, stage)


async def run_generation(course_id: int) -> None:
    """Background entry point. Owns its own DB session."""
    async with async_session_factory() as db:
        course = await db.get(Course, course_id)
        if course is None:
            return
        try:
            await _pipeline(db, course)
        except Exception as exc:  # noqa: BLE001 — any failure must land in the course row
            logger.exception("course %s generation failed", course_id)
            await db.rollback()
            course = await db.get(Course, course_id)
            if course is not None:
                course.status = "failed"
                course.error = str(exc)[:2000]
                course.generation_stage = "Failed"
                await db.commit()


async def _pipeline(db: AsyncSession, course: Course) -> None:
    llm = get_llm()
    document = await db.get(Document, course.document_id)

    # ---------------- Stage 0: ingest ----------------
    await _set_stage(db, course, "Extracting text")
    pages = pdf_service.extract_pages(pdf_service.upload_path(document.id))
    total_pages = len(pages)
    full_text = "\n\n".join(p.strip() for p in pages)
    if len(full_text.strip()) < 200:
        raise RuntimeError(
            "No extractable text found in this PDF — it may be a scanned/image-only document."
        )

    await _set_stage(db, course, "Indexing content")
    chunks = chunk_pages(pages)
    embeddings = await embed_texts([c.text for c in chunks])
    for chunk, vector in zip(chunks, embeddings):
        db.add(
            Chunk(
                document_id=document.id,
                chunk_index=chunk.index,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                text=chunk.text,
                embedding=vector,
            )
        )
    await db.commit()

    # ---------------- Stage 1: outline (map-reduce) ----------------
    await _set_stage(db, course, "Building course outline")
    notes = await _map_reduce_notes(llm, pages)
    outline = await _generate_outline(llm, notes, document.filename, total_pages)

    course.title = outline.title
    course.description = outline.description
    course.difficulty = outline.difficulty
    course.estimated_minutes = outline.estimated_minutes
    course.objectives = outline.objectives
    course.prerequisites = outline.prerequisites

    jobs: list[_LessonJob] = []
    number = 0
    for c_pos, chapter_stub in enumerate(outline.chapters, start=1):
        chapter = Chapter(course_id=course.id, position=c_pos, title=chapter_stub.title, summary=chapter_stub.summary)
        db.add(chapter)
        await db.flush()
        for t_pos, topic_stub in enumerate(chapter_stub.topics, start=1):
            topic = Topic(chapter_id=chapter.id, position=t_pos, title=topic_stub.title)
            db.add(topic)
            await db.flush()
            for l_pos, stub in enumerate(topic_stub.lessons, start=1):
                lesson = Lesson(topic_id=topic.id, position=l_pos, title=stub.title, content=None)
                db.add(lesson)
                await db.flush()
                number += 1
                jobs.append(
                    _LessonJob(
                        lesson_id=lesson.id,
                        lesson_title=stub.title,
                        topic_title=topic_stub.title,
                        chapter_title=chapter_stub.title,
                        page_start=max(1, min(stub.page_start, total_pages)),
                        page_end=max(1, min(stub.page_end, total_pages)),
                        number=number,
                    )
                )
    await db.commit()

    # ---------------- Stage 2: lessons (fan-out) ----------------
    total_lessons = len(jobs)
    chapter_titles = [c.title for c in outline.chapters]
    semaphore = asyncio.Semaphore(settings.lesson_concurrency)

    for c_idx, chapter_stub in enumerate(outline.chapters, start=1):
        await _set_stage(db, course, f"Writing chapter {c_idx} of {len(chapter_titles)}")
        chapter_jobs = [j for j in jobs if j.chapter_title == chapter_stub.title]

        # Retrieval hits the DB session, so it runs sequentially; only the
        # LLM calls fan out concurrently.
        passages: dict[int, str] = {}
        for job in chapter_jobs:
            passages[job.lesson_id] = await _retrieve_passages(db, document.id, job)

        async def write_one(job: _LessonJob) -> tuple[int, dict]:
            async with semaphore:
                content = await _generate_lesson(llm, course.title, job, passages[job.lesson_id], total_lessons)
                return job.lesson_id, content

        # Sequential lesson writes avoid Groq RPM spikes from fan-out.
        for job in chapter_jobs:
            lesson_id, content = await write_one(job)
            lesson = await db.get(Lesson, lesson_id)
            lesson.content = content
            await db.commit()
            await asyncio.sleep(settings.llm_lesson_spacing_seconds)

    # ---------------- Finalize ----------------
    await _set_stage(db, course, "Finalizing")
    course.status = "ready"
    course.error = None
    await _set_stage(db, course, "Done")


async def _map_reduce_notes(llm, pages: list[str]) -> str:
    """Map: summarize ~8k-token page blocks into dense notes; reduce: concatenate."""
    blocks: list[tuple[str, int, int]] = []  # (text, page_start, page_end)
    buffer: list[str] = []
    size = 0
    block_start = 1
    for i, page in enumerate(pages, start=1):
        buffer.append(page.strip())
        size += len(page)
        if size >= SUMMARY_BLOCK_CHARS:
            blocks.append(("\n\n".join(buffer), block_start, i))
            buffer, size, block_start = [], 0, i + 1
    if buffer:
        blocks.append(("\n\n".join(buffer), block_start, len(pages)))

    notes: list[str] = []
    for i, (text, p_start, p_end) in enumerate(blocks):
        if i > 0:
            await asyncio.sleep(settings.llm_map_spacing_seconds)
        summary = await llm.complete(
            summarize_prompt.build(text, p_start, p_end),
            task="summarize",
            temperature=0.2,
            max_tokens=1024,
        )
        notes.append(f"[pages {p_start}-{p_end}]\n{summary.strip()}")
    return "\n\n".join(notes)


async def _generate_outline(llm, notes: str, filename: str, total_pages: int) -> CourseOutline:
    messages = outline_prompt.build(notes, filename, total_pages)
    user_content = messages[-1]["content"] if messages else ""
    # Diagnostic: prove source notes (derived from PDF text) are inside the Groq prompt.
    logger.info(
        "outline prompt | provider=%s | notes_chars=%s | user_prompt_chars=%s | "
        "notes_preview=%r | contains_CAP=%s contains_Sharding=%s contains_JWT=%s",
        getattr(llm, "name", type(llm).__name__),
        len(notes),
        len(user_content),
        notes[:500],
        "CAP" in notes,
        "Shard" in notes or "shard" in notes,
        "JWT" in notes,
    )
    raw = await llm.complete(messages, task="outline", temperature=0.3, max_tokens=4096, json_mode=True)
    logger.info("outline raw LLM response (%s chars): %s", len(raw or ""), (raw or "")[:4000])
    try:
        outline = CourseOutline.model_validate(parse_json_response(raw))
        logger.info(
            "outline parsed titles: course=%r chapters=%s",
            outline.title,
            [c.title for c in outline.chapters],
        )
        return outline
    except (ValidationError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("outline validation failed, retrying once: %s", exc)
        retry = outline_prompt.build_retry(notes, filename, total_pages, str(exc)[:1500])
        raw = await llm.complete(retry, task="outline", temperature=0.2, max_tokens=4096, json_mode=True)
        logger.info("outline retry raw LLM response (%s chars): %s", len(raw or ""), (raw or "")[:4000])
        outline = CourseOutline.model_validate(parse_json_response(raw))
        logger.info(
            "outline retry parsed titles: course=%r chapters=%s",
            outline.title,
            [c.title for c in outline.chapters],
        )
        return outline


async def _retrieve_passages(db: AsyncSession, document_id: int, job: _LessonJob) -> str:
    query = f"{job.chapter_title} — {job.topic_title}: {job.lesson_title}"
    query_vec = await embed_query(query)
    hits = await top_k_chunks(
        db,
        query_vec,
        document_ids=[document_id],
        k=5,
        page_range=(job.page_start, job.page_end),
    )
    if not hits:  # page-range filter can miss; fall back to whole-document similarity
        hits = await top_k_chunks(db, query_vec, document_ids=[document_id], k=5)
    return "\n\n---\n\n".join(
        f"[pages {c.page_start}-{c.page_end}]\n{c.text}" for c, _ in hits
    )


async def _generate_lesson(llm, course_title: str, job: _LessonJob, passages: str, total_lessons: int) -> dict:
    messages = lesson_prompt.build(
        course_title=course_title,
        chapter_title=job.chapter_title,
        topic_title=job.topic_title,
        lesson_title=job.lesson_title,
        lesson_number=job.number,
        lesson_total=total_lessons,
        passages=passages,
        page_start=job.page_start,
        page_end=job.page_end,
    )
    raw = await llm.complete(messages, task="lesson", temperature=0.4, max_tokens=4096, json_mode=True)
    try:
        return GeneratedLesson.model_validate(parse_json_response(raw)).model_dump()
    except (ValidationError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("lesson '%s' validation failed, retrying once: %s", job.lesson_title, exc)
        retry = lesson_prompt.build_retry(messages, str(exc)[:1500])
        raw = await llm.complete(retry, task="lesson", temperature=0.3, max_tokens=4096, json_mode=True)
        return GeneratedLesson.model_validate(parse_json_response(raw)).model_dump()
