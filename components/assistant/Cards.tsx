'use client'

import { useState } from 'react'
import { CitationChips } from '@/components/ui/CitationChips'
import { ReadAloud } from '@/components/ui/ReadAloud'
import type {
  HymnRecommendation,
  VerseRecommendation,
  VideoRecommendation,
} from '@/lib/ai/types'

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rise rounded-xl border p-5"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--surface-raised)',
      }}
    >
      {children}
    </div>
  )
}

export function SectionHeading({
  title,
  count,
}: {
  title: string
  count?: number
}) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wider">
      <span style={{ color: 'var(--accent)' }}>{title}</span>
      {count != null && (
        <span className="text-xs font-normal" style={{ color: 'var(--text-soft)' }}>
          {count}
        </span>
      )}
    </h2>
  )
}

function SaveButton({
  targetType,
  targetId,
  label,
  meta,
}: {
  targetType: 'verse' | 'hymn' | 'sermon'
  targetId: string
  label: string
  meta: Record<string, unknown>
}) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, label, meta }),
      })
      const json = await res.json()
      setSaved(Boolean(json?.data?.saved))
    } catch {
      // Leave the button state alone; the member can retry.
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-[var(--accent-quiet)] disabled:opacity-50"
      style={{
        borderColor: saved ? 'var(--accent)' : 'var(--rule)',
        color: saved ? 'var(--accent)' : 'var(--text-soft)',
      }}
    >
      {saved ? '★ Saved' : '☆ Save'}
    </button>
  )
}

export function HymnCard({ hymn }: { hymn: HymnRecommendation }) {
  const readable = `${hymn.title}, hymn number ${hymn.hymnNumber}. ${hymn.reason}`
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="serif text-xl">{hymn.title}</h3>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-soft)' }}>
            No. {hymn.hymnNumber} · {hymn.hymnalEdition.replace(/_/g, ' ')}
            {!hymn.verified && (
              <span style={{ color: 'var(--gold)' }}> · number unverified</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <ReadAloud text={readable} label="Read" />
          <SaveButton
            targetType="hymn"
            targetId={`${hymn.hymnalEdition}:${hymn.hymnNumber}`}
            label={`${hymn.title} (No. ${hymn.hymnNumber})`}
            meta={{ ...hymn }}
          />
        </div>
      </div>
      <p className="mt-3 leading-relaxed" style={{ color: 'var(--text)' }}>
        {hymn.reason}
      </p>
      <CitationChips citations={hymn.citations} />
    </Panel>
  )
}

export function VerseCard({ verse }: { verse: VerseRecommendation }) {
  const readable = `${verse.reference}. ${verse.text}. ${verse.explanation}`
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="serif text-xl">
          {verse.reference}{' '}
          <span className="text-sm font-normal" style={{ color: 'var(--text-soft)' }}>
            {verse.translation}
          </span>
        </h3>
        <div className="flex gap-2">
          <ReadAloud text={readable} label="Read" />
          <SaveButton
            targetType="verse"
            targetId={verse.reference}
            label={verse.reference}
            meta={{ ...verse }}
          />
        </div>
      </div>

      <blockquote
        className="serif mt-3 border-l-2 pl-4 text-lg leading-relaxed"
        style={{ borderColor: 'var(--gold)' }}
      >
        {verse.text}
      </blockquote>

      {verse.explanation && (
        <p className="mt-3 leading-relaxed">{verse.explanation}</p>
      )}
      <p className="mt-2 text-sm" style={{ color: 'var(--text-soft)' }}>
        {verse.relevance}
      </p>
      <CitationChips citations={verse.citations} />
    </Panel>
  )
}

export function VideoCard({ video }: { video: VideoRecommendation }) {
  return (
    <Panel>
      <h3 className="serif text-xl">{video.title}</h3>
      <p className="mt-0.5 text-sm" style={{ color: 'var(--text-soft)' }}>
        {video.speaker}
      </p>

      {video.youtubeId ? (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
            title={video.title}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div
          className="mt-3 flex aspect-video w-full items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm"
          style={{ borderColor: 'var(--rule)', color: 'var(--text-soft)' }}
        >
          <span>
            A matching video reference exists in the corpus, but it carries no
            playable URL yet. Nothing is embedded until a verified URL arrives
            with the source sync.
          </span>
        </div>
      )}

      <CitationChips citations={video.citations} />
    </Panel>
  )
}
