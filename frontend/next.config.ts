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
};

export default nextConfig;
