# syntax=docker/dockerfile:1
#
# ATS Resume Matcher — frontend image (Next.js 14 standalone output).

ARG NODE_VERSION=20

# --------------------------------------------------------------------------- #
# Stage 1 — dependencies
# --------------------------------------------------------------------------- #
FROM node:${NODE_VERSION}-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi


# --------------------------------------------------------------------------- #
# Stage 2 — build
# --------------------------------------------------------------------------- #
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Public build-time config. The API base stays same-origin: next.config.mjs
# rewrites /api/* to BACKEND_INTERNAL_URL at runtime.
ARG NEXT_PUBLIC_APP_NAME="ATS Resume Matcher"
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_API_BASE_URL=/api

RUN npm run build


# --------------------------------------------------------------------------- #
# Stage 3 — runtime
# --------------------------------------------------------------------------- #
FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    BACKEND_INTERNAL_URL=http://backend:8000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && apk add --no-cache wget

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
