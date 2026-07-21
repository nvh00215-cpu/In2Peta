"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import {
  getChapterQuiz,
  getQuizAttempts,
  submitQuizAttempt,
  ApiError,
} from "@/lib/api";
import type { Quiz, QuizAttemptResult, QuizAttemptSummary } from "@/lib/api";
import { TopBar } from "@/components/ds/top-bar";
import { PrimaryButton } from "@/components/ds/primary-button";
import { ProgressBar } from "@/components/ds/progress-bar";
import { cn } from "@/lib/utils";

export default function QuizPage() {
  const params = useParams();
  const courseId = Number(params.id);
  const chapterId = Number(params.chapterId);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [past, setPast] = useState<QuizAttemptSummary[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(chapterId)) return;
    setLoading(true);
    getChapterQuiz(chapterId)
      .then(async (q) => {
        setQuiz(q);
        const attempts = await getQuizAttempts(q.id);
        setPast(attempts);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.detail : "Could not load quiz.")
      )
      .finally(() => setLoading(false));
  }, [chapterId]);

  async function onSubmit() {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const res = await submitQuizAttempt(quiz.id, answers);
      setResult(res);
      setPast((prev) => [
        { id: res.id, score: res.score, taken_at: res.taken_at },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not submit quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  function retake() {
    setResult(null);
    setAnswers({});
    setIndex(0);
    setExpanded(null);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-body text-muted-gray">
        <Loader2 className="h-6 w-6 animate-spin text-terracotta" />
        Generating quiz…
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="py-16 text-center">
        <p className="text-body text-promo">{error}</p>
        <Link href={`/courses/${courseId}`} className="mt-3 inline-block text-btn text-terracotta">
          Back to course
        </Link>
      </div>
    );
  }

  if (!quiz) return null;

  // Checkout blueprint — score summary + expandable result rows
  if (result) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-5">
        <TopBar title="Quiz results" backHref={`/courses/${courseId}`} />
        <div className="rounded-card-lg bg-white p-5 shadow-card">
          <p className="text-caption text-muted-gray">Your score</p>
          <p className="mt-1 text-display text-heading">{Math.round(result.score)}%</p>
          <p className="mt-1 text-body text-body-gray">{quiz.chapter_title}</p>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          {result.results.map((r) => {
            const open = expanded === r.question_id;
            return (
              <button
                key={r.question_id}
                onClick={() => setExpanded(open ? null : r.question_id)}
                className="rounded-card-sm bg-white p-4 text-left shadow-card"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill",
                      r.is_correct ? "bg-terracotta/15 text-terracotta" : "bg-promo/15 text-promo"
                    )}
                  >
                    {r.is_correct ? (
                      <Check className="h-4 w-4" strokeWidth={2} />
                    ) : (
                      <X className="h-4 w-4" strokeWidth={2} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-card-title text-heading">{r.question}</p>
                    <p className="mt-1 text-caption text-muted-gray">
                      Your answer: {r.your_answer || "—"}
                    </p>
                    {open ? (
                      <div className="mt-2 space-y-1 text-body text-body-gray">
                        <p>
                          Correct: <span className="text-heading">{r.correct_answer}</span>
                        </p>
                        <p>{r.explanation}</p>
                      </div>
                    ) : null}
                  </div>
                  {open ? (
                    <ChevronUp className="h-4 w-4 text-muted-gray" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-gray" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {past.length > 1 ? (
          <div>
            <p className="mb-2 text-caption text-muted-gray">Past attempts</p>
            <ul className="space-y-1">
              {past.map((a) => (
                <li
                  key={a.id}
                  className="flex justify-between rounded-card-sm bg-white px-3 py-2 text-caption shadow-card"
                >
                  <span className="text-body-gray">
                    {new Date(a.taken_at).toLocaleString()}
                  </span>
                  <span className="text-price text-heading">{Math.round(a.score)}%</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="sticky bottom-20 space-y-2 bg-off-white pb-2 md:bottom-4">
          <PrimaryButton onClick={retake}>Retry quiz</PrimaryButton>
          <Link
            href={`/courses/${courseId}`}
            className="block text-center text-btn text-body-gray"
          >
            Back to course
          </Link>
        </div>
      </div>
    );
  }

  const q = quiz.questions[index];
  const progress = ((index + 1) / quiz.questions.length) * 100;
  const answer = answers[String(q.id)] ?? "";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-5">
      <TopBar title={quiz.chapter_title} backHref={`/courses/${courseId}`} />

      <div>
        <div className="mb-2 flex justify-between text-caption text-muted-gray">
          <span>
            Question {index + 1} of {quiz.questions.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>

      <div className="flex-1 rounded-card-lg bg-white p-5 shadow-card">
        <p className="text-caption font-medium uppercase tracking-wide text-muted-gray">
          {q.type === "mcq" ? "Multiple choice" : q.type === "tf" ? "True / False" : "Short answer"}
        </p>
        <h1 className="mt-2 text-section text-heading">{q.question}</h1>

        <div className="mt-6 flex flex-col gap-2">
          {q.type === "short" ? (
            <textarea
              value={answer}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [String(q.id)]: e.target.value }))
              }
              rows={4}
              placeholder="Type your answer…"
              className="w-full rounded-card-sm border border-border-gray bg-off-white p-3 text-body text-heading outline-none focus:border-terracotta"
            />
          ) : (
            (q.options ?? []).map((opt) => {
              const selected = answer === opt;
              return (
                <button
                  key={opt}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [String(q.id)]: opt }))
                  }
                  className={cn(
                    "flex min-h-11 items-center rounded-card-sm border px-4 py-3 text-left text-body transition-colors",
                    selected
                      ? "border-terracotta bg-terracotta/10 text-heading"
                      : "border-border-gray bg-off-white text-heading hover:border-terracotta/50"
                  )}
                >
                  {opt}
                </button>
              );
            })
          )}
        </div>
      </div>

      {error ? <p className="text-caption text-promo">{error}</p> : null}

      <div className="sticky bottom-20 flex flex-col gap-2 bg-off-white pb-2 md:bottom-4">
        {index < quiz.questions.length - 1 ? (
          <PrimaryButton onClick={() => setIndex((i) => i + 1)} disabled={!answer.trim()}>
            Next
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => void onSubmit()} disabled={submitting || !answer.trim()}>
            {submitting ? "Submitting…" : "Submit quiz"}
          </PrimaryButton>
        )}
        {index > 0 ? (
          <button
            onClick={() => setIndex((i) => i - 1)}
            className="text-center text-btn text-body-gray"
          >
            Back
          </button>
        ) : null}
      </div>
    </div>
  );
}
