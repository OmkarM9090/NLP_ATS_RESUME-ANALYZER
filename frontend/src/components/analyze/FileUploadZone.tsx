"use client";

import { useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, FileText, FileUp, Trash2, XCircle } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

export const MAX_UPLOAD_MB = 10;

export function validatePdfFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return "Only PDF files are supported.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024)
    return `File exceeds the ${MAX_UPLOAD_MB}MB limit.`;
  return null;
}

interface Props {
  id: string;
  label: string;
  sublabel: string;
  accent: "primary" | "secondary";
  file: File | null;
  error: string | null;
  disabled?: boolean;
  onFile: (f: File) => void;
  onClear: () => void;
}

export default function FileUploadZone({
  id,
  label,
  sublabel,
  accent,
  file,
  error,
  disabled,
  onFile,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const accentText = accent === "primary" ? "text-indigo-300" : "text-cyan-300";
  const accentBorder =
    accent === "primary" ? "border-primary/70" : "border-secondary/70";

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "group relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300",
          error
            ? "border-danger/60 bg-danger/[0.04]"
            : dragging
              ? cn(accentBorder, "bg-white/[0.05] shadow-[0_0_60px_-20px_rgba(99,102,241,0.5)]")
              : file
                ? "border-success/50 bg-success/[0.04]"
                : "border-line bg-white/[0.015] hover:border-slate-500/60 hover:bg-white/[0.03]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-x-0 h-10 animate-scanline bg-gradient-to-b from-transparent via-primary/25 to-transparent" />
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-3"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15">
                <FileText className="h-6 w-6 text-success" />
              </span>
              <div>
                <p className="max-w-[240px] truncate font-display text-sm font-semibold text-ink">
                  {file.name}
                </p>
                <p className="mt-1 font-mono text-xs text-mist">
                  {formatBytes(file.size)} · PDF
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-mist transition-colors hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-3"
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] transition-transform duration-300 group-hover:scale-110",
                  error && "border-danger/40",
                )}
              >
                {error ? (
                  <XCircle className="h-6 w-6 text-danger" />
                ) : (
                  <FileUp className={cn("h-6 w-6", accentText)} />
                )}
              </span>
              <div>
                <p className="font-display text-base font-semibold text-ink">
                  {dragging ? "Drop it now" : label}
                </p>
                <p className="mt-1 text-xs text-mist">{sublabel}</p>
              </div>
              <span className={cn("text-xs font-medium underline-offset-4 group-hover:underline", accentText)}>
                or click to browse
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="mt-2.5 flex items-center gap-1.5 pl-1 text-xs text-danger"
          >
            <XCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
