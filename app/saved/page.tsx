import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function SavedPage() {
  const userId = await requireUserId()

  const [prayers, bookmarks] = userId
    ? await Promise.all([
        db.prayer.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        db.bookmark.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      ])
    : [[], []]

  const verses = bookmarks.filter((b) => b.targetType === 'verse')
  const hymns = bookmarks.filter((b) => b.targetType === 'hymn')

  return (
    <div className="space-y-10">
      <div>
        <h1 className="serif text-3xl">Saved</h1>
        <p className="mt-2" style={{ color: 'var(--text-soft)' }}>
          Prayers you kept, and the verses and hymns you bookmarked.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
          Prayers ({prayers.length})
        </h2>
        {prayers.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
            No saved prayers yet.{' '}
            <Link href="/" className="underline">
              Ask the companion
            </Link>
            , then press Save on the prayer it writes.
          </p>
        ) : (
          <ul className="space-y-3">
            {prayers.map((prayer) => (
              <li
                key={prayer.id}
                className="rounded-xl border p-5"
                style={{ borderColor: 'var(--rule)', background: 'var(--surface-raised)' }}
              >
                <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
                  {new Date(prayer.createdAt).toLocaleString()}
                </p>
                <p className="serif mt-1 text-lg">{prayer.title}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-soft)' }}>
                  {prayer.bodyPlain}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            Verses ({verses.length})
          </h2>
          {verses.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
              Nothing bookmarked yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {verses.map((b) => (
                <li key={b.id} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--rule)' }}>
                  {b.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            Hymns ({hymns.length})
          </h2>
          {hymns.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
              Nothing bookmarked yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {hymns.map((b) => (
                <li key={b.id} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--rule)' }}>
                  {b.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
