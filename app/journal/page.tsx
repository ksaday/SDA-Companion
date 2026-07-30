import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { JournalComposer } from '@/components/journal/JournalComposer'

export const dynamic = 'force-dynamic'

export default async function JournalPage() {
  const userId = await requireUserId()
  const entries = userId
    ? await db.journalEntry.findMany({
        where: { userId },
        orderBy: { entryDate: 'desc' },
        take: 50,
      })
    : []

  return (
    <div>
      <h1 className="serif text-3xl">Prayer journal</h1>
      <p className="mt-2 mb-6" style={{ color: 'var(--text-soft)' }}>
        Private to you. In production these entries are encrypted at the
        application layer, so not even an administrator can read them.
      </p>

      <JournalComposer />

      {entries.length > 0 && (
        <ul className="mt-8 space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border p-5"
              style={{ borderColor: 'var(--rule)', background: 'var(--surface-raised)' }}
            >
              <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
                {new Date(entry.entryDate).toLocaleString()}
              </p>
              {entry.title && <p className="serif mt-1 text-lg">{entry.title}</p>}
              {/* Rendered as text, never as HTML — user input is never trusted markup. */}
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{entry.bodyHtml}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
