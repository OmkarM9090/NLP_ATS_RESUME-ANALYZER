/** @type {import('next').NextConfig} */

// The browser only ever calls same-origin `/api/*`; these rewrites proxy that to
// the FastAPI backend so there are no CORS issues in development, in Docker, or
// behind the sandbox preview host.
const backend = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  eslint: {
    // Lint runs separately (`npm run lint`) so a production build is not blocked
    // by a style rule in a container without devDependencies.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
      {
        // FastAPI's interactive docs, proxied for convenience.
        source: "/docs",
        destination: `${backend}/docs`,
      },
      {
        source: "/openapi.json",
        destination: `${backend}/openapi.json`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
