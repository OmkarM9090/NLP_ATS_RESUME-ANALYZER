import type { SVGProps } from "react";

/**
 * Hand-rolled icon set (no icon dependency).
 *
 * Every icon is a 24×24 stroke glyph that inherits `currentColor`, so colour is
 * controlled by Tailwind text utilities at the call site.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...props,
  };
}

export function IconPipeline(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 6h6M3 12h10M3 18h7" />
      <circle cx="17" cy="6" r="2.4" />
      <circle cx="19" cy="12" r="2.4" />
      <circle cx="16" cy="18" r="2.4" />
    </svg>
  );
}

export function IconSemantic(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7.5" cy="7.5" r="3.5" />
      <circle cx="16.5" cy="16.5" r="3.5" />
      <path d="M10 10l4 4M17 6.5l1.5-2M6.5 17L5 19" />
    </svg>
  );
}

export function IconScores(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 19V9M9.3 19V5M14.7 19v-7M20 19v-4" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6l7-3z" />
      <path d="M9.2 12.2l2 2 3.6-3.9" />
    </svg>
  );
}

export function IconGap(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h9M4 12h5M4 17h8" />
      <path d="M16.5 12.5l4 4M20.5 12.5l-4 4" />
    </svg>
  );
}

export function IconTrust(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.6" />
    </svg>
  );
}

export function IconUpload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15" />
    </svg>
  );
}

export function IconFile(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 3H7a1.6 1.6 0 00-1.6 1.6v14.8A1.6 1.6 0 007 21h10a1.6 1.6 0 001.6-1.6V7.6L14 3z" />
      <path d="M13.8 3v4.8h4.8M8.6 13h6.8M8.6 16.6h4.6" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4.5l8.5 15h-17l8.5-15z" />
      <path d="M12 10v4.2M12 17.1h.01" />
    </svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11v5.4M12 7.9h.01" />
    </svg>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 10l4 4 4-4" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h15M13.5 6.5L20 12l-6.5 5.5" />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v11M8 11l4 4 4-4" />
      <path d="M4.5 19h15" />
    </svg>
  );
}

export function IconPrint(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 9V4h10v5" />
      <path d="M5 9h14a2 2 0 012 2v5h-4v4H7v-4H3v-5a2 2 0 012-2z" />
      <path d="M7 16h10" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 12a8 8 0 10-2.6 5.9" />
      <path d="M20 18v-5h-5" />
    </svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z" />
      <path d="M18.5 16.5l.7 1.9 1.8.6-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.6.7-1.9z" />
    </svg>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.6l8.4 4.2-8.4 4.2L3.6 7.8 12 3.6z" />
      <path d="M3.6 12.4L12 16.6l8.4-4.2M3.6 16.6L12 20.8l8.4-4.2" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconGithub(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.3 20.4c-4 1.2-4-2.2-5.6-2.6m11.2 5v-3.4c0-1 .1-1.4-.5-2 2.3-.3 4.6-1.2 4.6-5a3.9 3.9 0 00-1.1-2.7 3.6 3.6 0 00-.1-2.7s-.9-.3-2.9 1.1a9.7 9.7 0 00-5 0C7.9 3.7 7 4 7 4a3.6 3.6 0 00-.1 2.7A3.9 3.9 0 005.8 9.4c0 3.8 2.3 4.7 4.6 5-.6.6-.6 1.2-.5 2V20" />
    </svg>
  );
}

export const FEATURE_ICONS = {
  pipeline: IconPipeline,
  semantic: IconSemantic,
  scores: IconScores,
  shield: IconShield,
  gap: IconGap,
  trust: IconTrust,
} as const;

export type FeatureIconName = keyof typeof FEATURE_ICONS;
