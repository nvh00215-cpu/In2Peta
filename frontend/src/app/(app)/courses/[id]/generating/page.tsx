"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { deleteCourse, getCourseStatus, ApiError } from "@/lib/api";
import type { CourseStatusResponse } from "@/lib/api";
import { TopBar } from "@/components/ds/top-bar";
import { PrimaryButton } from "@/components/ds/primary-button";
import { cn } from "@/lib/utils";

const PIPELINE = [
  "Extracting text",
  "Indexing content",
  "Building course outline",
  "Writing lessons",
  "Finalizing",
];

function stageIndex(stage: string | null): number {
  if (!stage) return 0;
  const s = stage.toLowerCase();
  if (s.includes("extract")) return 0;
  if (s.includes("index")) return 1;
  if (s.includes("outline") || s.includes("building")) return 2;
  if (s.includes("writing") || s.includes("chapter") || s.includes("lesson")) return 3;
  if (s.includes("final") || s === "done") return 4;
  if (s.includes("queued")) return 0;
  return 2;
}

export default function GeneratingPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = Number(params.id);
  const [status, setStatus] = useState<CourseStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(courseId)) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await getCourseStatus(courseId);
        if (cancelled) return;
        setStatus(res);
        if (res.status === "ready") {
          router.replace(`/courses/${courseId}`);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.detail : "Could not poll status.");
      }
    }
    void poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [courseId, router]);

  const current = stageIndex(status?.generation_stage ?? null);
  const failed = status?.status === "failed";

  async function handleDelete() {
    try {
      await deleteCourse(courseId);
      router.push("/dashboard");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="-mx-4 -mt-4 flex min-h-[calc(100vh-4rem)] flex-col bg-near-black px-4 pb-8 md:-mx-5 md:px-5">
      <TopBar title="Generating course" backHref="/dashboard" onDark />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        {error ? (
          <p className="text-center text-body text-promo">{error}</p>
        ) : failed ? (
          <div className="rounded-card-lg bg-charcoal p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-promo/20 text-promo">
              <X className="h-6 w-6" strokeWidth={1.7} />
            </div>
            <h1 className="mt-4 text-section text-white">Generation failed</h1>
            <p className="mt-2 text-body text-white/70">
              {status?.error ?? "Something went wrong while building your course."}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <PrimaryButton onClick={handleDelete}>Delete & go back</PrimaryButton>
              <Link href="/dashboard" className="text-center text-btn text-white/70">
                Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill bg-terracotta/20">
                <Loader2 className="h-7 w-7 animate-spin text-terracotta" strokeWidth={1.7} />
              </div>
              <h1 className="mt-4 text-section text-white">Building your course</h1>
              <p className="mt-2 text-body text-white/70">
                {status?.generation_stage ?? "Queued"}
              </p>
            </div>

            <ul className="mt-8 flex flex-col gap-3">
              {PIPELINE.map((label, i) => {
                const done = i < current || status?.generation_stage === "Done";
                const active = i === current && status?.generation_stage !== "Done";
                return (
                  <li
                    key={label}
                    className={cn(
                      "flex items-center gap-3 rounded-card-sm px-4 py-3",
                      active ? "bg-terracotta/20" : "bg-white/5"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-pill",
                        done
                          ? "bg-terracotta text-white"
                          : active
                            ? "bg-terracotta text-white"
                            : "bg-white/10 text-white/40"
                      )}
                    >
                      {done ? (
                        <Check className="h-4 w-4" strokeWidth={2} />
                      ) : active ? (
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.7} />
                      ) : (
                        <span className="text-caption">{i + 1}</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-body",
                        done || active ? "text-white" : "text-white/40"
                      )}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
