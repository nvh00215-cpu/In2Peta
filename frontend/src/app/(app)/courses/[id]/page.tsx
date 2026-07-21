"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, ClipboardList, Loader2 } from "lucide-react";
import { getCourse, ApiError } from "@/lib/api";
import type { CourseDetail } from "@/lib/api";
import { TopBar } from "@/components/ds/top-bar";
import { PrimaryButton } from "@/components/ds/primary-button";
import { ProgressBar } from "@/components/ds/progress-bar";
import { SegmentedControl } from "@/components/ds/segmented-control";
import { difficultyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "overview" | "contents";

export default function CourseOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = Number(params.id);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!Number.isFinite(courseId)) return;
    getCourse(courseId)
      .then((c) => {
        if (c.status === "generating") {
          router.replace(`/courses/${courseId}/generating`);
          return;
        }
        setCourse(c);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.detail : "Could not load course.")
      );
  }, [courseId, router]);

  const resumeHref = useMemo(() => {
    if (!course) return null;
    for (const ch of course.chapters) {
      for (const t of ch.topics) {
        for (const l of t.lessons) {
          if (!l.completed) return `/courses/${course.id}/lessons/${l.id}`;
        }
      }
    }
    const first = course.chapters[0]?.topics[0]?.lessons[0];
    return first ? `/courses/${course.id}/lessons/${first.id}` : null;
  }, [course]);

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-body text-promo">{error}</p>
        <Link href="/dashboard" className="mt-3 inline-block text-btn text-terracotta">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-body text-muted-gray">
        <Loader2 className="h-5 w-5 animate-spin text-terracotta" />
        Loading course…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <TopBar title="Course" backHref="/dashboard" />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-pill bg-terracotta/10 px-3 py-1 text-caption font-medium text-terracotta">
            {difficultyLabel(course.difficulty)}
          </span>
          <span className="rounded-pill bg-light-gray px-3 py-1 text-caption text-body-gray">
            {course.estimated_minutes} min
          </span>
          <span className="rounded-pill bg-light-gray px-3 py-1 text-caption text-body-gray">
            {course.total_lessons} lessons
          </span>
          <span className="rounded-pill bg-light-gray px-3 py-1 text-caption text-body-gray">
            {course.chapters.length} chapters
          </span>
        </div>
        <h1 className="mt-3 text-section text-heading md:text-display md:leading-tight">
          {course.title}
        </h1>
        <p className="mt-2 line-clamp-3 text-body text-body-gray">
          {course.description}
        </p>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-caption text-muted-gray">Progress</span>
            <span className="text-price text-heading">
              {Math.round(course.completion_percent)}%
            </span>
          </div>
          <ProgressBar value={course.completion_percent} />
        </div>
      </div>

      {resumeHref ? (
        <Link href={resumeHref}>
          <PrimaryButton>
            {course.completed_lessons > 0 ? "Resume course" : "Start course"}
          </PrimaryButton>
        </Link>
      ) : null}

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "contents", label: "Contents" },
        ]}
      />

      {tab === "overview" ? (
        <div className="flex flex-col gap-4">
          {course.objectives.length > 0 ? (
            <section className="rounded-card-lg bg-white p-4 shadow-card">
              <h2 className="text-card-title text-heading">Objectives</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {course.objectives.map((o) => (
                  <li key={o} className="flex gap-2 text-body text-body-gray">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.7} />
                    {o}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {course.prerequisites.length > 0 ? (
            <section className="rounded-card-lg bg-white p-4 shadow-card">
              <h2 className="text-card-title text-heading">Prerequisites</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {course.prerequisites.map((p) => (
                  <li key={p} className="text-body text-body-gray">
                    · {p}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {course.chapters.map((chapter) => (
            <section
              key={chapter.id}
              className="rounded-card-lg bg-white p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-card-title text-heading">{chapter.title}</h2>
                  <p className="mt-1 line-clamp-2 text-caption text-muted-gray">
                    {chapter.summary}
                  </p>
                </div>
                <span className="shrink-0 text-price text-heading">
                  {Math.round(chapter.progress_percent)}%
                </span>
              </div>
              <ProgressBar value={chapter.progress_percent} className="mt-3" />
              <div className="mt-3 flex flex-col gap-1">
                {chapter.topics.flatMap((topic) =>
                  topic.lessons.map((lesson) => (
                    <Link
                      key={lesson.id}
                      href={`/courses/${course.id}/lessons/${lesson.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-card-sm px-2 py-2 transition-colors hover:bg-light-gray"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-pill",
                          lesson.completed
                            ? "bg-terracotta text-white"
                            : "bg-light-gray text-muted-gray"
                        )}
                      >
                        {lesson.completed ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        ) : (
                          <span className="text-caption">{lesson.position}</span>
                        )}
                      </span>
                      <span className="truncate text-body text-heading">{lesson.title}</span>
                    </Link>
                  ))
                )}
              </div>
              <Link
                href={`/courses/${course.id}/chapters/${chapter.id}/quiz`}
                className="mt-3 flex items-center gap-2 text-btn text-terracotta"
              >
                <ClipboardList className="h-4 w-4" strokeWidth={1.7} />
                Take quiz
              </Link>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
