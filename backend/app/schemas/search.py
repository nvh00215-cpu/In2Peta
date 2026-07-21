from pydantic import BaseModel


class SearchResult(BaseModel):
    type: str  # course | chapter | topic | lesson | passage
    id: int
    title: str
    snippet: str
    course_id: int
    course_title: str
    lesson_id: int | None = None
    chapter_id: int | None = None
    score: float | None = None


class SearchResponse(BaseModel):
    query: str
    mode: str
    results: list[SearchResult]
