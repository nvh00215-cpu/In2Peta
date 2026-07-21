from datetime import datetime

from pydantic import BaseModel, Field


class LessonSection(BaseModel):
    heading: str
    body: str


class LessonContent(BaseModel):
    sections: list[LessonSection]
    key_takeaways: list[str] = []
    important_notes: list[str] = []
    real_world_examples: list[str] = []
    summary: str = ""


class LessonDetail(BaseModel):
    id: int
    title: str
    position: int
    topic_id: int
    topic_title: str
    chapter_id: int
    chapter_title: str
    course_id: int
    course_title: str
    completed: bool
    prev_lesson_id: int | None
    next_lesson_id: int | None
    content: LessonContent | None


class CompleteLessonRequest(BaseModel):
    seconds_spent: int = Field(ge=0, le=60 * 60 * 24)


class CompleteLessonResponse(BaseModel):
    lesson_id: int
    completed: bool
    completed_at: datetime
