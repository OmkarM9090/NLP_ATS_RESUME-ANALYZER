"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevated surface (used for interactive cards). */
  raised?: boolean;
  /** Adds the top sheen gradient. */
  sheen?: boolean;
  /** Draws a hairline accent along the top edge. */
  accent?: "primary" | "secondary" | "success" | "warning" | "danger" | null;
  /** Enables the pointer-tracking spotlight used by feature cards. */
  interactive?: boolean;
  padded?: boolean;
}

const ACCENTS: Record<string, string> = {
  primary: "before:bg-gradient-to-r before:from-primary-500 before:to-primary-300",
  secondary: "before:bg-gradient-to-r before:from-secondary-500 before:to-secondary-300",
  success: "before:bg-gradient-to-r before:from-success before:to-emerald-300",
  warning: "before:bg-gradient-to-r before:from-warning before:to-amber-300",
  danger: "before:bg-gradient-to-r before:from-danger before:to-rose-300",
};

/**
 * Surface primitive: 16px radius, 1px border, layered shadow.
 *
 * `interactive` adds a cursor-following radial highlight driven by CSS custom
 * properties (no JS animation loop) — the "magnetic card" feel from the spec.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { raised, sheen, accent = null, interactive, padded = true, className, children, style, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "group/card relative overflow-hidden transition-colors duration-300",
        raised ? "card-raised" : "card",
        padded && "p-6 sm:p-7",
        sheen && "before:absolute before:inset-0 before:bg-card-sheen before:opacity-70 before:pointer-events-none",
        accent &&
          cn(
            "before:absolute before:inset-x-0 before:top-0 before:h-px before:opacity-70 before:content-['']",
            ACCENTS[accent],
          ),
        interactive &&
          "hover:border-primary-400/45 hover:shadow-glow [background-image:radial-gradient(420px_circle_at_var(--mx,50%)_var(--my,0%),rgba(99,102,241,0.14),transparent_65%)]",
        className,
      )}
      style={style}
      onPointerMove={
        interactive
          ? (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
              event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
            }
          : undefined
      }
      {...props}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h3 className="text-h4 sm:text-h3">{title}</h3>
        {description ? <p className="max-w-prose text-small text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatBlock({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "secondary";
  className?: string;
}) {
  const toneClass = {
    default: "text-ink",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    secondary: "text-secondary-300",
  }[tone];

  return (
    <div className={cn("space-y-1", className)}>
      <p className="label">{label}</p>
      <p className={cn("numeric text-h4", toneClass)}>{value}</p>
      {hint ? <p className="text-small text-ink-faint">{hint}</p> : null}
    </div>
  );
}
