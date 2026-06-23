"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth/client";

export function SignInForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function signInWithGoogle() {
    setIsPending(true);
    setError(null);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: "/auth/sign-in",
      });

      if (result.error) {
        setError(result.error.message || "Google sign in failed");
        setIsPending(false);
      }
    } catch {
      setError("Google sign in failed");
      setIsPending(false);
    }
  }

  return (
    <div className="mt-8 flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={isPending}
        className="inline-flex rounded-md bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Opening Google..." : "Continue with Google"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
