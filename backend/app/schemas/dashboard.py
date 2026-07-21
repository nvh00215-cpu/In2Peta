from pydantic import BaseModel

from app.schemas.course import CourseSummary


class DashboardStats(BaseModel):
    courses_count: int
    lessons_completed: int
    total_seconds_spent: int
    streak_days: int
    avg_quiz_score: float | None


class ContinueLearning(BaseModel):
    course_id: int
    course_title: str
    lesson_id: int
    lesson_title: str
    chapter_title: str
    completion_percent: float


class DashboardResponse(BaseModel):
    stats: DashboardStats
    continue_learning: ContinueLearning | None
    courses: list[CourseSummary]
