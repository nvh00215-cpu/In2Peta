from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import ActivityLog, Chapter, Course, Lesson, LessonProgress, QuizAttempt, Topic, User
from app.routers.courses import build_course_summary
from app.schemas.dashboard import ContinueLearning, DashboardResponse, DashboardStats
from app.services.activity import compute_streak
from app.services.progress import completed_lesson_ids, course_lesson_ids_in_order
from app.services.security import get_current_user

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    courses = (
        (
            await db.execute(
                select(Course).where(Course.user_id == current_user.id).order_by(Course.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    summaries = [await build_course_summary(db, current_user.id, c) for c in courses]

    lessons_completed = (
        await db.execute(
            select(func.count(LessonProgress.id)).where(LessonProgress.user_id == current_user.id)
        )
    ).scalar_one()
    total_seconds = (
        await db.execute(
            select(func.coalesce(func.sum(LessonProgress.seconds_spent), 0)).where(
                LessonProgress.user_id == current_user.id
            )
        )
    ).scalar_one()
    avg_score = (
        await db.execute(
            select(func.avg(QuizAttempt.score)).where(QuizAttempt.user_id == current_user.id)
        )
    ).scalar_one()
    streak = await compute_streak(db, current_user.id)

    stats = DashboardStats(
        courses_count=len(courses),
        lessons_completed=int(lessons_completed),
        total_seconds_spent=int(total_seconds),
        streak_days=streak,
        avg_quiz_score=round(float(avg_score), 1) if avg_score is not None else None,
    )

    continue_learning = await _continue_learning(db, current_user.id, courses, summaries)
    return DashboardResponse(stats=stats, continue_learning=continue_learning, courses=summaries)


async def _continue_learning(db: AsyncSession, user_id: int, courses, summaries) -> ContinueLearning | None:
    """Most recently accessed ready course with an incomplete lesson."""
    # Order candidate courses by the user's most recent activity that references them.
    recent = (
        (
            await db.execute(
                select(ActivityLog)
                .where(ActivityLog.user_id == user_id)
                .order_by(ActivityLog.created_at.desc())
                .limit(300)
            )
        )
        .scalars()
        .all()
    )
    recency: dict[int, int] = {}
    for rank, event in enumerate(recent):
        cid = (event.payload or {}).get("course_id")
        if isinstance(cid, int) and cid not in recency:
            recency[cid] = rank

    summary_by_id = {s.id: s for s in summaries}
    candidates = [c for c in courses if c.status == "ready"]
    candidates.sort(key=lambda c: recency.get(c.id, 10**9))

    for course in candidates:
        ordered = await course_lesson_ids_in_order(db, course.id)
        done = await completed_lesson_ids(db, user_id, ordered)
        next_id = next((lid for lid in ordered if lid not in done), None)
        if next_id is None:
            continue
        row = (
            await db.execute(
                select(Lesson.title, Chapter.title.label("chapter_title"))
                .join(Topic, Lesson.topic_id == Topic.id)
                .join(Chapter, Topic.chapter_id == Chapter.id)
                .where(Lesson.id == next_id)
            )
        ).first()
        return ContinueLearning(
            course_id=course.id,
            course_title=course.title,
            lesson_id=next_id,
            lesson_title=row.title,
            chapter_title=row.chapter_title,
            completion_percent=summary_by_id[course.id].completion_percent,
        )
    return None
