"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { PrimaryButton } from "@/components/ds/primary-button";

/**
 * Onboarding / Splash blueprint — full-bleed dark hero, bold 3-line headline
 * in the bottom third, one CTA, decorative pagination dots.
 */
export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-near-black">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 70% 20%, rgba(184,117,74,0.45) 0%, transparent 45%), radial-gradient(circle at 20% 80%, rgba(166,99,58,0.35) 0%, transparent 40%), linear-gradient(180deg, #141414 0%, #1E1E1E 55%, #141414 100%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-4 py-5 sm:px-5 md:px-8">
        <Logo onDark href="/" />
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-btn text-white/80 transition-colors hover:text-white"
        >
          Log in
        </Link>
      </header>

      <div className="relative z-10 flex flex-1 flex-col justify-end px-4 pb-10 sm:px-5 md:mx-auto md:w-full md:max-w-lg md:px-8 md:pb-16 lg:max-w-xl">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(20,20,20,0.85) 40%, #141414 100%)",
          }}
        />
        <div className="relative">
          <h1 className="text-display text-white">
            Turn any PDF
            <br />
            into a course
            <br />
            you can finish.
          </h1>
          <p className="mt-3 max-w-sm text-body text-white/70">
            In2Peta builds lessons, quizzes, and an AI tutor from your document — so you learn, not just read.
          </p>
          <div className="mt-6">
            <Link href="/register" className="block">
              <PrimaryButton>Get started free</PrimaryButton>
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2" aria-hidden>
            <span className="h-2 w-6 rounded-pill bg-terracotta" />
            <span className="h-2 w-2 rounded-pill bg-white/30" />
            <span className="h-2 w-2 rounded-pill bg-white/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
