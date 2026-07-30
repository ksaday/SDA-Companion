@AGENTS.md

# Grace Companion — project context

AI spiritual companion for Seventh-day Adventist members. Read
`planning/sda-spiritual-companion-plan.md` for the full architecture; read
`README.md` for how to run it.

## The one rule that shapes everything

The assistant may only say what the approved corpus says. Concretely:

- Never add a code path where the model answers without retrieved chunks.
- Never render a hymn number, verse reference, or video URL that has not been
  joined against a corpus row in `lib/ai/verifier.ts`.
- Never soften the fallback. When nothing matches, the exact string in
  `FALLBACK_MESSAGE` (`lib/ai/types.ts`) is what the member sees.
- Never seed content you cannot attribute. Anything unverified must carry
  `verified: false` so the UI can label it.

## Architecture notes

- `KnowledgeRetriever` (`lib/ai/types.ts`) is the NotebookLM swap point. Keep
  the orchestrator dependent on the interface, never on a provider.
- The pipeline is a generator (`runAssistantStream`) so components stream to
  the UI as they are verified. `runAssistant` wraps it for non-streaming callers.
- Prisma 7: the connection URL lives in `prisma.config.ts` (Migrate) and the
  driver adapter in `lib/db.ts` (runtime) — not in `schema.prisma`.
- Dev DB is SQLite at `prisma/dev.db`; `DATABASE_URL` must match in `.env`
  and `.env.local` or Next and the seed script open different files.
- Next.js 16: `params`, `searchParams`, `cookies()` and `headers()` are async.

## Placeholders to replace

| Area | Where | Replace with |
| --- | --- | --- |
| Auth | `lib/session.ts` | Firebase Auth token verification |
| Corpus | `prisma/sample-corpus.json` | Drive/NotebookLM sync job output |
| Billing | `.env.example` Stripe keys | Stripe Checkout + webhooks |
| Hymn numbers | seeded `Hymn` rows | verified official hymnal data |
