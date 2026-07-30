/**
 * The assistant pipeline.
 *
 *   preprocess → per-component retrieval → confidence gate → structural
 *   verification → grounded generation → persist
 *
 * The gate is the load-bearing part: generation is never reached unless
 * approved chunks cleared the threshold, so the model is never in a position
 * to answer from its own knowledge. When nothing clears, the caller gets the
 * fallback message verbatim.
 */

import { db } from '@/lib/db'
import { normalizeWord, retriever, SYNONYMS, tokenize } from './retriever'
import { generatePrayer } from './generator'
import { extractYouTubeId, hymnExists, verseExists } from './verifier'
import { toCitation } from './citations'
import {
  FALLBACK_MESSAGE,
  type AssistantEvent,
  type AssistantResult,
  type HymnRecommendation,
  type RetrievedChunk,
  type SessionStatus,
  type VerseRecommendation,
  type VideoRecommendation,
} from './types'

function threshold(name: string, fallback: number): number {
  const raw = process.env[name]
  const parsed = raw ? Number.parseFloat(raw) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

const INCLUDE = () => threshold('CONFIDENCE_INCLUDE_THRESHOLD', 0.3)
const FLOOR = () => threshold('CONFIDENCE_FLOOR', 0.18)

/**
 * Which curated theme tags the person's own words actually landed on. Uses the
 * retriever's own tokenizer so "anxious" matches the "anxiety" tag rather than
 * silently falling through to generic copy.
 */
function matchedThemes(query: string, themes: string[] = []): string[] {
  const queryStems = new Set(tokenize(query).map(normalizeWord))
  const expanded = new Set(queryStems)
  for (const word of tokenize(query)) {
    for (const syn of SYNONYMS[word] ?? []) expanded.add(normalizeWord(syn))
  }

  return themes.filter((theme) =>
    tokenize(theme)
      .map(normalizeWord)
      .some((stem) => expanded.has(stem))
  )
}

function relevanceSentence(query: string, themes: string[] = []): string {
  const hits = matchedThemes(query, themes)
  if (hits.length === 0) {
    return 'Retrieved from the approved sources as the closest match to what you described.'
  }
  const list = hits.slice(0, 4).join(', ')
  return `Matched to what you described on: ${list}.`
}

export interface AssistantOptions {
  query: string
  userId?: string | null
  language?: string
}

/**
 * Streams the pipeline so each component reaches the UI as soon as it has been
 * retrieved and verified, rather than after the (slowest) prayer step.
 */
export async function* runAssistantStream({
  query,
  userId = null,
  language = 'en',
}: AssistantOptions): AsyncGenerator<AssistantEvent> {
  const startedAt = Date.now()
  const include = INCLUDE()
  const floor = FLOOR()
  const omitted: string[] = []

  yield { type: 'status', stage: 'Searching the approved sources…' }

  // --- retrieval (component-specific, per planning doc §13.3) --------------
  const [hymnChunks, verseChunks, videoChunks, devotionalChunks] =
    await Promise.all([
      retriever.retrieve({ query, kinds: ['hymn'], language, limit: 5 }),
      retriever.retrieve({ query, kinds: ['verse'], language, limit: 6 }),
      retriever.retrieve({ query, kinds: ['video'], language, limit: 3 }),
      retriever.retrieve({ query, kinds: ['devotional'], language, limit: 3 }),
    ])

  yield { type: 'status', stage: 'Checking every reference against the corpus…' }

  // --- hymns ---------------------------------------------------------------
  const hymns: HymnRecommendation[] = []
  for (const chunk of hymnChunks.filter((c) => c.score >= include).slice(0, 3)) {
    const m = chunk.metadata
    if (!m.hymnalEdition || m.hymnNumber == null) continue

    const check = await hymnExists(m.hymnalEdition, m.hymnNumber)
    if (!check.ok) {
      omitted.push(`Hymn "${m.title}" — no matching entry in the hymn index`)
      continue
    }

    hymns.push({
      title: check.title ?? m.title ?? 'Untitled',
      hymnNumber: m.hymnNumber,
      hymnalEdition: m.hymnalEdition,
      reason: m.reason ?? relevanceSentence(query, m.themes),
      verified: check.verified,
      confidence: chunk.score,
      citations: [toCitation(chunk)],
    })
  }
  if (hymns.length === 0) omitted.push('Hymns — nothing in the corpus cleared the confidence threshold')
  else yield { type: 'hymns', data: hymns }

  // --- verses --------------------------------------------------------------
  const verses: VerseRecommendation[] = []
  for (const chunk of verseChunks.filter((c) => c.score >= include).slice(0, 4)) {
    const m = chunk.metadata
    if (!m.verseRef || !m.quote) continue

    if (!(await verseExists(chunk))) {
      omitted.push(`Verse ${m.verseRef} — reference not found in the verse index`)
      continue
    }

    verses.push({
      reference: m.verseRef,
      translation: m.translation ?? 'KJV',
      text: m.quote,
      explanation: m.explanation ?? '',
      relevance: relevanceSentence(query, m.themes),
      confidence: chunk.score,
      citations: [toCitation(chunk)],
    })
  }
  if (verses.length === 0) omitted.push('Bible verses — nothing in the corpus cleared the confidence threshold')
  else yield { type: 'verses', data: verses }

  // --- videos --------------------------------------------------------------
  const videos: VideoRecommendation[] = []
  for (const chunk of videoChunks.filter((c) => c.score >= include).slice(0, 3)) {
    const m = chunk.metadata
    const youtubeId = extractYouTubeId(m.videoUrl)
    videos.push({
      title: m.title ?? 'Untitled reference',
      speaker: m.speaker ?? 'Unknown',
      videoUrl: youtubeId ? (m.videoUrl ?? null) : null,
      youtubeId,
      confidence: chunk.score,
      citations: [toCitation(chunk)],
    })
  }
  if (videos.length === 0) omitted.push('Videos — no video reference in the corpus matched')
  else yield { type: 'videos', data: videos }

  // --- prayer --------------------------------------------------------------
  // Only composed when real grounding exists; context may reach a little lower
  // than the inclusion gate, but never below the floor.
  const hasGrounding =
    verseChunks.some((c) => c.score >= include) ||
    devotionalChunks.some((c) => c.score >= include)

  const prayerContext: RetrievedChunk[] = hasGrounding
    ? [...verseChunks, ...devotionalChunks, ...hymnChunks]
        .filter((c) => c.score >= floor)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
    : []

  let prayer = null as Awaited<ReturnType<typeof generatePrayer>> | null
  if (prayerContext.length > 0) {
    yield { type: 'status', stage: 'Composing a prayer from those references…' }
    prayer = await generatePrayer(query, prayerContext)
    yield { type: 'prayer', data: prayer }
  } else {
    omitted.push('Prayer — not composed because no approved reference matched')
  }

  // --- status & persistence ------------------------------------------------
  const produced = hymns.length + verses.length + videos.length + (prayer ? 1 : 0)
  const status: SessionStatus =
    produced === 0 ? 'fallback' : omitted.length > 0 ? 'partial' : 'ok'

  const confidence = Math.max(
    0,
    ...hymns.map((h) => h.confidence),
    ...verses.map((v) => v.confidence),
    ...videos.map((v) => v.confidence),
    prayer?.confidence ?? 0
  )

  const latencyMs = Date.now() - startedAt

  const session = await db.assistantSession.create({
    data: {
      userId,
      queryText: query,
      queryLanguage: language,
      status,
      confidence,
      latencyMs,
      generator: prayer?.generator ?? 'template',
    },
  })

  await Promise.all([
    ...hymns.map((h) =>
      db.recommendation.create({
        data: {
          sessionId: session.id,
          kind: 'hymn',
          payload: JSON.stringify(h),
          confidence: h.confidence,
          citations: {
            create: h.citations.map((c) => ({
              sourceChunkId: c.chunkId,
              relevance: h.confidence,
            })),
          },
        },
      })
    ),
    ...verses.map((v) =>
      db.recommendation.create({
        data: {
          sessionId: session.id,
          kind: 'verse',
          payload: JSON.stringify(v),
          confidence: v.confidence,
          citations: {
            create: v.citations.map((c) => ({
              sourceChunkId: c.chunkId,
              relevance: v.confidence,
            })),
          },
        },
      })
    ),
    ...videos.map((v) =>
      db.recommendation.create({
        data: {
          sessionId: session.id,
          kind: 'video',
          payload: JSON.stringify(v),
          confidence: v.confidence,
          citations: {
            create: v.citations.map((c) => ({
              sourceChunkId: c.chunkId,
              relevance: v.confidence,
            })),
          },
        },
      })
    ),
    prayer
      ? db.recommendation.create({
          data: {
            sessionId: session.id,
            kind: 'prayer',
            payload: JSON.stringify(prayer),
            confidence: prayer.confidence,
            citations: {
              create: prayer.citations.map((c) => ({
                sourceChunkId: c.chunkId,
                relevance: prayer.confidence,
              })),
            },
          },
        })
      : Promise.resolve(null),
    db.searchLog.create({
      data: {
        userId,
        query,
        language,
        resultCount: produced,
        wasFallback: status === 'fallback',
      },
    }),
  ])

  const sampleSources = await db.source.count({
    where: { status: 'active', verified: false },
  })

  const result: AssistantResult = {
    sessionId: session.id,
    status,
    confidence,
    latencyMs,
    hymns,
    verses,
    videos,
    prayer,
    omitted,
    fallbackMessage: status === 'fallback' ? FALLBACK_MESSAGE : null,
    corpusIsSample: sampleSources > 0,
  }

  if (status === 'fallback') {
    yield { type: 'fallback', message: FALLBACK_MESSAGE }
  }
  yield { type: 'done', data: result }
}

/** Non-streaming convenience wrapper (used by tests and server-side callers). */
export async function runAssistant(
  opts: AssistantOptions
): Promise<AssistantResult> {
  for await (const event of runAssistantStream(opts)) {
    if (event.type === 'done') return event.data
  }
  throw new Error('Assistant stream ended without a result')
}
