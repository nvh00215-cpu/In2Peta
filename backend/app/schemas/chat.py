from datetime import datetime

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    course_id: int


class ChatSessionOut(BaseModel):
    id: int
    course_id: int
    created_at: datetime
    message_count: int = 0
    last_message_preview: str | None = None


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
