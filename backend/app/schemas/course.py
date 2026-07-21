from datetime import datetime

from pydantic import BaseModel


class UploadResponse(BaseModel):
    course_id: int
    document_id: int


class CourseSummary(BaseModel):
    id: int
    title: str
    description: str
    difficulty: str
    estimated_minutes: int
    status: str
    created_at: datetime
    document_filename: str
    total_lessons: int
    completed_lessons: int
    completion_percent: float
    last_accessed_at: datetime | None = None


class LessonNode(BaseModel):
    id: int
    position: int
    title: str
    completed: bool


class TopicNode(BaseModel):
    id: int
    position: int
    title: str
    lessons: list[LessonNode]


class ChapterNode(BaseModel):
    id: int
    position: int
    title: str
    summary: str
    progress_percent: float
    topics: list[TopicNode]


class DocumentInfo(BaseModel):
    id: int
    filename: str
    page_count: int


class CourseDetail(BaseModel):
    id: int
    title: str
    description: str
    difficulty: str
    estimated_minutes: int
    objectives: list[str]
    prerequisites: list[str]
    status: str
    generation_stage: str | None
    error: str | None
    created_at: datetime
    document: DocumentInfo
    total_lessons: int
    completed_lessons: int
    completion_percent: float
    chapters: list[ChapterNode]


class CourseStatus(BaseModel):
    id: int
    status: str
    generation_stage: str | None
    error: str | None


class ChapterProgress(BaseModel):
    chapter_id: int
    title: str
    total_lessons: int
    completed_lessons: int
    progress_percent: float


class CourseProgress(BaseModel):
    course_id: int
    total_lessons: int
    completed_lessons: int
    completion_percent: float
    total_seconds_spent: int
    chapters: list[ChapterProgress]
