import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging is useful locally but logs every statement in production,
    // which is both noisy and a measurable throughput cost.
    log: isProduction ? ['error', 'warn'] : ['query'],
  })

// Reuse one client per process (and across hot reloads in development) instead
// of opening a new connection pool on every module evaluation.
globalForPrisma.prisma = db
