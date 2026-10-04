"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useMagneticEffect } from "@/hooks/useMagnetic";
import { attachSpotlight, revealOnScroll } from "@/lib/anim";

/* ------------------------------------------------------------------ Button */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-[14px]",
  lg: "h-[52px] px-7 text-[15px]",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger",
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
  ...rest
}: ButtonProps) {
  const magRef = useMagneticEffect<HTMLButtonElement>(0.18);
  return (
    <button
      ref={magnetic ? magRef : undefined}
      className={cn("btn", VARIANTS[variant], SIZES[size], className)}
      {...rest}
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
  external = false,
  onClick,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  magnetic?: boolean;
  className?: string;
  children: ReactNode;
  external?: boolean;
  onClick?: () => void;
}) {
  const magRef = useMagneticEffect<HTMLAnchorElement>(0.18);
  return (
    <Link
      href={href}
      ref={magnetic ? magRef : undefined}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={cn("btn", VARIANTS[variant], SIZES[size], className)}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------- Badge */

export type BadgeTone =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "gold";

const TONES: Record<BadgeTone, string> = {
  primary: "border-primary/30 bg-primary/12 text-primary-2",
  secondary: "border-secondary/25 bg-secondary/10 text-secondary",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
  neutral: "border-line-soft bg-tint-2 text-mist",
  gold: "border-accent/25 bg-accent/10 text-accent",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-medium leading-none tracking-tight",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------- Card */

export function GlassCard({
  className,
  children,
  hover = false,
  spotlight = false,
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
  spotlight?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!spotlight || !ref.current) return;
    return attachSpotlight(ref.current);
  }, [spotlight]);

  return (
    <div
      ref={ref}
      className={cn(
        "card relative",
        hover && "card-hover",
        spotlight && "spotlight",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ Section title */

export function SectionHeading({
  kicker,
  title,
  description,
  align = "center",
  className,
  children,
}: {
  kicker?: string;
  title: ReactNode;
  description?: string;
  align?: "center" | "left";
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = el.querySelectorAll("[data-reveal]");
    if (!targets.length) return;
    const tween = revealOnScroll(targets, {
      trigger: el,
      y: 28,
      stagger: 0.1,
      start: "top 86%",
    });
    return () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
    };
  }, []);

  return (
    <div
      ref={ref}
      data-reveal-group
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {kicker && (
        <p data-reveal className="eyebrow mb-4">
          <span className="h-1 w-1 rounded-full bg-secondary" />
          {kicker}
        </p>
      )}
      <h2 data-reveal className="display-2">
        {title}
      </h2>
      {description && (
        <p data-reveal className="lede mt-5">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

/** Small helper so SectionHeading can kick off its own scroll reveal. */

export function GradientText({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn("text-gradient", className)}>{children}</span>;
}

/* ------------------------------------------------------------------ Eyebrow */

export function Kicker({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("eyebrow", className)}>
      <span className="h-1 w-1 rounded-full bg-secondary" />
      {children}
    </p>
  );
}

/* ---------------------------------------------------------------- Hairline */

export function Hairline({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "h-px w-full bg-gradient-to-r from-transparent via-line-strong to-transparent",
        className,
      )}
    />
  );
}
