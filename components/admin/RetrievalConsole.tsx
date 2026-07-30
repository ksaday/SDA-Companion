'use client'

import { useState } from 'react'

interface Row {
  chunkId: string
  score: number
  kind: string
  sourceTitle: string
  notebookLmSourceRef: string
  verified: boolean
  preview: string
}

export function RetrievalConsole({
  includeThreshold,
}: {
  includeThreshold: number
}) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim().length < 2 || busy) return

    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/test-retrieval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? 'The retrieval test failed.')
        setRows(null)
        return
      }
      setRows(json.data as Row[])
    } catch {
      setError('The retrieval test failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--rule)', background: 'var(--surface-raised)' }}
    >
      <h2 className="serif text-xl">Retrieval test console</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>
        Run a member's phrasing and see exactly which chunks the assistant would
        use. Rows below {(includeThreshold * 100).toFixed(0)}% are dropped before
        anything reaches a member.
      </p>

      <form onSubmit={run} className="mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="I lost my job"
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          style={{ borderColor: 'var(--rule)', background: 'var(--surface)' }}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {busy ? 'Running…' : 'Test'}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm" style={{ color: 'var(--gold)' }}>
          {error}
        </p>
      )}

      {rows && rows.length === 0 && (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-soft)' }}>
          No chunks matched at all — a member asking this would get the fallback
          message. This is what a corpus gap looks like.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => {
            const passes = row.score >= includeThreshold
            return (
              <li
                key={row.chunkId}
                className="rounded-lg border p-3 text-sm"
                style={{
                  borderColor: passes ? 'var(--accent)' : 'var(--rule)',
                  opacity: passes ? 1 : 0.55,
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: passes ? 'var(--accent-quiet)' : 'transparent',
                      color: passes ? 'var(--accent)' : 'var(--text-soft)',
                    }}
                  >
                    {(row.score * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-soft)' }}>
                    {row.kind}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
                    {row.sourceTitle}
                  </span>
                  {!row.verified && (
                    <span className="text-xs" style={{ color: 'var(--gold)' }}>
                      unverified
                    </span>
                  )}
                  {!passes && (
                    <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
                      · dropped
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-soft)' }}>
                  {row.preview}…
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
