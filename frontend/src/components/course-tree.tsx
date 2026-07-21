"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ClipboardList } from "lucide-react";
import type { CourseDetail } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Collapsible chapter → topic → lesson tree for the course reader sidebar.
 */
export function CourseTree({
  course,
  currentLessonId,
  onNavigate,
}: {
  course: CourseDetail;
  currentLessonId?: number;
  onNavigate?: () => void;
}) {
  const [openChapters, setOpenChapters] = useState<Record<number, boolean>>(
    () => Object.fromEntries(course.chapters.map((c) => [c.id, true]))
  );
  const [openTopics, setOpenTopics] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!currentLessonId) return;
    for (const ch of course.chapters) {
      for (const topic of ch.topics) {
        if (topic.lessons.some((l) => l.id === currentLessonId)) {
          setOpenChapters((prev) => ({ ...prev, [ch.id]: true }));
          setOpenTopics((prev) => ({ ...prev, [topic.id]: true }));
          return;
        }
      }
    }
  }, [course.chapters, currentLessonId]);

  return (
    <nav className="flex flex-col gap-2" aria-label="Course contents">
      {course.chapters.map((ch) => {
        const chOpen = openChapters[ch.id] ?? true;
        return (
          <div key={ch.id} className="rounded-card-sm bg-off-white/80">
            <button
              type="button"
              onClick={() =>
                setOpenChapters((prev) => ({ ...prev, [ch.id]: !chOpen }))
              }
              className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-gray transition-transform",
                  !chOpen && "-rotate-90"
                )}
                strokeWidth={1.7}
              />
              <span className="min-w-0 flex-1 truncate text-caption font-medium text-heading">
                {ch.title}
              </span>
              <span className="shrink-0 text-caption text-muted-gray">
                {Math.round(ch.progress_percent)}%
              </span>
            </button>

            {chOpen ? (
              <div className="pb-2 pl-2 pr-2">
                {ch.topics.map((topic) => {
                  const topicOpen = openTopics[topic.id] ?? true;
                  return (
                    <div key={topic.id} className="mb-1">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenTopics((prev) => ({
                            ...prev,
                            [topic.id]: !topicOpen,
                          }))
                        }
                        className="flex min-h-11 w-full items-center gap-2 rounded-card-sm px-2 py-1 text-left"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-muted-gray transition-transform",
                            !topicOpen && "-rotate-90"
                          )}
                          strokeWidth={1.7}
                        />
                        <span className="truncate text-caption text-body-gray">
                          {topic.title}
                        </span>
                      </button>

                      {topicOpen
                        ? topic.lessons.map((lesson) => {
                            const active = lesson.id === currentLessonId;
                            return (
                              <Link
                                key={lesson.id}
                                href={`/courses/${course.id}/lessons/${lesson.id}`}
                                onClick={onNavigate}
                                className={cn(
                                  "ml-5 flex min-h-11 items-center gap-2 rounded-card-sm px-2 py-2 text-body transition-colors",
                                  active
                                    ? "bg-terracotta/10 text-terracotta"
                                    : "text-heading hover:bg-light-gray"
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-pill",
                                    lesson.completed
                                      ? "bg-terracotta text-white"
                                      : "bg-light-gray text-muted-gray"
                                  )}
                                >
                                  {lesson.completed ? (
                                    <Check className="h-3 w-3" strokeWidth={2} />
                                  ) : null}
                                </span>
                                <span className="truncate">{lesson.title}</span>
                              </Link>
                            );
                          })
                        : null}
                    </div>
                  );
                })}

                <Link
                  href={`/courses/${course.id}/chapters/${ch.id}/quiz`}
                  onClick={onNavigate}
                  className="ml-3 mt-1 flex min-h-11 items-center gap-2 rounded-card-sm px-2 py-2 text-btn text-terracotta hover:bg-terracotta/5"
                >
                  <ClipboardList className="h-4 w-4" strokeWidth={1.7} />
                  Chapter quiz
                </Link>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
