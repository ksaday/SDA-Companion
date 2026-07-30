'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function JournalComposer() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (body.trim().length === 0 || busy) return

    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          // Paragraph-per-line, escaped server-side on render.
          bodyHtml: body,
          tags: [],
        }),
      })
      if (!res.ok) {
        setError('That entry could not be saved. Please try again.')
        return
      }
      setTitle('')
      setBody('')
      router.refresh()
    } catch {
      setError('That entry could not be saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--rule)', background: 'var(--surface-raised)' }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        maxLength={200}
        className="w-full border-b bg-transparent pb-2 text-lg outline-none"
        style={{ borderColor: 'var(--rule)' }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        maxLength={20_000}
        placeholder="Write freely. This entry is private to you."
        className="mt-3 w-full resize-y bg-transparent text-base outline-none"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || body.trim().length === 0}
          className="rounded-full px-4 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {busy ? 'Saving…' : 'Save entry'}
        </button>
        {error && (
          <span className="text-xs" style={{ color: 'var(--gold)' }}>
            {error}
          </span>
        )}
      </div>
    </form>
  )
}
