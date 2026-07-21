"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Flame, Loader2, Timer, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getDashboard, ApiError } from "@/lib/api";
import type { CourseSummary, DashboardData } from "@/lib/api";
import { humanizeSeconds } from "@/lib/format";
import { SearchBar } from "@/components/ds/search-bar";
import { CategoryPills } from "@/components/ds/category-pills";
import { IconButton } from "@/components/ds/icon-button";
import { IconBadge } from "@/components/ds/icon-badge";
import { PrimaryButton } from "@/components/ds/primary-button";
import { UploadBanner } from "@/components/upload-dropzone";
import { CourseCard } from "@/components/course-card";
import { useCommandPalette } from "@/components/command-palette";

type Filter =
  | "all"
  | "in_progress"
  | "completed"
  | "beginner"
  | "intermediate"
  | "advanced";

/**
 * Home / Browse blueprint — greeting, search, promo upload banner,
 * category pills, 2-col course grid, price-style stats.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { open } = useCommandPalette();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDashboard());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const courses = useMemo(() => {
    const list = data?.courses ?? [];
    return list.filter((c) => {
      if (filter === "all") return true;
      if (filter === "in_progress")
        return c.status === "ready" && c.completion_percent > 0 && c.completion_percent < 100;
      if (filter === "completed") return c.status === "ready" && c.completion_percent >= 100;
      return c.difficulty === filter;
    });
  }, [data, filter]);

  function onDeleted(id: number) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            courses: prev.courses.filter((c: CourseSummary) => c.id !== id),
            stats: { ...prev.stats, courses_count: Math.max(0, prev.stats.courses_count - 1) },
          }
        : prev
    );
  }

  const firstName = user?.name?.split(/\s+/)[0] ?? "there";

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-muted-gray">Welcome back</p>
          <h1 className="truncate text-section text-heading md:text-display md:leading-tight">
            Hi, {firstName}
          </h1>
        </div>
        <IconButton aria-label="Notifications" variant="white" size={44}>
          <Bell className="h-5 w-5" strokeWidth={1.7} />
        </IconButton>
      </div>

      <SearchBar onActivate={open} onFilter={open} />

      <UploadBanner />

      {data?.continue_learning ? (
        <div className="rounded-card-lg bg-white p-4 shadow-card">
          <p className="text-caption text-muted-gray">Continue learning</p>
          <h2 className="mt-1 text-card-title text-heading">
            {data.continue_learning.lesson_title}
          </h2>
          <p className="mt-1 text-caption text-body-gray">
            {data.continue_learning.course_title} · {data.continue_learning.chapter_title}
          </p>
          <div className="mt-4">
            <Link
              href={`/courses/${data.continue_learning.course_id}/lessons/${data.continue_learning.lesson_id}`}
            >
              <PrimaryButton>
                Resume · {Math.round(data.continue_learning.completion_percent)}%
              </PrimaryButton>
            </Link>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: Timer,
              label: "Time",
              value: humanizeSeconds(data.stats.total_seconds_spent),
            },
            { icon: Flame, label: "Streak", value: `${data.stats.streak_days}d` },
            {
              icon: Trophy,
              label: "Quiz avg",
              value:
                data.stats.avg_quiz_score != null
                  ? `${Math.round(data.stats.avg_quiz_score)}%`
                  : "—",
            },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-card-sm bg-white p-3 shadow-card"
            >
              <IconBadge variant="terracotta" size={36}>
                <Icon className="h-4 w-4" strokeWidth={1.7} />
              </IconBadge>
              <p className="mt-3 text-price text-heading">{value}</p>
              <p className="text-caption text-muted-gray">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-section text-heading">My courses</h2>
        <CategoryPills
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "in_progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
            { value: "beginner", label: "Beginner" },
            { value: "intermediate", label: "Intermediate" },
            { value: "advanced", label: "Advanced" },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-body text-muted-gray">
          <Loader2 className="h-5 w-5 animate-spin text-terracotta" />
          Loading courses…
        </div>
      ) : error ? (
        <div className="rounded-card-sm bg-white p-6 text-center shadow-card">
          <p className="text-body text-promo">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 min-h-11 text-btn text-terracotta"
          >
            Retry
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-card-lg bg-white p-8 text-center shadow-card">
          <p className="text-card-title text-heading">No courses yet</p>
          <p className="mt-2 text-body text-body-gray">
            Upload a PDF above to generate your first In2Peta course.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} onDeleted={onDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
