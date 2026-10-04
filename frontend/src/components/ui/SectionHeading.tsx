"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface SectionHeadingProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
  titleClassName?: string;
  id?: string;
}

/**
 * Standard section header: mono eyebrow, display title, muted description.
 *
 * The `splitRef` hook lets the landing sections hand the <h2> to GSAP's
 * SplitText without the component needing to know about animation.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  titleClassName,
  id,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-3xl space-y-4",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className="eyebrow" data-animate="eyebrow">
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className={cn("text-h2 sm:text-h1", align === "center" && "mx-auto", titleClassName)}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "text-lead text-ink-muted",
            align === "center" && "mx-auto",
          )}
          data-animate="description"
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
