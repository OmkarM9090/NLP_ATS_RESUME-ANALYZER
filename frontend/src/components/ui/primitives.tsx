"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMagneticEffect } from "@/hooks/useMagnetic";

/* ------------------------------ Button ------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold tracking-tight transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-45 disabled:pointer-events-none select-none cursor-pointer";

const btnVariants: Record<ButtonVariant, string> = {
  primary:
    "gradient-1 text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.55)] hover:shadow-[0_12px_44px_-6px_rgba(99,102,241,0.75)] hover:-translate-y-0.5 active:translate-y-0",
  secondary:
    "bg-panel2 text-ink border border-line hover:border-primary/50 hover:bg-panel2/80 hover:-translate-y-0.5",
  outline:
    "border border-slate-500/40 text-ink hover:border-secondary/70 hover:text-secondary hover:-translate-y-0.5 backdrop-blur-sm",
  ghost: "text-mist hover:text-ink hover:bg-white/5",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
};

const btnSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[15px]",
  lg: "h-14 px-8 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  magnetic?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  magnetic = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const magRef = useMagneticEffect<HTMLButtonElement>(0.25);
  return (
    <button
      ref={magnetic ? magRef : undefined}
      className={cn(btnBase, btnVariants[variant], btnSizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  magnetic = false,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  magnetic?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const magRef = useMagneticEffect<HTMLAnchorElement>(0.25);
  return (
    <Link
      href={href}
      ref={magnetic ? magRef : undefined}
      className={cn(btnBase, btnVariants[variant], btnSizes[size], className)}
    >
      {children}
    </Link>
  );
}

/* ------------------------------- Cards ------------------------------ */

export function GlassCard({
  className,
  children,
  hover = false,
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass rounded-2xl",
        hover &&
          "transition-all duration-500 hover:border-primary/40 hover:bg-white/[0.045] hover:shadow-[0_20px_60px_-20px_rgba(99,102,241,0.35)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------- Badge ------------------------------ */

export type BadgeTone =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

const badgeTones: Record<BadgeTone, string> = {
  primary: "bg-primary/15 text-indigo-300 border-primary/30",
  secondary: "bg-secondary/15 text-cyan-300 border-secondary/30",
  success: "bg-success/15 text-emerald-300 border-success/30",
  warning: "bg-warning/15 text-amber-300 border-warning/30",
  danger: "bg-danger/15 text-red-300 border-danger/30",
  neutral: "bg-white/5 text-mist border-line",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------- Gradient text -------------------------- */

export function GradientText({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn("gradient-text", className)}>{children}</span>;
}

/* -------------------------- Section heading ------------------------- */

export function SectionHeading({
  kicker,
  title,
  description,
  align = "center",
  className,
}: {
  kicker?: string;
  title: ReactNode;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {kicker && (
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-secondary">
          {kicker}
        </p>
      )}
      <h2 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-base leading-relaxed text-mist sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
