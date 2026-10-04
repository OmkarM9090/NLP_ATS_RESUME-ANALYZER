"use client";

import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/cn";
import { useToastStore } from "@/stores/toastStore";
import type { ToastKind } from "@/types";
import { IconAlert, IconCheck, IconClose, IconInfo } from "@/components/ui/Icons";

const KIND_STYLES: Record<ToastKind, { ring: string; icon: string; Icon: typeof IconCheck }> = {
  success: { ring: "border-success/40", icon: "text-success", Icon: IconCheck },
  error: { ring: "border-danger/45", icon: "text-danger", Icon: IconAlert },
  warning: { ring: "border-warning/45", icon: "text-warning", Icon: IconAlert },
  info: { ring: "border-secondary/40", icon: "text-secondary-300", Icon: IconInfo },
};

/**
 * Fixed toast stack (bottom-right on desktop, full width on mobile).
 *
 * Rendered once in the root layout; any code path can push via `toast.*`
 * helpers, including axios error normalisation.
 */
export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2.5 p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end sm:p-0"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((entry) => {
          const style = KIND_STYLES[entry.kind] ?? KIND_STYLES.info;
          const Icon = style.Icon;
          return (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border bg-surface-overlay p-4 shadow-raised backdrop-blur-md",
                style.ring,
              )}
              role="status"
              aria-live="polite"
            >
              <span className={cn("mt-0.5 shrink-0", style.icon)}>
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-small font-semibold text-ink">{entry.title}</p>
                {entry.message ? (
                  <p className="text-small leading-relaxed text-ink-muted">{entry.message}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(entry.id)}
                className="shrink-0 rounded-button p-1 text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
                aria-label="Dismiss notification"
              >
                <IconClose size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
