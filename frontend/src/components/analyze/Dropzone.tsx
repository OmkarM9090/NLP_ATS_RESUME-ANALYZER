"use client";

import { useCallback, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { ACCEPT_ATTR, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { ALLOWED_EXTENSIONS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { IconAlert, IconClose, IconFile, IconUpload } from "@/components/ui/Icons";

export interface DropzoneProps {
  label: string;
  description: string;
  /** Accent used for the icon, focus ring and active border. */
  accent?: "primary" | "secondary";
  file: File | null;
  error: string | null;
  onFile: (file: File | null) => string | null;
  onClear: () => void;
  disabled?: boolean;
  hint?: string;
}

const ACCENTS = {
  primary: {
    ring: "border-primary-400/60 bg-primary-500/8",
    icon: "text-primary-300 border-primary-500/35 bg-primary-500/12",
    text: "text-primary-200",
  },
  secondary: {
    ring: "border-secondary-400/60 bg-secondary-500/8",
    icon: "text-secondary-200 border-secondary-500/35 bg-secondary-500/12",
    text: "text-secondary-200",
  },
} as const;

/**
 * Drag-and-drop upload slot with keyboard support.
 *
 * Validation is client-side first (type, size, emptiness) and mirrors the
 * backend rules, so the common mistakes never cost a round trip. The hidden
 * `<input type="file">` is driven by the same handler for the click path.
 */
export function Dropzone({
  label,
  description,
  accent = "primary",
  file,
  error,
  onFile,
  onClear,
  disabled = false,
  hint,
}: DropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const tone = ACCENTS[accent];

  const accept = useCallback(
    (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      // Only the first file is used; multiple selections are a common mistake.
      onFile(incoming[0] ?? null);
    },
    [onFile],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragging(false);
      if (disabled) return;
      accept(event.dataTransfer.files);
    },
    [accept, disabled],
  );

  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const files = Array.from(event.clipboardData.files ?? []);
      if (files.length > 0) {
        event.preventDefault();
        onFile(files[0] ?? null);
      }
    },
    [disabled, onFile],
  );

  const filled = Boolean(file);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-h5">
          {label}
        </label>
        <span className="font-mono text-micro uppercase tracking-[0.14em] text-ink-faint">
          {ALLOWED_EXTENSIONS.join(" · ")} — max {MAX_FILE_SIZE_MB} MB
        </span>
      </div>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={`${label}: choose a file or drop it here`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        onPaste={onPaste}
        className={cn(
          "relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-9 text-center transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          dragging ? tone.ring : error ? "border-danger/55 bg-danger/6" : "border-line bg-surface/55 hover:border-line-strong hover:bg-surface/80",
          filled && !error && "border-solid border-line bg-surface",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            accept(event.target.files);
            // Reset so selecting the same file again still fires onChange.
            event.target.value = "";
          }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {filled ? (
            <motion.div
              key="filled"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full flex-col items-center gap-3"
            >
              <span
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-button border",
                  tone.icon,
                )}
              >
                <IconFile size={22} />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="truncate text-body font-medium text-ink" title={file?.name}>
                  {file?.name}
                </p>
                <p className="numeric text-small text-ink-muted">
                  {file ? formatBytes(file.size) : ""}
                  {file?.type ? ` · ${file.type}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onClear();
                }}
                className="mt-1 inline-flex items-center gap-1.5 rounded-button border border-line px-3 py-1.5 font-mono text-micro uppercase tracking-[0.14em] text-ink-muted transition-colors hover:border-danger/45 hover:text-danger disabled:opacity-50"
              >
                <IconClose size={13} />
                Remove
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-center gap-3"
            >
              <span
                className={cn(
                  "grid h-12 w-12 place-items-center rounded-button border transition-transform duration-200",
                  dragging ? cn(tone.icon, "-translate-y-0.5 scale-105") : "border-line bg-surface-raised text-ink-muted",
                )}
              >
                <IconUpload size={22} />
              </span>
              <div className="space-y-1">
                <p className="text-body text-ink">
                  <span className={cn("font-semibold", tone.text)}>Click to browse</span> or drag a
                  file here
                </p>
                <p className="text-small text-ink-muted">{description}</p>
              </div>
              {hint ? <p className="font-mono text-micro text-ink-faint">{hint}</p> : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2 text-small text-danger"
            role="alert"
          >
            <IconAlert size={15} className="mt-0.5 shrink-0" />
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
