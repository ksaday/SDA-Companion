import type { Citation, RetrievedChunk } from './types'

/**
 * Every rendered claim carries one of these back to the approved source
 * document, which is what makes the provenance chain auditable:
 * NotebookLM doc → Drive file → Source row → chunk → citation → UI chip.
 */
export function toCitation(chunk: RetrievedChunk): Citation {
  const snippet =
    chunk.content.length > 220 ? `${chunk.content.slice(0, 217)}…` : chunk.content

  return {
    chunkId: chunk.chunkId,
    sourceTitle: chunk.sourceTitle,
    notebookLmSourceRef: chunk.notebookLmSourceRef,
    snippet,
    verified: chunk.sourceVerified,
  }
}
