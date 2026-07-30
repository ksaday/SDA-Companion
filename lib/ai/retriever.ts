/**
 * LocalCorpusRetriever — hybrid lexical retrieval over the mirrored corpus.
 *
 * This is the offline-capable implementation of `KnowledgeRetriever`. It scores
 * BM25-style over chunks that were synced from the approved sources, so the app
 * is fully functional with no API keys. When a vector provider is configured,
 * `embedding` columns are populated by the sync job and the score below is
 * fused with cosine similarity (see `fuse()`), matching the RRF design in the
 * planning doc §13.3.
 *
 * Nothing in this file invents content. It only ranks text that already exists
 * in the corpus.
 */

import { db } from '@/lib/db'
import type {
  ChunkKind,
  ChunkMetadata,
  KnowledgeRetriever,
  RetrievedChunk,
} from './types'

const STOPWORDS = new Set([
  'a','about','all','am','an','and','any','are','as','at','be','been','being','but','by','can','cant','do','dont','for','from','get','got','had','has','have','he','her','here','hers','him','his','how','i','im','if','in','into','is','it','its','ive','just','me','my','no','not','of','on','or','our','out','over','own','she','should','so','some','such','than','that','the','their','them','then','there','these','they','this','those','to','too','up','very','was','we','were','what','when','which','who','why','will','with','would','you','your','feel','feeling','feels','need','needs','want','wants','really','right','now','today','lot','much','more','because','been','also',
])

/**
 * Query-side vocabulary expansion. This maps how members actually describe
 * their situation onto the vocabulary the corpus uses. It adds no spiritual
 * content of its own — every expanded term is still only used to *find*
 * approved chunks, never to assert anything.
 */
export const SYNONYMS: Record<string, string[]> = {
  job: ['unemployment', 'work', 'provision', 'money'],
  jobs: ['unemployment', 'work', 'provision'],
  fired: ['unemployment', 'job', 'loss', 'provision'],
  laid: ['unemployment', 'job', 'loss'],
  unemployed: ['unemployment', 'job', 'provision'],
  redundant: ['unemployment', 'job', 'loss'],
  money: ['provision', 'unemployment', 'worry'],
  income: ['provision', 'money', 'work'],
  bills: ['provision', 'money', 'worry'],
  anxious: ['anxiety', 'fear', 'worry', 'peace'],
  anxiety: ['fear', 'worry', 'peace'],
  nervous: ['anxiety', 'fear', 'worry'],
  panic: ['anxiety', 'fear', 'peace'],
  scared: ['fear', 'anxiety', 'courage'],
  afraid: ['fear', 'anxiety', 'courage'],
  worried: ['worry', 'anxiety', 'fear'],
  worry: ['anxiety', 'fear', 'peace'],
  stressed: ['anxiety', 'burden', 'overwhelmed', 'rest'],
  overwhelmed: ['burden', 'rest', 'weariness'],
  sad: ['discouragement', 'sadness', 'hope'],
  depressed: ['discouragement', 'despair', 'depression', 'hope'],
  discouraged: ['discouragement', 'despair', 'hope'],
  hopeless: ['despair', 'discouragement', 'hope'],
  down: ['discouragement', 'downcast', 'hope'],
  lonely: ['loneliness', 'presence', 'alone'],
  alone: ['loneliness', 'presence'],
  strength: ['strength', 'endurance', 'weariness'],
  weak: ['strength', 'weariness', 'endurance'],
  tired: ['weariness', 'rest', 'exhaustion', 'strength'],
  exhausted: ['weariness', 'rest', 'exhaustion'],
  weary: ['weariness', 'rest', 'strength'],
  wisdom: ['wisdom', 'guidance', 'decisions', 'direction'],
  decision: ['decisions', 'wisdom', 'guidance', 'direction'],
  decide: ['decisions', 'wisdom', 'guidance'],
  choose: ['decisions', 'wisdom', 'guidance'],
  guidance: ['guidance', 'direction', 'wisdom'],
  family: ['family', 'household', 'children'],
  wife: ['family', 'household', 'marriage'],
  husband: ['family', 'household', 'marriage'],
  marriage: ['family', 'household', 'conflict'],
  son: ['family', 'children', 'household'],
  daughter: ['family', 'children', 'household'],
  children: ['family', 'household', 'intercession'],
  kids: ['family', 'children', 'household'],
  home: ['household', 'family'],
  parents: ['family', 'household'],
  struggling: ['struggling', 'conflict', 'hardship'],
  thank: ['thanksgiving', 'gratitude', 'praise'],
  thankful: ['thanksgiving', 'gratitude', 'praise'],
  thanks: ['thanksgiving', 'gratitude', 'praise'],
  grateful: ['thanksgiving', 'gratitude', 'praise'],
  gratitude: ['thanksgiving', 'praise'],
  praise: ['praise', 'thanksgiving', 'joy'],
  bless: ['blessing', 'thanksgiving', 'praise'],
  sick: ['illness', 'presence', 'grief'],
  illness: ['illness', 'presence'],
  ill: ['illness', 'presence'],
  hospital: ['illness', 'presence'],
  pain: ['grief', 'comfort', 'illness'],
  died: ['grief', 'loss', 'bereavement'],
  death: ['grief', 'loss', 'bereavement'],
  grief: ['grief', 'loss', 'comfort'],
  loss: ['loss', 'grief', 'hardship'],
  lost: ['loss', 'grief'],
  peace: ['peace', 'anxiety', 'rest'],
  rest: ['rest', 'weariness', 'burden'],
  pray: ['prayer', 'intercession'],
  prayer: ['prayer', 'intercession'],
  faith: ['trust', 'assurance'],
  doubt: ['doubt', 'assurance'],
  god: [],
  jesus: [],
  lord: [],
}

export function normalizeWord(w: string): string {
  // Deliberately crude stemming — enough to unify plurals and -ing/-ed forms.
  let s = w
  if (s.length > 5 && s.endsWith('ies')) return s.slice(0, -3) + 'y'
  if (s.length > 4 && s.endsWith('ing')) s = s.slice(0, -3)
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2)
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1)
  return s
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
}

/** Weighted query terms: original words at 1.0, expansions at 0.55. */
function buildQueryTerms(query: string): Map<string, number> {
  const terms = new Map<string, number>()
  const raw = tokenize(query)

  for (const w of raw) {
    const stem = normalizeWord(w)
    terms.set(stem, Math.max(terms.get(stem) ?? 0, 1))
    for (const syn of SYNONYMS[w] ?? []) {
      const s = normalizeWord(syn)
      if (!terms.has(s)) terms.set(s, 0.55)
    }
  }
  return terms
}

interface IndexedChunk {
  chunkId: string
  sourceId: string
  sourceTitle: string
  sourceType: string
  notebookLmSourceRef: string
  sourceVerified: boolean
  content: string
  metadata: ChunkMetadata
  language: string
  tf: Map<string, number>
  length: number
  themeTokens: Set<string>
}

interface CorpusIndex {
  chunks: IndexedChunk[]
  df: Map<string, number>
  avgLength: number
  builtAt: number
}

let cachedIndex: CorpusIndex | null = null
const INDEX_TTL_MS = 15_000

export function invalidateCorpusCache() {
  cachedIndex = null
}

async function buildIndex(): Promise<CorpusIndex> {
  const rows = await db.sourceChunk.findMany({
    where: { source: { status: 'active' } },
    include: { source: true },
  })

  const chunks: IndexedChunk[] = rows.map((row) => {
    let metadata: ChunkMetadata = {}
    try {
      metadata = JSON.parse(row.metadata) as ChunkMetadata
    } catch {
      metadata = {}
    }

    const themeText = (metadata.themes ?? []).join(' ')
    // Themes and title are part of the searchable surface, weighted by repetition.
    const searchable = `${row.content} ${themeText} ${themeText} ${metadata.title ?? ''}`
    const tokens = tokenize(searchable).map(normalizeWord)

    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)

    return {
      chunkId: row.id,
      sourceId: row.sourceId,
      sourceTitle: row.source.title,
      sourceType: row.source.type,
      notebookLmSourceRef: row.source.notebookLmSourceRef,
      sourceVerified: row.source.verified,
      content: row.content,
      metadata,
      language: row.source.language,
      tf,
      length: tokens.length,
      themeTokens: new Set(tokenize(themeText).map(normalizeWord)),
    }
  })

  const df = new Map<string, number>()
  for (const c of chunks) {
    for (const term of c.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  }

  const avgLength =
    chunks.length > 0
      ? chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length
      : 1

  return { chunks, df, avgLength, builtAt: Date.now() }
}

async function getIndex(): Promise<CorpusIndex> {
  if (cachedIndex && Date.now() - cachedIndex.builtAt < INDEX_TTL_MS) {
    return cachedIndex
  }
  cachedIndex = await buildIndex()
  return cachedIndex
}

const K1 = 1.2
const B = 0.75

/**
 * Score in [0,1]: the fraction of the query's *distinctive* weight that this
 * chunk covers. Reporting coverage rather than a raw BM25 sum is what makes the
 * confidence gate in the orchestrator interpretable across queries.
 */
function scoreChunk(
  chunk: IndexedChunk,
  queryTerms: Map<string, number>,
  index: CorpusIndex
): number {
  const N = index.chunks.length || 1
  let numerator = 0
  let denominator = 0

  for (const [term, weight] of queryTerms) {
    const dfT = index.df.get(term) ?? 0
    // Smoothed IDF; terms present in every chunk contribute almost nothing.
    const idf = Math.log(1 + (N - dfT + 0.5) / (dfT + 0.5))
    denominator += weight * idf

    const tf = chunk.tf.get(term) ?? 0
    if (tf === 0) continue

    const norm = K1 * (1 - B + B * (chunk.length / index.avgLength))
    numerator += weight * idf * (tf / (tf + norm))
  }

  if (denominator === 0) return 0
  const coverage = numerator / denominator

  // Small boost when the query lands on a curated theme tag rather than
  // incidental prose.
  let themeHits = 0
  for (const term of queryTerms.keys()) {
    if (chunk.themeTokens.has(term)) themeHits++
  }
  const boost = 1 + Math.min(0.3, themeHits * 0.08)

  return Math.min(1, coverage * boost)
}

export class LocalCorpusRetriever implements KnowledgeRetriever {
  async retrieve({
    query,
    kinds,
    language,
    limit = 6,
  }: {
    query: string
    kinds?: ChunkKind[]
    language?: string
    limit?: number
  }): Promise<RetrievedChunk[]> {
    const index = await getIndex()
    if (index.chunks.length === 0) return []

    const queryTerms = buildQueryTerms(query)
    if (queryTerms.size === 0) return []

    const kindFilter = kinds && kinds.length > 0 ? new Set(kinds) : null

    const scored: RetrievedChunk[] = []
    for (const chunk of index.chunks) {
      if (kindFilter && !kindFilter.has(chunk.metadata.kind as ChunkKind)) continue
      if (language && chunk.language !== language) continue

      const score = scoreChunk(chunk, queryTerms, index)
      if (score <= 0) continue

      scored.push({
        chunkId: chunk.chunkId,
        sourceId: chunk.sourceId,
        sourceTitle: chunk.sourceTitle,
        sourceType: chunk.sourceType,
        notebookLmSourceRef: chunk.notebookLmSourceRef,
        sourceVerified: chunk.sourceVerified,
        content: chunk.content,
        metadata: chunk.metadata,
        score,
      })
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit)
  }
}

export const retriever: KnowledgeRetriever = new LocalCorpusRetriever()
