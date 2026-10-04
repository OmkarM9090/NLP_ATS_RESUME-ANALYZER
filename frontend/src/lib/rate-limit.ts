/* Simple in-memory fixed-window rate limiter (per key, e.g. IP). */

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit = 12,
  windowMs = 60_000,
): { ok: boolean; retryAfterS: number; remaining: number } {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfterS: 0, remaining: limit - 1 };
  }

  if (b.count >= limit) {
    return {
      ok: false,
      retryAfterS: Math.max(1, Math.ceil((b.reset - now) / 1000)),
      remaining: 0,
    };
  }

  b.count += 1;
  return { ok: true, retryAfterS: 0, remaining: limit - b.count };
}

// Periodically evict expired buckets to avoid unbounded growth.
if (typeof setInterval !== "undefined") {
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }, 60_000);
  if (typeof t.unref === "function") t.unref();
}
