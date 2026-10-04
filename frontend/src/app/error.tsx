"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

/**
 * Route-level error boundary. Keeps the failure inside the product shell and
 * offers the two actions that actually help: retry, or start over.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the console for debugging.
    console.error("[resumeai] route error:", error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-32 sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(248,113,113,0.12),transparent)]" />

      <div className="card relative w-full max-w-xl overflow-hidden rounded-3xl p-9 text-center sm:p-12">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 ring-1 ring-danger/25">
          <AlertTriangle className="h-6 w-6 text-danger" strokeWidth={1.9} />
        </span>

        <p className="eyebrow mt-7 justify-center text-danger">
          <span className="h-1 w-1 rounded-full bg-danger" />
          something broke
        </p>

        <h1 className="display-3 mt-4">This view failed to render.</h1>

        <p className="lede mx-auto mt-4 max-w-md text-[15px]">
          The API and your stored analyses are unaffected — retrying usually
          clears it.
        </p>

        {error.message && (
          <p className="mx-auto mt-5 max-w-md truncate rounded-xl border border-white/[0.06] bg-void/50 px-3.5 py-2.5 font-mono text-[11px] text-faint">
            {error.message}
          </p>
        )}

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary h-11 px-5 text-[13.5px]">
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link href="/" className="btn btn-secondary h-11 px-5 text-[13.5px]">
            <Home className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
