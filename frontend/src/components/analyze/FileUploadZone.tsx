"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, FileText, Upload, Trash2, XCircle } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { gsap } from "@/lib/gsap-config";

export const MAX_UPLOAD_MB = 10;

const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".docx"];
const ACCEPTED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function validateUploadFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const extOk = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const typeOk = file.type !== "" && ACCEPTED_TYPES.includes(file.type);
  if (!extOk && !typeOk) return "Only PDF, TXT or DOCX files are supported.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024)
    return `File exceeds the ${MAX_UPLOAD_MB}MB limit.`;
  return null;
}

/** @deprecated Use {@link validateUploadFile}. */
export const validatePdfFile = validateUploadFile;

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
  const zoneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  /* Pulse the zone whenever the selection state changes. */
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { scale: 0.994 },
      { scale: 1, duration: 0.5, ease: "power3.out", clearProps: "scale" },
    );
  }, [file, error]);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const isPrimary = accent === "primary";

  return (
    <div>
      <div
        ref={zoneRef}
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "group relative flex min-h-[248px] cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl p-7 text-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "border border-dashed bg-void/40",
          error
            ? "border-danger/50 bg-danger/[0.035]"
            : dragging
              ? isPrimary
                ? "border-primary/70 bg-primary/[0.06]"
                : "border-secondary/70 bg-secondary/[0.05]"
              : file
                ? "border-success/40 bg-success/[0.03]"
                : "border-white/[0.12] hover:border-white/[0.22] hover:bg-white/[0.025]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {/* hover / drag glow */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500",
            isPrimary
              ? "bg-[radial-gradient(60%_60%_at_50%_0%,rgba(110,86,248,0.16),transparent)]"
              : "bg-[radial-gradient(60%_60%_at_50%_0%,rgba(36,211,180,0.13),transparent)]",
            dragging ? "opacity-100" : "group-hover:opacity-60",
          )}
        />

        {dragging && (
          <span className="pointer-events-none absolute inset-x-0 top-0 h-8 animate-scanline bg-gradient-to-b from-transparent via-white/[0.07] to-transparent" />
        )}

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col items-center gap-4"
            >
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-success/12 ring-1 ring-success/30">
                <FileText className="h-6 w-6 text-success" strokeWidth={2} />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-success ring-4 ring-night">
                  <CheckCircle2 className="h-3.5 w-3.5 text-night" strokeWidth={3} />
                </span>
              </span>
              <div className="max-w-[240px]">
                <p className="truncate font-display text-[15px] font-semibold tracking-[-0.01em]">
                  {file.name}
                </p>
                <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                  {formatBytes(file.size)} ·{" "}
                  {(file.name.split(".").pop() || "file").toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-mist transition-colors hover:bg-white/[0.06] hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col items-center gap-4"
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-hover:scale-[1.04]",
                  error && "bg-danger/10 ring-danger/30",
                )}
              >
                {error ? (
                  <XCircle className="h-6 w-6 text-danger" strokeWidth={2} />
                ) : (
                  <Upload
                    className={cn(
                      "h-5.5 w-5.5",
                      isPrimary ? "text-primary-2" : "text-secondary",
                    )}
                    strokeWidth={2}
                  />
                )}
              </span>
              <div>
                <p className="font-display text-[15.5px] font-semibold tracking-[-0.01em]">
                  {dragging ? "Release to upload" : label}
                </p>
                <p className="mt-1.5 text-[12.5px] text-faint">{sublabel}</p>
              </div>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-mist/70 transition-colors group-hover:text-ink">
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
            className="mt-2.5 flex items-center gap-1.5 pl-1 text-[12.5px] text-danger"
            role="alert"
          >
            <XCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
