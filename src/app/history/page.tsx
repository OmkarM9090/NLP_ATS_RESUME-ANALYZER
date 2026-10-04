import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  Sparkles,
} from "lucide-react";
import { listAnalyses } from "@/lib/server/analysis-store";
import { formatDate, scoreColor, scoreLabel } from "@/lib/utils";
import DeleteButton from "@/components/history/DeleteButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Analysis History" };

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
    <main className="relative min-h-screen px-5 pb-24 pt-28 sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(99,102,241,0.12),transparent)]" />

      <div className="relative mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-secondary">
              Stored reports
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Analysis <span className="gradient-text">history</span>
            </h1>
          </div>
          <Link
            href="/analyze"
            className="gradient-1 inline-flex h-11 items-center gap-2 rounded-xl px-5 font-display text-sm font-semibold text-white"
          >
            <Sparkles className="h-4 w-4" /> New analysis
          </Link>
        </div>

        {dbError ? (
          <div className="mt-12 rounded-2xl border border-warning/30 bg-warning/[0.06] p-6 text-sm text-mist">
            History is temporarily unavailable — the database connection
            couldn&apos;t be reached. New analyses still work end-to-end.
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-14 flex flex-col items-center rounded-3xl glass p-14 text-center">
            <HistoryIcon className="h-10 w-10 text-mist/60" />
            <h2 className="mt-5 font-display text-xl font-semibold">No analyses yet</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-mist">
              Your completed analyses are stored here so you can revisit scores,
              gaps, and recommendations anytime.
            </p>
            <Link href="/analyze?sample=1" className="mt-7">
              <span className="inline-flex h-12 items-center gap-2 rounded-xl border border-primary/40 px-7 font-display text-sm font-semibold text-indigo-300 transition-colors hover:bg-primary/10">
                Run the sample analysis <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-6 font-mono text-xs text-mist/70">
              {total} report{total === 1 ? "" : "s"} · page {page} of {pages}
            </p>
            <ul className="mt-4 space-y-3">
              {rows.map((r) => {
                const color = scoreColor(r.overallScore);
                return (
                  <li key={r.id}>
                    <div className="group flex items-center gap-4 rounded-2xl glass px-5 py-4 transition-all duration-300 hover:border-primary/35 hover:bg-white/[0.05]">
                      <div
                        className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border"
                        style={{ borderColor: `${color}55`, background: `${color}14` }}
                      >
                        <span className="font-mono text-lg font-bold leading-none" style={{ color }}>
                          {Math.round(r.overallScore)}
                        </span>
                        <span className="mt-0.5 text-[8px] uppercase tracking-wider text-mist/70">
                          {scoreLabel(r.overallScore).split(" ")[0]}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold text-ink">
                          {r.resumeFilename}
                          <span className="mx-2 font-normal text-mist/50">vs</span>
                          <span className="font-normal text-mist">{r.jdFilename}</span>
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-mist/60">
                          {formatDate(r.createdAt.toISOString())} · id {r.id.slice(0, 8)}
                        </p>
                      </div>

                      <Link
                        href={`/results?id=${r.id}`}
                        className="hidden h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-xs font-medium text-mist transition-all duration-200 hover:border-secondary/50 hover:text-secondary sm:inline-flex"
                      >
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <DeleteButton id={r.id} />
                    </div>
                  </li>
                );
              })}
            </ul>

            {pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                {page > 1 ? (
                  <Link
                    href={`/history?page=${page - 1}`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm text-mist transition-colors hover:text-ink"
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Link>
                ) : (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line/50 px-4 text-sm text-mist/40">
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </span>
                )}
                <span className="font-mono text-xs text-mist">
                  {page} / {pages}
                </span>
                {page < pages ? (
                  <Link
                    href={`/history?page=${page + 1}`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-sm text-mist transition-colors hover:text-ink"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line/50 px-4 text-sm text-mist/40">
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
