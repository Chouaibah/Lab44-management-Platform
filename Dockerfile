# Build stage
FROM docker.io/node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
COPY package*.json .env ./
COPY prisma ./prisma
# Install build dependencies
RUN npm install -g bun
RUN bun install
COPY . .
RUN bun run build
# Production stage
FROM docker.io/oven/bun:alpine AS runner
WORKDIR /app
# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static .next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/.env ./.env
EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENTRYPOINT ["bun", "server.js"]
