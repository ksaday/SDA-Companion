'use client'

import { useState } from 'react'
import type { Citation } from '@/lib/ai/types'

/**
 * The visible end of the provenance chain. Tapping a chip shows the exact
 * excerpt the claim came from and the NotebookLM source it belongs to.
 */
export function CitationChips({ citations }: { citations: Citation[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (citations.length === 0) return null

  const open = citations.find((c) => c.chunkId === openId) ?? null

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-soft)' }}>
          Source
        </span>
        {citations.map((c) => (
          <button
            key={c.chunkId}
            type="button"
            onClick={() => setOpenId(openId === c.chunkId ? null : c.chunkId)}
            className="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
            style={{
              borderColor: openId === c.chunkId ? 'var(--accent)' : 'var(--rule)',
              background: openId === c.chunkId ? 'var(--accent-quiet)' : 'transparent',
              color: 'var(--text-soft)',
            }}
          >
            {c.sourceTitle}
            {!c.verified && <span style={{ color: 'var(--gold)' }}> · sample</span>}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="mt-2 rounded-lg border p-3 text-xs leading-relaxed"
          style={{
            borderColor: 'var(--rule)',
            background: 'var(--surface-sunken)',
            color: 'var(--text-soft)',
          }}
        >
          <p className="mb-1.5 font-medium" style={{ color: 'var(--text)' }}>
            {open.sourceTitle}
          </p>
          <p className="italic">“{open.snippet}”</p>
          <p className="mt-2 font-mono text-[10px] opacity-70">
            NotebookLM source: {open.notebookLmSourceRef} · chunk {open.chunkId.slice(0, 8)}
          </p>
          {!open.verified && (
            <p className="mt-1.5" style={{ color: 'var(--gold)' }}>
              This source is unverified sample data seeded for development.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
