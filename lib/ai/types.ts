/** Shared contracts for the assistant pipeline. */

export type ChunkKind = 'hymn' | 'verse' | 'video' | 'devotional'

export interface ChunkMetadata {
  kind?: ChunkKind
  themes?: string[]
  // hymn
  hymnalEdition?: string
  hymnNumber?: number
  title?: string
  reason?: string
  // verse
  verseRef?: string
  translation?: string
  book?: string
  chapter?: number
  verseStart?: number
  verseEnd?: number
  quote?: string
  explanation?: string
  // video
  videoUrl?: string | null
  speaker?: string
  placeholder?: boolean
  // devotional
  petition?: string
}

/** A retrieved unit of approved knowledge. Nothing may be said without one. */
export interface RetrievedChunk {
  chunkId: string
  sourceId: string
  sourceTitle: string
  sourceType: string
  notebookLmSourceRef: string
  sourceVerified: boolean
  content: string
  metadata: ChunkMetadata
  /** 0..1 normalized retrieval confidence */
  score: number
}

export interface Citation {
  chunkId: string
  sourceTitle: string
  notebookLmSourceRef: string
  snippet: string
  verified: boolean
}

export interface HymnRecommendation {
  title: string
  hymnNumber: number
  hymnalEdition: string
  reason: string
  verified: boolean
  confidence: number
  citations: Citation[]
}

export interface VerseRecommendation {
  reference: string
  translation: string
  text: string
  explanation: string
  relevance: string
  confidence: number
  citations: Citation[]
}

export interface VideoRecommendation {
  title: string
  speaker: string
  /** null when the corpus holds a reference but no playable URL yet */
  videoUrl: string | null
  youtubeId: string | null
  confidence: number
  citations: Citation[]
}

export interface PrayerResult {
  html: string
  plain: string
  confidence: number
  citations: Citation[]
  generator: 'template' | 'gemini'
}

export type SessionStatus = 'ok' | 'partial' | 'fallback' | 'error'

export interface AssistantResult {
  sessionId: string
  status: SessionStatus
  confidence: number
  latencyMs: number
  hymns: HymnRecommendation[]
  verses: VerseRecommendation[]
  videos: VideoRecommendation[]
  prayer: PrayerResult | null
  /** components dropped by the verifier or confidence gate, for transparency */
  omitted: string[]
  fallbackMessage: string | null
  corpusIsSample: boolean
}

/** Streaming envelope sent over SSE. */
export type AssistantEvent =
  | { type: 'status'; stage: string }
  | { type: 'hymns'; data: HymnRecommendation[] }
  | { type: 'verses'; data: VerseRecommendation[] }
  | { type: 'videos'; data: VideoRecommendation[] }
  | { type: 'prayer'; data: PrayerResult }
  | { type: 'fallback'; message: string }
  | { type: 'done'; data: AssistantResult }
  | { type: 'error'; message: string }

/**
 * The swap point for NotebookLM. The pipeline depends on this interface only,
 * so a NotebookLM Enterprise / Vertex RAG adapter can replace the local
 * retriever without touching orchestration, verification, or the UI.
 */
export interface KnowledgeRetriever {
  retrieve(opts: {
    query: string
    kinds?: ChunkKind[]
    language?: string
    limit?: number
  }): Promise<RetrievedChunk[]>
}

export const FALLBACK_MESSAGE =
  'No related reference was found in the approved knowledge source.'
