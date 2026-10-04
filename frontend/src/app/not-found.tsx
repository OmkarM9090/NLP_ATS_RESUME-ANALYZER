import Link from "next/link";
import { ArrowLeft, Compass, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-32 sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] ambient-top" />

      <div className="card relative w-full max-w-xl overflow-hidden rounded-3xl p-9 text-center sm:p-12">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-tint-2 ring-1 ring-line-soft">
          <FileQuestion className="h-6 w-6 text-faint" strokeWidth={1.8} />
        </span>

        <p className="eyebrow mt-7 justify-center">
          <span className="h-1 w-1 rounded-full bg-secondary" />
          error 404
        </p>

        <h1 className="display-3 mt-4">
          That page isn&apos;t in the{" "}
          <span className="text-gradient">index.</span>
        </h1>

        <p className="lede mx-auto mt-4 max-w-md text-[15px]">
          The link may be stale or mistyped. Your last analysis is still in
          session history if you need it.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn btn-primary h-11 px-5 text-[13.5px]">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link href="/analyze" className="btn btn-secondary h-11 px-5 text-[13.5px]">
            <Compass className="h-4 w-4 text-secondary" />
            Start an analysis
          </Link>
        </div>

        <div className="mt-10 border-t border-line-soft pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
            resumeai · ats intelligence
          </p>
        </div>
      </div>
    </main>
  );
}
