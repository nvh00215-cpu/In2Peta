import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Chapter, Course, Document, Topic, User
from app.schemas.course import (
    ChapterNode,
    ChapterProgress,
    CourseDetail,
    CourseProgress,
    CourseStatus,
    CourseSummary,
    DocumentInfo,
    LessonNode,
    TopicNode,
)
from app.services import pdf as pdf_service
from app.services.progress import (
    completed_lesson_ids,
    course_lesson_ids_in_order,
    course_seconds_spent,
    percent,
)
from app.services.security import get_current_user

router = APIRouter(prefix="/courses", tags=["courses"])


async def get_owned_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Course:
    course = await db.get(Course, course_id)
    if course is None or course.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found.")
    return course


async def build_course_summary(db: AsyncSession, user_id: int, course: Course) -> CourseSummary:
    lesson_ids = await course_lesson_ids_in_order(db, course.id)
    done = await completed_lesson_ids(db, user_id, lesson_ids)
    document = await db.get(Document, course.document_id)
    return CourseSummary(
        id=course.id,
        title=course.title,
        description=course.description,
        difficulty=course.difficulty,
        estimated_minutes=course.estimated_minutes,
        status=course.status,
        created_at=course.created_at,
        document_filename=document.filename if document else "",
        total_lessons=len(lesson_ids),
        completed_lessons=len(done),
        completion_percent=percent(len(done), len(lesson_ids)),
    )


@router.get("", response_model=list[CourseSummary])
async def list_courses(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    courses = (
        (
            await db.execute(
                select(Course).where(Course.user_id == current_user.id).order_by(Course.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [await build_course_summary(db, current_user.id, c) for c in courses]


@router.get("/{course_id}", response_model=CourseDetail)
async def get_course(
    course: Course = Depends(get_owned_course),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await db.get(Document, course.document_id)
    chapters = (
        (
            await db.execute(
                select(Chapter)
                .where(Chapter.course_id == course.id)
                .order_by(Chapter.position)
                .options(selectinload(Chapter.topics).selectinload(Topic.lessons))
            )
        )
        .scalars()
        .all()
    )

    all_lesson_ids = [l.id for ch in chapters for t in ch.topics for l in t.lessons]
    done = await completed_lesson_ids(db, current_user.id, all_lesson_ids)

    chapter_nodes: list[ChapterNode] = []
    for chapter in chapters:
        topic_nodes: list[TopicNode] = []
        chapter_total = chapter_done = 0
        for topic in chapter.topics:
            lesson_nodes = [
                LessonNode(id=l.id, position=l.position, title=l.title, completed=l.id in done)
                for l in topic.lessons
            ]
            chapter_total += len(lesson_nodes)
            chapter_done += sum(1 for n in lesson_nodes if n.completed)
            topic_nodes.append(TopicNode(id=topic.id, position=topic.position, title=topic.title, lessons=lesson_nodes))
        chapter_nodes.append(
            ChapterNode(
                id=chapter.id,
                position=chapter.position,
                title=chapter.title,
                summary=chapter.summary,
                progress_percent=percent(chapter_done, chapter_total),
                topics=topic_nodes,
            )
        )

    return CourseDetail(
        id=course.id,
        title=course.title,
        description=course.description,
        difficulty=course.difficulty,
        estimated_minutes=course.estimated_minutes,
        objectives=list(course.objectives or []),
        prerequisites=list(course.prerequisites or []),
        status=course.status,
        generation_stage=course.generation_stage,
        error=course.error,
        created_at=course.created_at,
        document=DocumentInfo(id=document.id, filename=document.filename, page_count=document.page_count),
        total_lessons=len(all_lesson_ids),
        completed_lessons=len(done),
        completion_percent=percent(len(done), len(all_lesson_ids)),
        chapters=chapter_nodes,
    )


@router.get("/{course_id}/status", response_model=CourseStatus)
async def course_status(course: Course = Depends(get_owned_course)):
    return CourseStatus(
        id=course.id, status=course.status, generation_stage=course.generation_stage, error=course.error
    )


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(course: Course = Depends(get_owned_course), db: AsyncSession = Depends(get_db)):
    document = await db.get(Document, course.document_id)
    await db.delete(course)
    if document is not None:
        path = pdf_service.upload_path(document.id)
        await db.delete(document)
        try:
            os.remove(path)
        except OSError:
            pass
    await db.commit()


@router.get("/{course_id}/progress", response_model=CourseProgress)
async def course_progress(
    course: Course = Depends(get_owned_course),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chapters = (
        (
            await db.execute(
                select(Chapter)
                .where(Chapter.course_id == course.id)
                .order_by(Chapter.position)
                .options(selectinload(Chapter.topics).selectinload(Topic.lessons))
            )
        )
        .scalars()
        .all()
    )
    all_lesson_ids = [l.id for ch in chapters for t in ch.topics for l in t.lessons]
    done = await completed_lesson_ids(db, current_user.id, all_lesson_ids)
    seconds = await course_seconds_spent(db, current_user.id, all_lesson_ids)

    chapter_progress: list[ChapterProgress] = []
    for chapter in chapters:
        ids = [l.id for t in chapter.topics for l in t.lessons]
        done_count = sum(1 for i in ids if i in done)
        chapter_progress.append(
            ChapterProgress(
                chapter_id=chapter.id,
                title=chapter.title,
                total_lessons=len(ids),
                completed_lessons=done_count,
                progress_percent=percent(done_count, len(ids)),
            )
        )

    return CourseProgress(
        course_id=course.id,
        total_lessons=len(all_lesson_ids),
        completed_lessons=len(done),
        completion_percent=percent(len(done), len(all_lesson_ids)),
        total_seconds_spent=seconds,
        chapters=chapter_progress,
    )
