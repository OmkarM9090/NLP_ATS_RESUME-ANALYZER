"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { clearHistory, deleteHistoryItem, getHistory, toApiError } from "@/lib/api";
import { formatRelative, gradeHex } from "@/lib/format";
import { cn } from "@/lib/cn";
import { toast } from "@/stores/toastStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { IconClose, IconRefresh } from "@/components/ui/Icons";
import type { AnalysisListItem } from "@/types";

/**
 * Recent analyses, loaded from `GET /api/history`.
 *
 * Reopening an item fetches the stored full result and pushes it into the
 * analysis store, so /results renders identically to a fresh run.
 */
export function HistoryList({ limit = 6 }: { limit?: number }) {
  const router = useRouter();
  const loadFromHistory = useAnalysisStore((state) => state.loadFromHistory);

  const [items, setItems] = useState<AnalysisListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const page = await getHistory(1, limit);
      setItems(page.items);
      setTotal(page.total);
      setError(null);
    } catch (cause) {
      const apiError = toApiError(cause);
      // A missing/empty database is not worth alarming the user about.
      setError(apiError.status === 0 ? null : apiError.userMessage);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = async (id: string) => {
    setBusyId(id);
    try {
      await loadFromHistory(id);
      router.push("/results");
    } catch {
      // Toast already raised by the store.
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await deleteHistoryItem(id);
      setItems((previous) => previous.filter((item) => item.id !== id));
      setTotal((previous) => Math.max(0, previous - 1));
      toast.success("Analysis deleted");
    } catch (cause) {
      toast.error("Could not delete that analysis", toApiError(cause).userMessage);
    } finally {
      setBusyId(null);
    }
  };

  const wipe = async () => {
    if (typeof window !== "undefined" && !window.confirm("Delete every saved analysis?")) return;
    try {
      await clearHistory();
      setItems([]);
      setTotal(0);
      toast.success("History cleared");
    } catch (cause) {
      toast.error("Could not clear history", toApiError(cause).userMessage);
    }
  };

  return (
    <section className="card p-0" aria-labelledby="history-heading">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="history-heading" className="text-h5">
            Recent analyses
          </h2>
          <p className="text-small text-ink-muted">
            {loading ? "Loading…" : total > 0 ? `${total} stored run${total === 1 ? "" : "s"}` : "Nothing saved yet"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void refresh()}
            className="grid h-8 w-8 place-items-center rounded-button border border-line text-ink-muted transition-colors hover:text-ink"
            aria-label="Refresh history"
          >
            <IconRefresh size={15} />
          </button>
          {total > 0 ? (
            <button
              type="button"
              onClick={() => void wipe()}
              className="rounded-button border border-line px-2.5 py-1.5 font-mono text-micro uppercase tracking-[0.12em] text-ink-muted transition-colors hover:border-danger/45 hover:text-danger"
            >
              Clear
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="px-5 py-4 text-small text-warning">{error}</p>
      ) : null}

      {loading ? (
        <ul className="space-y-2 p-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="skeleton h-16 w-full" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="px-5 py-6 text-center text-small text-ink-faint">
          Runs you save appear here with their score, grade and top gaps.
        </p>
      ) : (
        <ul className="divide-y divide-line/70">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div
                  className={cn(
                    "group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-raised/60",
                    busyId === item.id && "opacity-60",
                  )}
                >
                  <span
                    className="numeric grid h-11 w-11 shrink-0 place-items-center rounded-pill border text-h5 font-semibold"
                    style={{
                      color: gradeHex(item.grade),
                      borderColor: `${gradeHex(item.grade)}55`,
                      backgroundColor: `${gradeHex(item.grade)}14`,
                    }}
                    aria-hidden
                  >
                    {item.overall_score.toFixed(0)}
                  </span>

                  <button
                    type="button"
                    onClick={() => void open(item.id)}
                    disabled={busyId === item.id}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-small font-medium text-ink group-hover:text-primary-200">
                      {item.resume_filename}
                    </span>
                    <span className="block truncate text-micro text-ink-faint">
                      vs {item.jd_filename} · {formatRelative(item.timestamp)} ·{" "}
                      {item.top_matched_skills.length} matched / {item.top_missing_skills.length}{" "}
                      missing
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void remove(item.id)}
                    disabled={busyId === item.id}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-button text-ink-faint opacity-0 transition-all hover:bg-danger/12 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete analysis of ${item.resume_filename}`}
                  >
                    <IconClose size={15} />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
