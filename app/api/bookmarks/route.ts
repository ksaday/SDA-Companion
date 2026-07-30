import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'

const schema = z.object({
  targetType: z.enum(['verse', 'hymn', 'sermon']),
  targetId: z.string().min(1).max(200),
  label: z.string().min(1).max(300),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const bookmarks = await db.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return Response.json({ data: bookmarks })
}

/** Idempotent toggle: saving an already-saved item removes it. */
export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: 'Invalid bookmark payload' }, { status: 400 })
  }

  const { targetType, targetId, label, meta } = parsed.data
  const existing = await db.bookmark.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
  })

  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } })
    return Response.json({ data: { saved: false } })
  }

  await db.bookmark.create({
    data: { userId, targetType, targetId, label, meta: JSON.stringify(meta ?? {}) },
  })
  return Response.json({ data: { saved: true } }, { status: 201 })
}
