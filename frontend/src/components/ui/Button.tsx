"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-500 text-white shadow-glow hover:bg-primary-400 active:bg-primary-600 disabled:bg-primary-500/40",
  secondary:
    "bg-secondary-500 text-bg-deep font-semibold hover:bg-secondary-400 active:bg-secondary-600 disabled:bg-secondary-500/40",
  outline:
    "border border-line bg-surface/60 text-ink hover:border-primary-400/60 hover:bg-surface-raised active:bg-surface",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-raised/70",
  danger: "bg-danger/90 text-white hover:bg-danger active:bg-danger/80",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-small rounded-button gap-1.5",
  md: "h-11 px-5 text-body rounded-button gap-2",
  lg: "h-14 px-7 text-lead rounded-button gap-2.5",
};

const BASE =
  "inline-flex select-none items-center justify-center whitespace-nowrap font-medium " +
  "transition-all duration-200 ease-smooth disabled:cursor-not-allowed disabled:opacity-60 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as a Next `<Link>` instead of a `<button>`. */
  href?: string;
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

/**
 * The single button component used across the marketing site and the app.
 * Radius, height and type scale follow the design tokens (button radius 12px).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    href,
    loading = false,
    fullWidth = false,
    iconLeft,
    iconRight,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  const classes = cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    loading && "cursor-wait",
    className,
  );

  const content = (
    <>
      {loading ? <Spinner className="h-4 w-4" /> : iconLeft}
      <span className="truncate">{children}</span>
      {!loading && iconRight}
    </>
  );

  if (href) {
    const isExternal = /^https?:\/\//.test(href) || href.startsWith("mailto:");
    if (isExternal) {
      return (
        <a
          href={href}
          className={classes}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noreferrer noopener" : undefined}
        >
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block animate-spin-slow rounded-full border-2 border-current border-t-transparent opacity-80",
        className ?? "h-4 w-4",
      )}
      aria-hidden
    />
  );
}
