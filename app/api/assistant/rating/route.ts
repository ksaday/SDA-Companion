import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'

const schema = z.object({
  sessionId: z.string().min(1),
  rating: z.union([z.literal(1), z.literal(-1)]),
  flagReason: z.string().max(1000).optional(),
})

/**
 * Ratings and doctrinal flags feed the moderation queue and the weekly
 * threshold review. A flag marks every recommendation in the session so a
 * reviewer sees the response as the member saw it.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: 'Invalid rating payload' }, { status: 400 })
  }

  const { sessionId, rating, flagReason } = parsed.data

  await db.recommendation.updateMany({
    where: { sessionId },
    data: {
      userRating: rating,
      flagged: Boolean(flagReason),
      flagReason: flagReason ?? null,
    },
  })

  return Response.json({ data: { ok: true } })
}
