"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getHealth } from "@/lib/api";
import type { HealthResponse } from "@/types";

export interface BackendHealth {
  data: HealthResponse | null;
  /** null = not checked yet, true = reachable, false = unreachable. */
  online: boolean | null;
  degraded: boolean;
  checking: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Polls `GET /api/health` so the UI can show a "backend offline" or "running
 * with fallback models" banner instead of failing on the first upload.
 */
export function useBackendHealth(intervalMs = 45_000): BackendHealth {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const health = await getHealth();
      if (!mounted.current) return;
      setData(health);
      setOnline(true);
      setError(null);
    } catch (cause) {
      if (!mounted.current) return;
      setOnline(false);
      setError(cause instanceof Error ? cause.message : "Backend unreachable");
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void check();

    const timer =
      intervalMs > 0 ? window.setInterval(() => void check(), intervalMs) : null;
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted.current = false;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check, intervalMs]);

  return {
    data,
    online,
    degraded: data?.status === "degraded",
    checking,
    error,
    refetch: () => void check(),
  };
}
