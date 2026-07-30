import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { runAssistantStream } from '@/lib/ai/orchestrator'
import { requireUserId } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  query: z.string().trim().min(2).max(2000),
  language: z.string().min(2).max(8).default('en'),
})

export async function POST(req: NextRequest) {
  let parsed
  try {
    parsed = bodySchema.safeParse(await req.json())
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!parsed.success) {
    return Response.json(
      { error: 'Tell me a little more about what you are facing.' },
      { status: 400 }
    )
  }

  const userId = await requireUserId()
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

      try {
        for await (const event of runAssistantStream({
          query: parsed.data.query,
          language: parsed.data.language,
          userId,
        })) {
          send(event)
        }
      } catch (err) {
        console.error('[assistant] pipeline error', err)
        send({
          type: 'error',
          message:
            'Something went wrong reaching the knowledge source. Your words are still here — please try again.',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
