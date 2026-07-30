import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7 moved the Migrate connection URL out of schema.prisma into this file.
// The runtime client gets its connection from the driver adapter in lib/db.ts.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
})
