"""Pydantic schemas used to validate structured LLM output.

Every LLM call that must return JSON is validated against one of these models.
On validation failure the pipeline retries once, feeding the error back to the
model so it can correct itself.
"""
from pydantic import BaseModel, Field, field_validator


class LessonStub(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    page_start: int = Field(ge=1)
    page_end: int = Field(ge=1)

    @field_validator("page_end")
    @classmethod
    def _order_pages(cls, v: int, info):
        start = info.data.get("page_start")
        if start is not None and v < start:
            return start
        return v


class TopicStub(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    lessons: list[LessonStub] = Field(min_length=1)


class ChapterStub(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    summary: str = ""
    topics: list[TopicStub] = Field(min_length=1)


class CourseOutline(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    difficulty: str
    estimated_minutes: int = Field(ge=5, le=6000)
    objectives: list[str] = Field(min_length=1)
    prerequisites: list[str] = []
    chapters: list[ChapterStub] = Field(min_length=1)

    @field_validator("difficulty")
    @classmethod
    def _normalize_difficulty(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("beginner", "intermediate", "advanced"):
            raise ValueError("difficulty must be one of: beginner, intermediate, advanced")
        return v


class GeneratedSection(BaseModel):
    heading: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1)


class GeneratedLesson(BaseModel):
    sections: list[GeneratedSection] = Field(min_length=1)
    key_takeaways: list[str] = Field(min_length=1)
    important_notes: list[str] = []
    real_world_examples: list[str] = []
    summary: str = Field(min_length=1)


class GeneratedQuestion(BaseModel):
    type: str
    question: str = Field(min_length=1)
    options: list[str] | None = None
    correct_answer: str = Field(min_length=1)
    explanation: str = ""

    @field_validator("type")
    @classmethod
    def _valid_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("mcq", "tf", "short"):
            raise ValueError("type must be one of: mcq, tf, short")
        return v


class GeneratedQuiz(BaseModel):
    questions: list[GeneratedQuestion] = Field(min_length=3)
