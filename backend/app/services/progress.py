"""Progress/completion helpers shared by courses, lessons and dashboard routers."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Chapter, Lesson, LessonProgress, Topic


def _percent(completed: int, total: int) -> float:
    return round(completed / total * 100, 1) if total else 0.0


async def course_lesson_ids_in_order(db: AsyncSession, course_id: int) -> list[int]:
    """All lesson ids of a course in global reading order."""
    stmt = (
        select(Lesson.id)
        .join(Topic, Lesson.topic_id == Topic.id)
        .join(Chapter, Topic.chapter_id == Chapter.id)
        .where(Chapter.course_id == course_id)
        .order_by(Chapter.position, Topic.position, Lesson.position, Lesson.id)
    )
    return list((await db.execute(stmt)).scalars().all())


async def completed_lesson_ids(db: AsyncSession, user_id: int, lesson_ids: list[int]) -> set[int]:
    if not lesson_ids:
        return set()
    stmt = select(LessonProgress.lesson_id).where(
        LessonProgress.user_id == user_id, LessonProgress.lesson_id.in_(lesson_ids)
    )
    return set((await db.execute(stmt)).scalars().all())


async def course_completion(db: AsyncSession, user_id: int, course_id: int) -> tuple[int, int, float]:
    """Returns (total_lessons, completed_lessons, completion_percent)."""
    lesson_ids = await course_lesson_ids_in_order(db, course_id)
    done = await completed_lesson_ids(db, user_id, lesson_ids)
    return len(lesson_ids), len(done), _percent(len(done), len(lesson_ids))


async def course_seconds_spent(db: AsyncSession, user_id: int, lesson_ids: list[int]) -> int:
    if not lesson_ids:
        return 0
    stmt = select(func.coalesce(func.sum(LessonProgress.seconds_spent), 0)).where(
        LessonProgress.user_id == user_id, LessonProgress.lesson_id.in_(lesson_ids)
    )
    return int((await db.execute(stmt)).scalar_one())


percent = _percent
