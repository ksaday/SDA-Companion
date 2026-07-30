import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  bodyHtml: z.string().min(1).max(50_000),
  bodyPlain: z.string().min(1).max(50_000),
  originalHtml: z.string().max(50_000).optional(),
  sessionId: z.string().optional(),
})

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const prayers = await db.prayer.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return Response.json({ data: prayers })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: 'Invalid prayer payload' }, { status: 400 })
  }

  const prayer = await db.prayer.create({
    data: { ...parsed.data, userId },
  })
  return Response.json({ data: prayer }, { status: 201 })
}
