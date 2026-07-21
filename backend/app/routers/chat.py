import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session_factory, get_db
from app.llm import get_llm
from app.models import ChatMessage, ChatSession, Course, User
from app.schemas.chat import ChatMessageOut, ChatSessionOut, CreateSessionRequest, SendMessageRequest
from app.services.activity import log_activity
from app.services.rag import build_chat_messages
from app.services.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_owned_session(session_id: int, db: AsyncSession, user: User) -> ChatSession:
    session = await db.get(ChatSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chat session not found.")
    return session


@router.post("/sessions", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    course = await db.get(Course, body.course_id)
    if course is None or course.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found.")
    session = ChatSession(user_id=current_user.id, course_id=course.id)
    db.add(session)
    await db.commit()
    return ChatSessionOut(id=session.id, course_id=session.course_id, created_at=session.created_at)


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    course_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ChatSession).where(ChatSession.user_id == current_user.id)
    if course_id is not None:
        stmt = stmt.where(ChatSession.course_id == course_id)
    sessions = (await db.execute(stmt.order_by(ChatSession.created_at.desc()))).scalars().all()

    out: list[ChatSessionOut] = []
    for session in sessions:
        count = (
            await db.execute(
                select(func.count(ChatMessage.id)).where(ChatMessage.session_id == session.id)
            )
        ).scalar_one()
        last = (
            await db.execute(
                select(ChatMessage.content)
                .where(ChatMessage.session_id == session.id)
                .order_by(ChatMessage.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        out.append(
            ChatSessionOut(
                id=session.id,
                course_id=session.course_id,
                created_at=session.created_at,
                message_count=count,
                last_message_preview=(last[:120] if last else None),
            )
        )
    return out


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def list_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await _get_owned_session(session_id, db, current_user)
    messages = (
        (
            await db.execute(
                select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.id)
            )
        )
        .scalars()
        .all()
    )
    return [ChatMessageOut(id=m.id, role=m.role, content=m.content, created_at=m.created_at) for m in messages]


@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: int,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """RAG tutor reply, streamed as Server-Sent Events."""
    session = await _get_owned_session(session_id, db, current_user)
    course = await db.get(Course, session.course_id)

    # Persist the user's message and build the RAG context up front (request-scoped
    # session), so the streaming generator only needs a short-lived session at the end.
    db.add(ChatMessage(session_id=session.id, role="user", content=body.content))
    await log_activity(db, current_user.id, "chat_message", {"course_id": course.id, "session_id": session.id})
    await db.commit()

    llm_messages = await build_chat_messages(
        db, course=course, user_id=current_user.id, session_id=session.id, user_message=body.content
    )

    llm = get_llm()
    session_id_value = session.id

    async def event_stream():
        collected: list[str] = []
        try:
            async for delta in llm.stream(llm_messages, task="chat"):
                collected.append(delta)
                yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception as exc:  # noqa: BLE001
            logger.exception("chat streaming failed for session %s", session_id_value)
            yield f"data: {json.dumps({'error': f'The tutor is unavailable right now: {exc}'})}\n\n"
            return
        # Persist the assistant reply with a fresh session (the request session
        # may already be closed once the response started streaming).
        assistant_text = "".join(collected)
        async with async_session_factory() as fresh:
            message = ChatMessage(session_id=session_id_value, role="assistant", content=assistant_text)
            fresh.add(message)
            await fresh.commit()
            message_id = message.id
        yield f"data: {json.dumps({'done': True, 'message_id': message_id})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
