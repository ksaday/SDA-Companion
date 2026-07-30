import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, string> = {
  ok: 'Complete',
  partial: 'Partial',
  fallback: 'No match found',
  error: 'Error',
}

export default async function HistoryPage() {
  const userId = await requireUserId()
  const sessions = userId
    ? await db.assistantSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { _count: { select: { recommendations: true } } },
      })
    : []

  return (
    <div>
      <h1 className="serif text-3xl">Your history</h1>
      <p className="mt-2" style={{ color: 'var(--text-soft)' }}>
        Every conversation you have had with the companion, and what it found.
      </p>

      {sessions.length === 0 ? (
        <p className="mt-8 text-sm" style={{ color: 'var(--text-soft)' }}>
          Nothing here yet.{' '}
          <Link href="/" className="underline">
            Ask the companion something
          </Link>{' '}
          and it will appear.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--rule)', background: 'var(--surface-raised)' }}
            >
              <p className="serif text-lg">“{session.queryText}”</p>
              <p className="mt-1.5 text-xs" style={{ color: 'var(--text-soft)' }}>
                {new Date(session.createdAt).toLocaleString()} ·{' '}
                {statusLabel[session.status] ?? session.status} ·{' '}
                {session._count.recommendations} recommendation
                {session._count.recommendations === 1 ? '' : 's'} · confidence{' '}
                {(session.confidence * 100).toFixed(0)}%
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
