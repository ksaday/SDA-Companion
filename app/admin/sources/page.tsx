import { db } from '@/lib/db'
import { RetrievalConsole } from '@/components/admin/RetrievalConsole'
import { isGeminiConfigured } from '@/lib/ai/generator'

export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
  const [sources, chunkCount, fallbackCount, searchCount] = await Promise.all([
    db.source.findMany({
      orderBy: { title: 'asc' },
      include: { _count: { select: { chunks: true } } },
    }),
    db.sourceChunk.count(),
    db.searchLog.count({ where: { wasFallback: true } }),
    db.searchLog.count(),
  ])

  const includeThreshold = Number.parseFloat(
    process.env.CONFIDENCE_INCLUDE_THRESHOLD ?? '0.3'
  )
  const unverified = sources.filter((s) => !s.verified).length
  const fallbackRate = searchCount > 0 ? (fallbackCount / searchCount) * 100 : 0

  const stats = [
    { label: 'Sources', value: String(sources.length) },
    { label: 'Chunks indexed', value: String(chunkCount) },
    { label: 'Unverified sources', value: String(unverified) },
    { label: 'Fallback rate', value: `${fallbackRate.toFixed(0)}%` },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="serif text-3xl">Knowledge sources</h1>
        <p className="mt-2 max-w-2xl" style={{ color: 'var(--text-soft)' }}>
          Everything the assistant is allowed to say comes from this table.
          Curators manage the documents in NotebookLM; the sync job mirrors them
          here so the runtime can retrieve, cite, and verify against them.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--rule)', background: 'var(--surface-raised)' }}
          >
            <p className="serif text-2xl">{stat.value}</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-soft)' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={{
          borderColor: 'var(--warn-border)',
          background: 'var(--warn-bg)',
          color: 'var(--warn-text)',
        }}
      >
        <p>
          <strong>Not yet connected to NotebookLM.</strong> NotebookLM has no
          public query API, so the sync job reads the same Google Drive folder
          the workspace imports from. Set{' '}
          <code>NOTEBOOKLM_NOTEBOOK_ID</code> and{' '}
          <code>GOOGLE_DRIVE_FOLDER_ID</code> to enable it. Prayer generation is
          currently running on the{' '}
          <strong>{isGeminiConfigured() ? 'Gemini model' : 'offline composer'}</strong>.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
          Registered sources
        </h2>
        <ul className="space-y-2">
          {sources.map((source) => (
            <li
              key={source.id}
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--rule)', background: 'var(--surface-raised)' }}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="serif text-lg">{source.title}</span>
                <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-soft)' }}>
                  {source.type}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-soft)' }}>
                  {source._count.chunks} chunks · {source.language}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: source.verified ? 'var(--accent-quiet)' : 'transparent',
                    color: source.verified ? 'var(--accent)' : 'var(--gold)',
                  }}
                >
                  {source.verified ? 'verified' : 'unverified sample'}
                </span>
              </div>
              <p className="mt-1.5 font-mono text-[11px]" style={{ color: 'var(--text-soft)' }}>
                {source.notebookLmSourceRef}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-soft)' }}>
                {source.licenseNote}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <RetrievalConsole includeThreshold={includeThreshold} />
    </div>
  )
}
