"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Globe2,
  Lightbulb,
  ListTree,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import {
  completeLesson,
  getCourse,
  getLesson,
  ApiError,
} from "@/lib/api";
import type { CourseDetail, Lesson } from "@/lib/api";
import { TopBar } from "@/components/ds/top-bar";
import { PrimaryButton } from "@/components/ds/primary-button";
import { IconButton } from "@/components/ds/icon-button";
import { Callout } from "@/components/ds/callout";
import { ProgressBar } from "@/components/ds/progress-bar";
import { CourseTree } from "@/components/course-tree";
import { Markdown } from "@/components/markdown";
import { AiTutorFab, AiTutorPanel } from "@/components/ai-tutor-panel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function LessonReaderPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = Number(params.id);
  const lessonId = Number(params.lessonId);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!Number.isFinite(courseId) || !Number.isFinite(lessonId)) return;
    startedAt.current = Date.now();
    setError(null);
    Promise.all([getLesson(lessonId), getCourse(courseId)])
      .then(([l, c]) => {
        setLesson(l);
        setCourse(c);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.detail : "Could not load lesson."
        )
      );
  }, [courseId, lessonId]);

  const secondsSpent = useMemo(
    () => () =>
      Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)),
    []
  );

  async function markCompleteAndNext() {
    if (!lesson) return;
    setCompleting(true);
    try {
      if (!lesson.completed) {
        await completeLesson(lesson.id, secondsSpent());
      }
      if (lesson.next_lesson_id) {
        router.push(`/courses/${courseId}/lessons/${lesson.next_lesson_id}`);
      } else {
        router.push(`/courses/${courseId}`);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Could not save progress."
      );
      setCompleting(false);
    }
  }

  if (error && !lesson) {
    return (
      <div className="py-16 text-center">
        <p className="text-body text-promo">{error}</p>
        <Link
          href={`/courses/${courseId}`}
          className="mt-3 inline-block min-h-11 text-btn text-terracotta"
        >
          Back to course
        </Link>
      </div>
    );
  }

  if (!lesson || !course) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-body text-muted-gray">
        <Loader2 className="h-5 w-5 animate-spin text-terracotta" />
        Loading lesson…
      </div>
    );
  }

  const content = lesson.content;

  return (
    <div className="relative -mx-4 flex min-h-[calc(100vh-4rem)] flex-col sm:-mx-5 md:min-h-0 md:flex-row md:gap-0">
      {/* Desktop persistent sidebar */}
      <aside className="hidden w-full shrink-0 border-r border-border-gray bg-white md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] md:w-72 lg:w-80">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-border-gray p-4">
            <p className="text-caption text-muted-gray">Course</p>
            <p className="mt-1 line-clamp-2 text-card-title text-heading">
              {course.title}
            </p>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-caption text-muted-gray">
                <span>Progress</span>
                <span className="text-price text-heading">
                  {Math.round(course.completion_percent)}%
                </span>
              </div>
              <ProgressBar value={course.completion_percent} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <CourseTree course={course} currentLessonId={lesson.id} />
          </div>
        </div>
      </aside>

      {/* Main lesson column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 pb-28 sm:px-5 md:px-6 lg:px-8">
          <TopBar
            title={lesson.title}
            backHref={`/courses/${courseId}`}
            action={
              <IconButton
                aria-label="Open course contents"
                variant="white"
                size={44}
                className="md:hidden"
                onClick={() => setTreeOpen(true)}
              >
                <ListTree className="h-5 w-5" strokeWidth={1.7} />
              </IconButton>
            }
          />

          <p className="mt-1 text-caption text-muted-gray">
            {lesson.chapter_title} · {lesson.topic_title}
          </p>

          <article className="mx-auto mt-5 flex max-w-3xl flex-col gap-6">
            {content?.sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-section text-heading">{section.heading}</h2>
                <div className="mt-3">
                  <Markdown>{section.body}</Markdown>
                </div>
              </section>
            ))}

            {content?.key_takeaways?.length ? (
              <Callout
                icon={Lightbulb}
                title="Key takeaways"
                items={content.key_takeaways}
                tone="terracotta"
              />
            ) : null}
            {content?.important_notes?.length ? (
              <Callout
                icon={TriangleAlert}
                title="Important notes"
                items={content.important_notes}
              />
            ) : null}
            {content?.real_world_examples?.length ? (
              <Callout
                icon={Globe2}
                title="Real-world examples"
                items={content.real_world_examples}
              />
            ) : null}
            {content?.summary ? (
              <Callout icon={BookOpen} title="Summary" body={content.summary} />
            ) : null}
          </article>

          {error ? (
            <p className="mx-auto mt-4 max-w-3xl text-caption text-promo">
              {error}
            </p>
          ) : null}
        </div>

        {/* Pinned bottom actions */}
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border-gray bg-white/95 px-4 py-3 backdrop-blur md:sticky md:bottom-0 md:left-auto md:right-auto md:z-10 md:mt-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <PrimaryButton
              onClick={() => void markCompleteAndNext()}
              disabled={completing}
              className="sm:flex-1"
            >
              {completing
                ? "Saving…"
                : lesson.completed
                  ? lesson.next_lesson_id
                    ? "Next lesson"
                    : "Back to course"
                  : "Mark complete & next"}
            </PrimaryButton>
            <div className="flex min-h-11 items-center justify-between gap-4 sm:w-auto sm:justify-end">
              {lesson.prev_lesson_id ? (
                <Link
                  href={`/courses/${courseId}/lessons/${lesson.prev_lesson_id}`}
                  className="text-btn text-body-gray hover:text-heading"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              {lesson.next_lesson_id ? (
                <Link
                  href={`/courses/${courseId}/lessons/${lesson.next_lesson_id}`}
                  className="text-btn text-terracotta"
                >
                  Skip
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <AiTutorFab onClick={() => setChatOpen(true)} />
      <AiTutorPanel
        courseId={courseId}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* Mobile contents drawer */}
      <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
        <SheetContent
          side="left"
          className="w-[min(100%,320px)] border-border-gray bg-white p-0 sm:max-w-sm"
        >
          <SheetHeader className="border-b border-border-gray p-4 text-left">
            <SheetTitle className="text-card-title text-heading">
              Contents
            </SheetTitle>
            <p className="line-clamp-2 text-caption text-muted-gray">
              {course.title}
            </p>
          </SheetHeader>
          <div className="overflow-y-auto p-3 pb-24">
            <CourseTree
              course={course}
              currentLessonId={lesson.id}
              onNavigate={() => setTreeOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
