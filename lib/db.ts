import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Prisma 7 takes the connection through a driver adapter rather than from
// schema.prisma. Swapping to Postgres later means swapping this adapter for
// `@prisma/adapter-pg` — no call sites change.
const connectionUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: connectionUrl }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
