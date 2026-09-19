# ─────────────────────────────────────────────────────────────────────────────
# Lab44 Platform image
#
#   builder   – installs dependencies and runs `next build`
#   migrator  – Prisma CLI + schema only; used by the one-shot `app-migrate`
#               compose service to create/update the database schema
#   runner    – minimal standalone runtime (default target)
#
# Build a specific stage with:  docker build --target migrator .
# ─────────────────────────────────────────────────────────────────────────────

# ─── Dependencies + build ────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ─── Schema migrator (has the Prisma CLI and prisma/schema.prisma) ───────────
# The runtime image is a standalone Next.js bundle with no Prisma CLI, so schema
# creation needs its own small stage. Compose runs it once before the app starts.
FROM oven/bun:1-alpine AS migrator
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY prisma ./prisma
# `db push` is used because this project has no versioned migrations directory.
# It creates missing tables and never drops data.
CMD ["bunx", "prisma", "db", "push", "--skip-generate"]

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static .next/static
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["bun", "server.js"]
