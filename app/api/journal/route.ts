import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'

const createSchema = z.object({
  title: z.string().trim().max(200).default(''),
  bodyHtml: z.string().min(1).max(50_000),
  tags: z.array(z.string().max(40)).max(20).default([]),
})

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const entries = await db.journalEntry.findMany({
    where: { userId },
    orderBy: { entryDate: 'desc' },
    take: 100,
  })
  return Response.json({ data: entries })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return Response.json({ error: 'Not signed in' }, { status: 401 })

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: 'Invalid journal entry' }, { status: 400 })
  }

  const entry = await db.journalEntry.create({
    data: {
      userId,
      title: parsed.data.title,
      bodyHtml: parsed.data.bodyHtml,
      tags: JSON.stringify(parsed.data.tags),
    },
  })
  return Response.json({ data: entry }, { status: 201 })
}
