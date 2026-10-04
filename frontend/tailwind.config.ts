import type { Config } from "tailwindcss";

/**
 * Design system tokens.
 *
 * Colours, type scale, radii and spacing come straight from the product spec so
 * every component reads from one source of truth.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    screens: {
      sm: "480px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    container: {
      center: true,
      // Spec: max content width 1280px.
      screens: { xl: "1280px", "2xl": "1280px" },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6366F1",
          50: "#EEF0FF",
          100: "#DDE0FE",
          200: "#BBC0FD",
          300: "#99A0FB",
          400: "#7C83F6",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4138C4",
          800: "#352E9C",
          900: "#2A2575",
        },
        secondary: {
          DEFAULT: "#06B6D4",
          50: "#ECFEFF",
          100: "#CFFAFE",
          200: "#A5F3FC",
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
          700: "#0E7490",
          800: "#155E75",
          900: "#164E63",
        },
        success: { DEFAULT: "#10B981", soft: "rgba(16,185,129,0.12)" },
        warning: { DEFAULT: "#F59E0B", soft: "rgba(245,158,11,0.12)" },
        danger: { DEFAULT: "#EF4444", soft: "rgba(239,68,68,0.12)" },
        bg: {
          DEFAULT: "#0A0A0F",
          deep: "#07070B",
        },
        surface: {
          DEFAULT: "#12121A",
          raised: "#1A1A2E",
          overlay: "rgba(18,18,26,0.85)",
        },
        ink: {
          DEFAULT: "#F8FAFC",
          muted: "#94A3B8",
          faint: "#64748B",
        },
        line: {
          DEFAULT: "#1E293B",
          soft: "#172033",
          strong: "#2A3A52",
        },
      },
      fontFamily: {
        // Headings — geometric grotesque (General Sans substitute, see README).
        heading: ["var(--font-heading)", "General Sans", "system-ui", "sans-serif"],
        // Body — neutral grotesque (Satoshi substitute, see README).
        body: ["var(--font-body)", "Satoshi", "system-ui", "sans-serif"],
        // Numeric/data readouts.
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Spec type scale: H1 72px down to Micro 12px.
        display: ["72px", { lineHeight: "1.02", letterSpacing: "-0.03em", fontWeight: "600" }],
        h1: ["56px", { lineHeight: "1.06", letterSpacing: "-0.025em", fontWeight: "600" }],
        h2: ["44px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
        h3: ["32px", { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "600" }],
        h4: ["24px", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        h5: ["20px", { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "600" }],
        lead: ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        body: ["16px", { lineHeight: "1.65", fontWeight: "400" }],
        small: ["14px", { lineHeight: "1.55", fontWeight: "400" }],
        micro: ["12px", { lineHeight: "1.45", letterSpacing: "0.04em", fontWeight: "500" }],
      },
      borderRadius: {
        // Spec: cards 16px, buttons 12px.
        card: "16px",
        button: "12px",
        pill: "999px",
      },
      maxWidth: {
        content: "1280px",
        prose: "68ch",
      },
      spacing: {
        // Spec section padding: desktop 120 / tablet 80 / mobile 60.
        section: "60px",
        "section-md": "80px",
        "section-lg": "120px",
        gutter: "24px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -12px rgba(0,0,0,0.65)",
        raised: "0 2px 4px rgba(0,0,0,0.45), 0 24px 48px -16px rgba(0,0,0,0.75)",
        glow: "0 0 0 1px rgba(99,102,241,0.35), 0 18px 48px -18px rgba(99,102,241,0.55)",
        inset: "inset 0 1px 0 rgba(248,250,252,0.06)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(30,41,59,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(30,41,59,0.45) 1px, transparent 1px)",
        "hero-glow":
          "radial-gradient(60% 55% at 50% 0%, rgba(99,102,241,0.28) 0%, rgba(6,182,212,0.10) 45%, transparent 75%)",
        "card-sheen":
          "linear-gradient(145deg, rgba(248,250,252,0.06) 0%, rgba(248,250,252,0) 42%)",
      },
      backgroundSize: {
        grid: "56px 56px",
      },
      transitionTimingFunction: {
        // Signature easing used across the GSAP timelines.
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(99,102,241,0.45)" },
          "70%": { boxShadow: "0 0 0 16px rgba(99,102,241,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(99,102,241,0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-480px 0" },
          "100%": { backgroundPosition: "480px 0" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 600ms cubic-bezier(0.16,1,0.3,1) both",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
        marquee: "marquee 34s linear infinite",
        shimmer: "shimmer 1.8s linear infinite",
        "spin-slow": "spin-slow 14s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
