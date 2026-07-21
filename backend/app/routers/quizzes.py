import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import get_db
from app.llm import get_llm
from app.models import Chapter, Course, Lesson, Quiz, QuizAttempt, QuizQuestion, Topic, User
from app.prompts import quiz as quiz_prompt
from app.schemas.generation import GeneratedQuiz
from app.schemas.quiz import (
    AttemptRequest,
    AttemptResult,
    AttemptSummary,
    QuestionResult,
    QuizOut,
    QuizQuestionOut,
)
from app.services.activity import log_activity
from app.services.generation import parse_json_response
from app.services.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["quizzes"])

MAX_QUIZ_CONTEXT_CHARS = 24_000
# Separate Groq rate-limit pool from course/lesson generation (70B).
QUIZ_GROQ_MODEL = "llama-3.1-8b-instant"


def _quiz_model_override() -> str | None:
    """Provider-specific quiz model; None = use the provider's default model."""
    provider = settings.effective_llm_provider
    if provider == "groq":
        return QUIZ_GROQ_MODEL
    # gemini / openrouter / mock: same model as course generation (Flash-Lite for gemini)
    return None


def _quiz_to_out(quiz: Quiz, chapter_title: str) -> QuizOut:
    return QuizOut(
        id=quiz.id,
        chapter_id=quiz.chapter_id,
        chapter_title=chapter_title,
        generated_at=quiz.generated_at,
        questions=[
            QuizQuestionOut(id=q.id, type=q.type, question=q.question, options=q.options)
            for q in quiz.questions
        ],
    )


def _chapter_content_text(chapter: Chapter) -> str:
    parts: list[str] = [f"Chapter: {chapter.title}", chapter.summary]
    for topic in chapter.topics:
        parts.append(f"\n## Topic: {topic.title}")
        for lesson in topic.lessons:
            parts.append(f"\n### Lesson: {lesson.title}")
            content = lesson.content or {}
            for section in content.get("sections", []):
                parts.append(f"{section.get('heading', '')}\n{section.get('body', '')}")
            if content.get("key_takeaways"):
                parts.append("Key takeaways: " + "; ".join(content["key_takeaways"]))
            if content.get("summary"):
                parts.append("Summary: " + content["summary"])
    return "\n".join(parts)[:MAX_QUIZ_CONTEXT_CHARS]


@router.get("/chapters/{chapter_id}/quiz", response_model=QuizOut)
async def get_chapter_quiz(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # DIAGNOSTIC — confirm lazy-quiz handler is entered on first open
    logger.info(
        "QUIZ_HANDLER_ENTERED chapter_id=%s user_id=%s",
        chapter_id,
        current_user.id,
    )

    chapter = (
        await db.execute(
            select(Chapter)
            .where(Chapter.id == chapter_id)
            .options(selectinload(Chapter.topics).selectinload(Topic.lessons))
        )
    ).scalar_one_or_none()
    if chapter is None:
        logger.warning("QUIZ_HANDLER chapter %s not found", chapter_id)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chapter not found.")
    course = await db.get(Course, chapter.course_id)
    if course is None or course.user_id != current_user.id:
        logger.warning(
            "QUIZ_HANDLER chapter %s forbidden/missing for user %s",
            chapter_id,
            current_user.id,
        )
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chapter not found.")
    if course.status == "generating":
        logger.warning("QUIZ_HANDLER course still generating course_id=%s", course.id)
        raise HTTPException(status.HTTP_409_CONFLICT, "The course is still being generated. Try again shortly.")

    existing = (
        await db.execute(
            select(Quiz).where(Quiz.chapter_id == chapter.id).options(selectinload(Quiz.questions))
        )
    ).scalar_one_or_none()
    if existing is not None:
        logger.info(
            "QUIZ_HANDLER cache hit chapter_id=%s quiz_id=%s questions=%s — skipping LLM",
            chapter.id,
            existing.id,
            len(existing.questions or []),
        )
        return _quiz_to_out(existing, chapter.title)

    # Lazily generate on first request.
    chapter_text = _chapter_content_text(chapter)
    logger.info(
        "QUIZ_HANDLER cache miss — starting LLM generation chapter_id=%s title=%r "
        "course=%r content_chars=%s lesson_count=%s",
        chapter.id,
        chapter.title,
        course.title,
        len(chapter_text),
        sum(len(t.lessons) for t in chapter.topics),
    )

    llm = get_llm()
    quiz_model = _quiz_model_override()
    logger.info(
        "QUIZ_HANDLER llm_provider=%s quiz_model=%s",
        getattr(llm, "name", type(llm).__name__),
        quiz_model or getattr(llm, "model", "default"),
    )
    messages = quiz_prompt.build(course.title, chapter.title, chapter_text)
    for i, msg in enumerate(messages):
        content = msg.get("content") or ""
        logger.info(
            "QUIZ_PROMPT role=%s chars=%s preview=%r",
            msg.get("role"),
            len(content),
            content[:800],
        )
        if i == len(messages) - 1:
            logger.info("QUIZ_PROMPT full_user_message:\n%s", content)

    try:
        try:
            raw = await llm.complete(
                messages,
                task="quiz",
                temperature=0.4,
                max_tokens=4096,
                json_mode=True,
                model=quiz_model,
            )
            logger.info(
                "QUIZ_RAW_RESPONSE chars=%s body=\n%s",
                len(raw or ""),
                raw or "",
            )
            try:
                parsed = parse_json_response(raw)
                logger.info("QUIZ_PARSE_JSON_OK keys=%s", list(parsed.keys()) if isinstance(parsed, dict) else type(parsed))
            except Exception as parse_exc:
                logger.exception(
                    "QUIZ_PARSE_JSON_FAIL chapter_id=%s error=%s raw_preview=%r",
                    chapter.id,
                    parse_exc,
                    (raw or "")[:500],
                )
                raise
            try:
                generated = GeneratedQuiz.model_validate(parsed)
                logger.info(
                    "QUIZ_VALIDATE_OK chapter_id=%s question_count=%s types=%s",
                    chapter.id,
                    len(generated.questions),
                    [q.type for q in generated.questions],
                )
            except ValidationError as val_exc:
                logger.error(
                    "QUIZ_VALIDATE_FAIL chapter_id=%s error=%s errors_json=%s",
                    chapter.id,
                    val_exc,
                    val_exc.errors(),
                )
                raise
        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            logger.warning("quiz validation failed for chapter %s, retrying once: %s", chapter.id, exc)
            retry = quiz_prompt.build_retry(messages, str(exc)[:1500])
            logger.info("QUIZ_RETRY_PROMPT preview=%r", (retry[-1].get("content") or "")[-500:])
            raw = await llm.complete(
                retry,
                task="quiz",
                temperature=0.3,
                max_tokens=4096,
                json_mode=True,
                model=quiz_model,
            )
            logger.info(
                "QUIZ_RAW_RESPONSE_RETRY chars=%s body=\n%s",
                len(raw or ""),
                raw or "",
            )
            generated = GeneratedQuiz.model_validate(parse_json_response(raw))
            logger.info(
                "QUIZ_VALIDATE_OK_AFTER_RETRY chapter_id=%s question_count=%s",
                chapter.id,
                len(generated.questions),
            )
    except Exception as exc:  # noqa: BLE001
        logger.exception("quiz generation failed for chapter %s", chapter.id)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Quiz generation failed: {exc}. Please try again.")

    quiz = Quiz(chapter_id=chapter.id)
    db.add(quiz)
    await db.flush()
    for q in generated.questions:
        options = q.options
        if q.type == "tf":
            options = ["True", "False"]
        db.add(
            QuizQuestion(
                quiz_id=quiz.id,
                type=q.type,
                question=q.question,
                options=options,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
            )
        )
    await db.commit()

    quiz = (
        await db.execute(select(Quiz).where(Quiz.id == quiz.id).options(selectinload(Quiz.questions)))
    ).scalar_one()
    logger.info(
        "QUIZ_HANDLER_SUCCESS chapter_id=%s quiz_id=%s questions=%s",
        chapter.id,
        quiz.id,
        len(quiz.questions),
    )
    return _quiz_to_out(quiz, chapter.title)


def _grade(question: QuizQuestion, answer: str | None) -> bool:
    if not answer or not answer.strip():
        return False
    given = answer.strip().lower()
    correct = question.correct_answer.strip()
    if question.type in ("mcq", "tf"):
        return given == correct.lower()
    # Short answer: case-insensitive keyword matching. Alternatives separated by "|".
    for alternative in correct.lower().split("|"):
        alternative = alternative.strip()
        if not alternative:
            continue
        if alternative in given or given in alternative:
            return True
        words = [w for w in alternative.replace(",", " ").split() if len(w) > 2]
        if words and all(w in given for w in words):
            return True
    return False


async def _get_owned_quiz(quiz_id: int, db: AsyncSession, user: User) -> Quiz:
    quiz = (
        await db.execute(select(Quiz).where(Quiz.id == quiz_id).options(selectinload(Quiz.questions)))
    ).scalar_one_or_none()
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found.")
    chapter = await db.get(Chapter, quiz.chapter_id)
    course = await db.get(Course, chapter.course_id)
    if course.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found.")
    return quiz


@router.post("/quizzes/{quiz_id}/attempts", response_model=AttemptResult, status_code=status.HTTP_201_CREATED)
async def submit_attempt(
    quiz_id: int,
    body: AttemptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = await _get_owned_quiz(quiz_id, db, current_user)

    results: list[QuestionResult] = []
    correct_count = 0
    for question in quiz.questions:
        answer = body.answers.get(str(question.id))
        is_correct = _grade(question, answer)
        correct_count += int(is_correct)
        results.append(
            QuestionResult(
                question_id=question.id,
                question=question.question,
                type=question.type,
                your_answer=answer,
                correct_answer=question.correct_answer,
                is_correct=is_correct,
                explanation=question.explanation,
            )
        )
    score = round(correct_count / len(quiz.questions) * 100, 1) if quiz.questions else 0.0

    attempt = QuizAttempt(user_id=current_user.id, quiz_id=quiz.id, answers=body.answers, score=score)
    db.add(attempt)
    await db.flush()
    await log_activity(db, current_user.id, "quiz_attempt", {"quiz_id": quiz.id, "score": score})
    await db.commit()

    return AttemptResult(id=attempt.id, quiz_id=quiz.id, score=score, taken_at=attempt.taken_at, results=results)


@router.get("/quizzes/{quiz_id}/attempts", response_model=list[AttemptSummary])
async def list_attempts(
    quiz_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_quiz(quiz_id, db, current_user)
    attempts = (
        (
            await db.execute(
                select(QuizAttempt)
                .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == current_user.id)
                .order_by(QuizAttempt.taken_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [AttemptSummary(id=a.id, score=a.score, taken_at=a.taken_at) for a in attempts]
