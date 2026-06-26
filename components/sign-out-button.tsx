"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/sign-out", {
        method: "POST",
      });

      if (!response.ok) {
        setError("Sign out failed");
        setIsPending(false);
        return;
      }

      router.replace("/auth/sign-in");
      router.refresh();
    } catch {
      setError("Sign out failed");
      setIsPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        className="text-muted-foreground"
        disabled={isPending}
        onClick={signOut}
        type="button"
        variant="ghost"
        size="sm"
      >
        <LogOut data-icon="inline-start" />
        {isPending ? "Signing out" : "Sign out"}
      </Button>
      {error ? (
        <p role="status" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
