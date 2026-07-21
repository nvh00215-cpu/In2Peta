"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, MessageCircle, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrimaryButton } from "@/components/ds/primary-button";
import { IconBadge } from "@/components/ds/icon-badge";
import { GoogleButton } from "@/components/google-button";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not create account.");
      setLoading(false);
    }
  }

  return (
    <>
      <aside className="hidden w-[42%] shrink-0 flex-col justify-between bg-terracotta p-8 md:flex lg:p-12">
        <Logo onDark href="/" />
        <div>
          <h1 className="text-display text-white">
            Learn from
            <br />
            every PDF
          </h1>
          <p className="mt-3 text-body text-white/80">
            Upload once. Get a structured course with quizzes and a personal AI tutor.
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {[
              { icon: Sparkles, text: "Outline + lessons in minutes" },
              { icon: BookOpenText, text: "Track progress and streaks" },
              { icon: MessageCircle, text: "Ask anything with RAG chat" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-body text-white">
                <IconBadge variant="on-terracotta" size={40}>
                  <Icon className="h-5 w-5" strokeWidth={1.7} />
                </IconBadge>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-caption text-white/60">In2Peta · PDF to e-course</p>
      </aside>

      <div className="flex flex-1 flex-col justify-center px-5 py-10 md:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md rounded-card-lg bg-white p-6 shadow-card md:p-8">
          <div className="mb-6 md:hidden">
            <Logo href="/" />
          </div>
          <h2 className="text-section text-heading">Create account</h2>
          <p className="mt-1 text-body text-body-gray">
            Start learning from your first PDF in minutes.
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-caption font-medium text-heading">Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-[52px] rounded-btn border border-border-gray bg-off-white px-4 text-body text-heading outline-none focus:border-terracotta"
                placeholder="Your name"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-caption font-medium text-heading">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-[52px] rounded-btn border border-border-gray bg-off-white px-4 text-body text-heading outline-none focus:border-terracotta"
                placeholder="you@example.com"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-caption font-medium text-heading">Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[52px] rounded-btn border border-border-gray bg-off-white px-4 text-body text-heading outline-none focus:border-terracotta"
                placeholder="At least 8 characters"
              />
            </label>
            {error ? (
              <p className="rounded-card-sm bg-promo/10 px-3 py-2 text-caption text-promo">
                {error}
              </p>
            ) : null}
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </PrimaryButton>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border-gray" />
            <span className="text-caption text-muted-gray">or</span>
            <span className="h-px flex-1 bg-border-gray" />
          </div>
          <GoogleButton label="Continue with Google" />

          <p className="mt-6 text-center text-caption text-body-gray">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-terracotta">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
