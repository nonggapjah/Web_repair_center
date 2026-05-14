# syntax=docker/dockerfile:1.6

# Phase 3 / MON-14 (14-05-2026) — multi-stage build for Azure App Service for Containers.
# Targets: Next.js 16 (standalone output) + Prisma 5 against Azure Postgres.
# Base image is debian-slim (glibc) so Prisma's default binaryTargets work without
# touching the schema. ~80MB compressed runner image.

# ---------- Stage 1: deps ----------
# Install ALL deps (incl. devDeps — `prisma` CLI is a devDep but `next build`
# invokes `prisma generate` which needs it). Cached separately so deps reinstall
# only when package.json/package-lock.json change.
FROM node:20-slim AS deps
WORKDIR /app

# Prisma needs OpenSSL at install time to pick the right query engine binary.
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

# ---------- Stage 2: builder ----------
# Generate Prisma client + run `next build` (which already chains `prisma generate`
# per package.json scripts). Outputs `.next/standalone/` and `.next/static/`.
FROM node:20-slim AS builder
WORKDIR /app

# NEXT_PUBLIC_* are inlined into the CLIENT bundle at build time — they cannot be
# overridden at runtime. Must be passed via --build-arg with REAL values. These
# are PUBLIC by definition (anon key, public IDs), so passing them into the build
# layer is fine. Do NOT pass server-only secrets (LINE_CHANNEL_ACCESS_TOKEN,
# DATABASE_URL credentials, etc.) — those are runtime-only via App Service config.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_LIFF_ID

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_LIFF_ID=$NEXT_PUBLIC_LIFF_ID

# DATABASE_URL is required for `prisma generate` to validate the schema against
# the datasource config — but the value is NOT used at build time. Pass a dummy
# so the build succeeds in CI/CD where no real DB is reachable.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------- Stage 3: runner ----------
# Minimal production image. Only the standalone server, generated Prisma client,
# static assets, and public/ folder. Runs as non-root user.
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Non-root user — App Service runs containers as root by default but explicit
# is better than implicit, and standalone server doesn't need elevated perms.
RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output: server.js + minimal node_modules at the project root.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets (CSS/JS bundles) and public/ are NOT in standalone — copy explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma runtime needs the generated client + schema file. The standalone output
# does NOT include `.prisma/` or the schema, so we copy them in.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# Standalone server entry point. Honors PORT + HOSTNAME from env.
CMD ["node", "server.js"]
