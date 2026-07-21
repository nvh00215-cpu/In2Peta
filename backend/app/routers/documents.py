from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Course, Document, User
from app.schemas.course import UploadResponse
from app.services import pdf as pdf_service
from app.services.activity import log_activity
from app.services.generation import run_generation
from app.services.pdf import PDFValidationError
from app.services.security import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await file.read()
    try:
        page_count = pdf_service.validate_pdf(data, file.filename or "upload.pdf")
    except PDFValidationError as exc:
        code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE if "MB" in str(exc) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(code, str(exc))

    document = Document(
        user_id=current_user.id,
        filename=file.filename or "upload.pdf",
        page_count=page_count,
        size_bytes=len(data),
    )
    db.add(document)
    await db.flush()
    pdf_service.save_upload(data, document.id)

    course = Course(
        user_id=current_user.id,
        document_id=document.id,
        title=f"Generating course from {document.filename}…",
        description="",
        status="generating",
        generation_stage="Queued",
    )
    db.add(course)
    await db.flush()
    await log_activity(db, current_user.id, "course_created", {"course_id": course.id, "document_id": document.id})
    await db.commit()

    background.add_task(run_generation, course.id)
    return UploadResponse(course_id=course.id, document_id=document.id)
