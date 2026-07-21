from datetime import datetime

from pydantic import BaseModel


class QuizQuestionOut(BaseModel):
    """A question as shown to the learner — never includes the correct answer."""

    id: int
    type: str
    question: str
    options: list[str] | None


class QuizOut(BaseModel):
    id: int
    chapter_id: int
    chapter_title: str
    generated_at: datetime
    questions: list[QuizQuestionOut]


class AttemptRequest(BaseModel):
    answers: dict[str, str] = {}


class QuestionResult(BaseModel):
    question_id: int
    question: str
    type: str
    your_answer: str | None
    correct_answer: str
    is_correct: bool
    explanation: str


class AttemptResult(BaseModel):
    id: int
    quiz_id: int
    score: float
    taken_at: datetime
    results: list[QuestionResult]


class AttemptSummary(BaseModel):
    id: int
    score: float
    taken_at: datetime
