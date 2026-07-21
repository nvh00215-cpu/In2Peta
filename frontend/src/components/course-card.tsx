"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Clock, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CoverArt } from "@/components/ds/cover-art";
import { ProgressBar } from "@/components/ds/progress-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryButton } from "@/components/ds/primary-button";
import { deleteCourse, ApiError } from "@/lib/api";
import type { CourseSummary } from "@/lib/api";
import { difficultyLabel, formatRelativeTime } from "@/lib/format";

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

/**
 * Udemy-style course card using design-system productCard structure:
 * cover → title → muted meta → progress bar → % + continue.
 */
export function CourseCard({
  course,
  onDeleted,
}: {
  course: CourseSummary;
  onDeleted: (id: number) => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const href =
    course.status === "generating"
      ? `/courses/${course.id}/generating`
      : `/courses/${course.id}`;

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteCourse(course.id);
      toast.success("Course deleted.");
      onDeleted(course.id);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.detail : "Failed to delete course."
      );
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-banner bg-white shadow-card transition-shadow hover:shadow-card-hover">
      <Link href={href} className="relative block">
        <CoverArt seed={course.title} className="aspect-[4/3] w-full sm:aspect-square">
          <span className="absolute left-3 top-3 rounded-pill bg-white/95 px-3 py-1 text-caption font-medium text-heading">
            {difficultyLabel(course.difficulty)}
          </span>
          {course.status === "ready" && isNew(course.created_at) ? (
            <span className="absolute right-3 top-3 rounded-icon bg-promo px-2 py-1 text-caption font-medium text-white">
              New
            </span>
          ) : null}
          {course.status === "failed" ? (
            <span className="absolute right-3 top-3 rounded-icon bg-promo px-2 py-1 text-caption font-medium text-white">
              Failed
            </span>
          ) : null}
          {course.status === "generating" ? (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-pill bg-near-black/60 px-3 py-1 text-caption text-white">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.7} />
              Generating
            </span>
          ) : null}
        </CoverArt>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={href} className="min-w-0">
          <h3 className="line-clamp-2 text-card-title text-heading">
            {course.title}
          </h3>
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-gray">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" strokeWidth={1.7} />
            {course.total_lessons > 0
              ? `${course.total_lessons} lessons`
              : "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.7} />
            {course.estimated_minutes} min
          </span>
        </div>

        <p className="mt-1 text-caption text-muted-gray">
          {formatRelativeTime(course.last_accessed_at)}
        </p>

        {course.status === "ready" ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-caption text-muted-gray">Progress</span>
              <span className="text-price text-heading">
                {Math.round(course.completion_percent)}%
              </span>
            </div>
            <ProgressBar value={course.completion_percent} />
          </div>
        ) : (
          <div className="mt-3">
            <span className="text-price text-heading">
              {course.status === "generating" ? "…" : "—"}
            </span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-end gap-2 pt-3">
          <button
            type="button"
            aria-label="Delete course"
            onClick={() => setConfirmOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-pill text-muted-gray transition-colors hover:bg-light-gray hover:text-heading"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.7} />
          </button>
          <button
            type="button"
            aria-label={`Open ${course.title}`}
            onClick={() => router.push(href)}
            className="flex h-11 w-11 items-center justify-center rounded-pill bg-terracotta text-white transition-colors hover:bg-terracotta-dark"
          >
            <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-card-lg bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-section text-heading">
              Delete this course?
            </DialogTitle>
            <DialogDescription className="text-body text-body-gray">
              “{course.title}” and all of its lessons, quizzes and chat history
              will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-col gap-2">
            <PrimaryButton onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Delete course"
              )}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="min-h-11 w-full py-2 text-body text-body-gray hover:text-heading"
            >
              Keep it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
