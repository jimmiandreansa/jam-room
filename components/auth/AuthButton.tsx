"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

export function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <span className="text-xs text-jam-muted" aria-hidden>
        …
      </span>
    );
  }

  if (user) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/library"
          className="text-sm text-jam-accent underline-offset-4 hover:underline"
        >
          My Library
        </Link>
        <Button
          type="button"
          variant="ghost"
          className="px-3 py-1.5 text-xs"
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="px-3 py-1.5 text-xs sm:text-sm"
      onClick={() => void signInWithGoogle().catch(console.error)}
    >
      Sign in with Google
    </Button>
  );
}
