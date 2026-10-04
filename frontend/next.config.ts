import type { NextConfig } from "next";

/**
 * The Next.js server proxies every `/api/*` request to the Python FastAPI
 * backend (default http://127.0.0.1:8000). Override with BACKEND_URL when the
 * backend runs elsewhere.
 */
const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  /**
   * The app is developed inside a sandbox and previewed through a proxied
   * host (`<port>-<sandbox>.e2b.app`). Next blocks dev-only resources such as
   * the HMR socket for unknown origins, so allow the preview host (and
   * localhost) explicitly. This only affects `next dev`.
   */
  allowedDevOrigins: [
    "*.e2b.app",
    "*.e2b.dev",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
