import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  Sparkles,
} from "lucide-react";
import { listAnalyses } from "@/lib/analysis-store";
import HistoryList from "@/components/history/HistoryList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Analysis history" };

const PAGE_SIZE = 10;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  let rows: Awaited<ReturnType<typeof listAnalyses>>["rows"] = [];
  let total = 0;
  let dbError = false;
  try {
    const data = await listAnalyses(page, PAGE_SIZE);
    rows = data.rows;
    total = data.total;
  } catch {
    dbError = true;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="relative min-h-screen px-5 pb-24 pt-28 sm:px-8 lg:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(110,86,248,0.13),transparent)]" />

      <div className="relative mx-auto max-w-4xl">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">
              <span className="h-1 w-1 rounded-full bg-secondary" />
              stored reports
            </p>
            <h1 className="display-3 mt-4">
              Analysis <span className="text-gradient">history</span>
            </h1>
            <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-mist">
              Every completed analysis is persisted so you can revisit the score,
              the gaps and the fix list without re-uploading anything.
            </p>
          </div>

          <Link href="/analyze" className="btn btn-primary group h-11 px-5 text-[13.5px]">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
            New analysis
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </header>

        {dbError ? (
          <div className="mt-12 flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] p-6">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-warning" />
            <p className="text-[13.5px] leading-relaxed text-mist">
              History is temporarily unavailable — the database connection
              couldn&apos;t be reached. New analyses still work end-to-end.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="card mt-12 flex flex-col items-center rounded-3xl px-8 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08]">
              <HistoryIcon className="h-6 w-6 text-faint" strokeWidth={1.8} />
            </span>
            <h2 className="mt-6 font-display text-[19px] font-semibold tracking-[-0.02em]">
              No reports stored yet
            </h2>
            <p className="mt-2.5 max-w-sm text-[13.5px] leading-relaxed text-mist">
              Run an analysis and it will appear here — with the full score
              breakdown, gaps and recommendations attached.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/analyze?sample=1" className="btn btn-primary h-11 px-5 text-[13.5px]">
                <Sparkles className="h-3.5 w-3.5" />
                Run the sample pair
              </Link>
              <Link href="/analyze" className="btn btn-secondary h-11 px-5 text-[13.5px]">
                Upload my documents
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-10 flex items-center gap-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                {total} report{total === 1 ? "" : "s"} · page {page} of {pages}
              </p>
              <span className="h-px flex-1 bg-gradient-to-r from-white/[0.1] to-transparent" />
            </div>

            <HistoryList rows={rows} />

            {pages > 1 && (
              <div className="mt-9 flex items-center justify-center gap-3">
                {page > 1 ? (
                  <Link href={`/history?page=${page - 1}`} className="btn btn-secondary h-10 px-4 text-[13px]">
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Link>
                ) : (
                  <span className="btn btn-secondary h-10 cursor-not-allowed px-4 text-[13px] opacity-40">
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </span>
                )}
                <span className="font-mono text-[11px] tabular-nums text-faint">
                  {page} / {pages}
                </span>
                {page < pages ? (
                  <Link href={`/history?page=${page + 1}`} className="btn btn-secondary h-10 px-4 text-[13px]">
                    Next <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="btn btn-secondary h-10 cursor-not-allowed px-4 text-[13px] opacity-40">
                    Next <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
