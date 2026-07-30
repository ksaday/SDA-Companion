/**
 * Structural verification — layer 3 of the anti-hallucination design.
 *
 * Retrieval and generation can both go wrong. These checks join every rendered
 * claim back to a real row in the corpus before it reaches the user:
 *
 *  - a hymn must exist in the Hymn table at that edition + number
 *  - a verse must exist in the BibleVerse table at that exact reference
 *  - a video URL must be a real YouTube URL that came from the corpus; a
 *    model-produced or malformed URL is never embedded
 *
 * Anything that fails is dropped and reported in `omitted`, never repaired by
 * guessing.
 */

import { db } from '@/lib/db'
import type { RetrievedChunk } from './types'

export async function hymnExists(
  hymnalEdition: string,
  number: number
): Promise<{ ok: boolean; verified: boolean; title?: string }> {
  const hymn = await db.hymn.findUnique({
    where: { hymnalEdition_number: { hymnalEdition, number } },
  })
  if (!hymn) return { ok: false, verified: false }
  return { ok: true, verified: hymn.verified, title: hymn.title }
}

export async function verseExists(chunk: RetrievedChunk): Promise<boolean> {
  const m = chunk.metadata
  if (!m.translation || !m.book || m.chapter == null || m.verseStart == null) {
    return false
  }
  const verse = await db.bibleVerse.findUnique({
    where: {
      translation_book_chapter_verseStart_verseEnd: {
        translation: m.translation,
        book: m.book,
        chapter: m.chapter,
        verseStart: m.verseStart,
        verseEnd: m.verseEnd ?? m.verseStart,
      },
    },
  })
  return Boolean(verse)
}

/**
 * Returns the YouTube id only for URLs that are well-formed and on a YouTube
 * host. Everything else yields null, which renders as a non-embedded reference
 * card rather than an iframe pointed at an unverified destination.
 */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = parsed.hostname.replace(/^www\./, '')
  let id: string | null = null

  if (host === 'youtu.be') {
    id = parsed.pathname.slice(1)
  } else if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname === '/watch') id = parsed.searchParams.get('v')
    else if (parsed.pathname.startsWith('/embed/')) id = parsed.pathname.slice(7)
  }

  if (!id) return null
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null
}
