"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PrimaryButton } from "@/components/ds/primary-button";
import { useAuth } from "@/lib/auth-context";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const token = searchParams.get("token");
    if (!token) {
      setError("No sign-in token was provided. Please try logging in again.");
      return;
    }
    setToken(token)
      .then(() => router.replace("/dashboard"))
      .catch(() => setError("We could not verify your sign-in. Please try again."));
  }, [searchParams, setToken, router]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-md rounded-card-lg bg-white p-6 text-center shadow-card">
        <h1 className="text-section text-heading">Sign-in failed</h1>
        <p className="mt-2 text-body text-body-gray">{error}</p>
        <div className="mt-6">
          <Link href="/login">
            <PrimaryButton>Back to login</PrimaryButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-body text-white/80">
      <Loader2 className="h-6 w-6 animate-spin text-terracotta" />
      Signing you in…
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-near-black px-5">
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-3 text-body text-white/80">
            <Loader2 className="h-6 w-6 animate-spin text-terracotta" />
            Signing you in…
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
