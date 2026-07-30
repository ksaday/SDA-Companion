import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { retriever } from '@/lib/ai/retriever'
import { getCurrentUser } from '@/lib/session'

const schema = z.object({ query: z.string().trim().min(2).max(500) })

/**
 * The curator's trust bridge: shows exactly which chunks the runtime would use
 * for a query, and at what score, before anything is shown to a member.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (user?.role !== 'global_admin') {
    return Response.json({ error: 'Administrators only' }, { status: 403 })
  }

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: 'Enter a query to test' }, { status: 400 })
  }

  const chunks = await retriever.retrieve({ query: parsed.data.query, limit: 12 })

  return Response.json({
    data: chunks.map((c) => ({
      chunkId: c.chunkId,
      score: c.score,
      kind: c.metadata.kind ?? 'unknown',
      sourceTitle: c.sourceTitle,
      notebookLmSourceRef: c.notebookLmSourceRef,
      verified: c.sourceVerified,
      preview: c.content.slice(0, 220),
    })),
  })
}
