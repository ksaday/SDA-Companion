'use client'

import { useRef, useState } from 'react'
import { HymnCard, SectionHeading, VerseCard, VideoCard } from './Cards'
import { PrayerEditor } from './PrayerEditor'
import type {
  AssistantEvent,
  AssistantResult,
  HymnRecommendation,
  PrayerResult,
  VerseRecommendation,
  VideoRecommendation,
} from '@/lib/ai/types'

const EXAMPLES = [
  "I'm feeling anxious.",
  'I lost my job.',
  'I need wisdom.',
  'My family is struggling.',
  'I want to thank God.',
  "I'm discouraged.",
  'I need strength.',
]

interface ResultState {
  hymns: HymnRecommendation[]
  verses: VerseRecommendation[]
  videos: VideoRecommendation[]
  prayer: PrayerResult | null
  summary: AssistantResult | null
  fallback: string | null
  error: string | null
}

const EMPTY: ResultState = {
  hymns: [],
  verses: [],
  videos: [],
  prayer: null,
  summary: null,
  fallback: null,
  error: null,
}

export function AssistantClient({ corpusIsSample }: { corpusIsSample: boolean }) {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [result, setResult] = useState<ResultState>(EMPTY)
  const [rated, setRated] = useState<null | 'up' | 'down'>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  async function ask(text: string) {
    const trimmed = text.trim()
    if (trimmed.length < 2 || busy) return

    setBusy(true)
    setSubmitted(trimmed)
    setResult(EMPTY)
    setRated(null)
    setStage('Reading what you wrote…')

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, language: 'en' }),
      })

      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => null)
        setResult({ ...EMPTY, error: detail?.error ?? 'The companion could not be reached.' })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          const line = frame.trim()
          if (!line.startsWith('data:')) continue

          let event: AssistantEvent
          try {
            event = JSON.parse(line.slice(5).trim()) as AssistantEvent
          } catch {
            continue
          }

          switch (event.type) {
            case 'status':
              setStage(event.stage)
              break
            case 'hymns':
              setResult((r) => ({ ...r, hymns: event.data }))
              break
            case 'verses':
              setResult((r) => ({ ...r, verses: event.data }))
              break
            case 'videos':
              setResult((r) => ({ ...r, videos: event.data }))
              break
            case 'prayer':
              setResult((r) => ({ ...r, prayer: event.data }))
              break
            case 'fallback':
              setResult((r) => ({ ...r, fallback: event.message }))
              break
            case 'done':
              setResult((r) => ({ ...r, summary: event.data }))
              break
            case 'error':
              setResult((r) => ({ ...r, error: event.message }))
              break
          }
        }
      }
    } catch {
      setResult({ ...EMPTY, error: 'The connection dropped before the response finished.' })
    } finally {
      setBusy(false)
      setStage('')
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      )
    }
  }

  async function rate(direction: 'up' | 'down') {
    const sessionId = result.summary?.sessionId
    if (!sessionId) return
    setRated(direction)
    await fetch('/api/assistant/rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        rating: direction === 'up' ? 1 : -1,
        flagReason: direction === 'down' ? 'Member marked this response unhelpful' : undefined,
      }),
    }).catch(() => undefined)
  }

  const hasAnything =
    result.hymns.length > 0 ||
    result.verses.length > 0 ||
    result.videos.length > 0 ||
    result.prayer !== null

  return (
    <div>
      {corpusIsSample && (
        <div
          className="no-print mb-6 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--warn-border)',
            background: 'var(--warn-bg)',
            color: 'var(--warn-text)',
          }}
        >
          <strong>Sample corpus.</strong> The knowledge base is seeded with
          unverified development data — scripture text is accurate KJV, but hymn
          numbers are placeholders and no real video references exist yet.
          Connect the NotebookLM workspace to replace it.
        </div>
      )}

      <section className="no-print">
        <h1 className="serif text-3xl leading-tight sm:text-4xl">
          How is your heart today?
        </h1>
        <p className="mt-2 max-w-xl" style={{ color: 'var(--text-soft)' }}>
          Tell me what you are facing. I will look only in the approved sources
          and show you exactly where each answer came from.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void ask(query)
          }}
          className="mt-5"
        >
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void ask(query)
              }
            }}
            rows={3}
            maxLength={2000}
            placeholder="I'm feeling anxious about my family…"
            className="w-full resize-y rounded-xl border p-4 text-base outline-none transition-colors focus:border-[var(--accent)]"
            style={{
              borderColor: 'var(--rule)',
              background: 'var(--surface-raised)',
              color: 'var(--text)',
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy || query.trim().length < 2}
              className="rounded-full px-5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {busy ? 'Searching…' : 'Ask'}
            </button>
            <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
              {busy ? stage : '⌘ + Enter to send'}
            </span>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example)
                void ask(example)
              }}
              disabled={busy}
              className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-[var(--accent-quiet)] disabled:opacity-50"
              style={{ borderColor: 'var(--rule)', color: 'var(--text-soft)' }}
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      <div ref={resultsRef} className="mt-10 space-y-10">
        {submitted && (
          <p className="print-only serif text-lg">
            Prayer for: “{submitted}”
          </p>
        )}

        {result.error && (
          <div
            className="rounded-lg border px-4 py-3 text-sm"
            style={{ borderColor: 'var(--rule)', color: 'var(--text-soft)' }}
          >
            {result.error}
          </div>
        )}

        {result.fallback && (
          <div
            className="rounded-xl border p-6"
            style={{ borderColor: 'var(--rule)', background: 'var(--surface-raised)' }}
          >
            <h2 className="serif text-xl">{result.fallback}</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-soft)' }}>
              Nothing in the approved knowledge source matched closely enough to
              answer honestly, so nothing was invented. You could try describing
              the situation in different words, or write it in your journal and
              come back to it.
            </p>
          </div>
        )}

        {result.verses.length > 0 && (
          <section>
            <SectionHeading title="Scripture" count={result.verses.length} />
            <div className="space-y-4">
              {result.verses.map((verse) => (
                <VerseCard key={verse.reference} verse={verse} />
              ))}
            </div>
          </section>
        )}

        {result.hymns.length > 0 && (
          <section>
            <SectionHeading title="Hymns" count={result.hymns.length} />
            <div className="space-y-4">
              {result.hymns.map((hymn) => (
                <HymnCard key={`${hymn.hymnalEdition}-${hymn.hymnNumber}`} hymn={hymn} />
              ))}
            </div>
          </section>
        )}

        {result.prayer && (
          <section>
            <SectionHeading title="A prayer" />
            <PrayerEditor
              prayer={result.prayer}
              situation={submitted}
              sessionId={result.summary?.sessionId ?? null}
            />
          </section>
        )}

        {result.videos.length > 0 && (
          <section className="no-print">
            <SectionHeading title="Sermons & worship" count={result.videos.length} />
            <div className="space-y-4">
              {result.videos.map((video, i) => (
                <VideoCard key={`${video.title}-${i}`} video={video} />
              ))}
            </div>
          </section>
        )}

        {hasAnything && result.summary && (
          <section className="no-print">
            <div
              className="rounded-xl border p-5 text-sm"
              style={{ borderColor: 'var(--rule)', background: 'var(--surface-sunken)' }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span style={{ color: 'var(--text-soft)' }}>Was this helpful?</span>
                <button
                  type="button"
                  onClick={() => void rate('up')}
                  className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-[var(--accent-quiet)]"
                  style={{
                    borderColor: rated === 'up' ? 'var(--accent)' : 'var(--rule)',
                    color: rated === 'up' ? 'var(--accent)' : 'var(--text-soft)',
                  }}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => void rate('down')}
                  className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-[var(--accent-quiet)]"
                  style={{
                    borderColor: rated === 'down' ? 'var(--accent)' : 'var(--rule)',
                    color: rated === 'down' ? 'var(--accent)' : 'var(--text-soft)',
                  }}
                >
                  Not really
                </button>
                {rated && (
                  <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
                    Thank you — this goes to the review queue.
                  </span>
                )}
              </div>

              {result.summary.omitted.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs" style={{ color: 'var(--text-soft)' }}>
                    What was left out, and why ({result.summary.omitted.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs" style={{ color: 'var(--text-soft)' }}>
                    {result.summary.omitted.map((reason) => (
                      <li key={reason}>· {reason}</li>
                    ))}
                  </ul>
                </details>
              )}

              <p className="mt-3 text-xs" style={{ color: 'var(--text-soft)' }}>
                Retrieval confidence {(result.summary.confidence * 100).toFixed(0)}% ·{' '}
                {result.summary.latencyMs} ms · status {result.summary.status}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
