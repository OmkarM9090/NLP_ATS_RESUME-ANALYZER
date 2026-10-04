"use client";

import type { ReactNode } from "react";

import { Navbar } from "@/components/landing/Navbar";
import { ToastViewport } from "@/components/ui/ToastViewport";
import { BackendStatusBanner } from "@/components/layout/BackendStatusBanner";
import { useScrollTriggerRouteRefresh } from "@/hooks/useGsapContext";
import { useBackendHealth } from "@/hooks/useBackendHealth";

/**
 * Client shell shared by every route.
 *
 * Owns the three cross-cutting concerns: ScrollTrigger refresh on navigation,
 * the backend health banner, and the global toast viewport.
 */
export function AppShell({ children }: { children: ReactNode }) {
  // Re-measures pinned sections after every client-side navigation.
  useScrollTriggerRouteRefresh();
  const health = useBackendHealth();

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:rounded-button focus:bg-primary-500 focus:px-4 focus:py-2 focus:text-small focus:text-white"
      >
        Skip to content
      </a>

      <Navbar healthDegraded={health.degraded} />
      <BackendStatusBanner health={health} />

      <main id="main" className="relative">
        {children}
      </main>

      <ToastViewport />
    </>
  );
}
