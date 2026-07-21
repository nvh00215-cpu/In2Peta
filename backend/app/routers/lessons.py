from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Chapter, Course, Lesson, LessonProgress, Topic, User
from app.schemas.lesson import CompleteLessonRequest, CompleteLessonResponse, LessonContent, LessonDetail
from app.services.activity import log_activity
from app.services.progress import course_lesson_ids_in_order
from app.services.security import get_current_user

router = APIRouter(prefix="/lessons", tags=["lessons"])


async def _get_owned_lesson(
    lesson_id: int, db: AsyncSession, user: User
) -> tuple[Lesson, Topic, Chapter, Course]:
    row = (
        await db.execute(
            select(Lesson, Topic, Chapter, Course)
            .join(Topic, Lesson.topic_id == Topic.id)
            .join(Chapter, Topic.chapter_id == Chapter.id)
            .join(Course, Chapter.course_id == Course.id)
            .where(Lesson.id == lesson_id)
        )
    ).first()
    if row is None or row.Course.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found.")
    return row.Lesson, row.Topic, row.Chapter, row.Course


@router.get("/{lesson_id}", response_model=LessonDetail)
async def get_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lesson, topic, chapter, course = await _get_owned_lesson(lesson_id, db, current_user)

    ordered = await course_lesson_ids_in_order(db, course.id)
    idx = ordered.index(lesson.id)
    prev_id = ordered[idx - 1] if idx > 0 else None
    next_id = ordered[idx + 1] if idx < len(ordered) - 1 else None

    progress = (
        await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == current_user.id, LessonProgress.lesson_id == lesson.id
            )
        )
    ).scalar_one_or_none()

    await log_activity(db, current_user.id, "lesson_viewed", {"lesson_id": lesson.id, "course_id": course.id})
    await db.commit()

    return LessonDetail(
        id=lesson.id,
        title=lesson.title,
        position=lesson.position,
        topic_id=topic.id,
        topic_title=topic.title,
        chapter_id=chapter.id,
        chapter_title=chapter.title,
        course_id=course.id,
        course_title=course.title,
        completed=progress is not None,
        prev_lesson_id=prev_id,
        next_lesson_id=next_id,
        content=LessonContent.model_validate(lesson.content) if lesson.content else None,
    )


@router.post("/{lesson_id}/complete", response_model=CompleteLessonResponse)
async def complete_lesson(
    lesson_id: int,
    body: CompleteLessonRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lesson, _, _, course = await _get_owned_lesson(lesson_id, db, current_user)

    progress = (
        await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == current_user.id, LessonProgress.lesson_id == lesson.id
            )
        )
    ).scalar_one_or_none()
    if progress is None:
        progress = LessonProgress(
            user_id=current_user.id,
            lesson_id=lesson.id,
            completed_at=datetime.now(timezone.utc),
            seconds_spent=body.seconds_spent,
        )
        db.add(progress)
    else:
        progress.seconds_spent += body.seconds_spent

    await log_activity(
        db,
        current_user.id,
        "lesson_completed",
        {"lesson_id": lesson.id, "course_id": course.id, "seconds_spent": body.seconds_spent},
    )
    await db.commit()
    return CompleteLessonResponse(lesson_id=lesson.id, completed=True, completed_at=progress.completed_at)


@router.delete("/{lesson_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
async def uncomplete_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lesson, _, _, _ = await _get_owned_lesson(lesson_id, db, current_user)
    progress = (
        await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == current_user.id, LessonProgress.lesson_id == lesson.id
            )
        )
    ).scalar_one_or_none()
    if progress is not None:
        await db.delete(progress)
        await db.commit()
