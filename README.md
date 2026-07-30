# Grace Companion

An AI spiritual companion for Seventh-day Adventist members. A member describes
what they are facing; the app answers with hymns, scripture, sermon references
and an editable prayer — drawn **only** from an approved knowledge base curated
in Google NotebookLM.

When nothing in the approved sources matches, the app says so:

> No related reference was found in the approved knowledge source.

It does not guess, and it does not answer from the model's own knowledge.

---

## Running it

No API keys are needed. The app ships with a seeded sample corpus and an
offline prayer composer.

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Then open http://localhost:3000.

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run db:reset` | Wipe and re-seed the local corpus |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run typecheck` | `tsc --noEmit` |

---

## What is real, and what is a placeholder

**Real and working**
- The full retrieval → confidence gate → verification → generation pipeline
- Hymn, scripture, video and prayer components with per-claim citations
- The fallback guarantee (try asking something the corpus does not cover)
- Read Aloud (browser speech synthesis), prayer editing, save, copy, export, print
- Prayer journal, saved items, session history
- Admin source registry and the retrieval test console

**Placeholder, waiting on you**
- **Auth** — `lib/session.ts` returns a seeded demo user. Swap it for Firebase
  Auth; every downstream call already takes a `userId`.
- **NotebookLM corpus** — the workspace has not been connected. See below.
- **Subscriptions** — Stripe keys are stubbed in `.env.example`; no billing yet.
- **Sample corpus** — `prisma/sample-corpus.json`. Scripture text is accurate
  KJV (public domain). **Hymn numbers are unverified placeholders** and no real
  YouTube references exist. Every seeded row is marked `verified: false` and the
  UI labels it as sample data.

---

## How the NotebookLM integration works

NotebookLM has no public query API, so the runtime cannot call it directly.
The design keeps NotebookLM as the **curation layer** and mirrors its sources
into a corpus the app controls:

```
NotebookLM workspace  →  shared Google Drive folder  →  sync job
   →  Source + SourceChunk rows  →  retrieval  →  citation chip in the UI
```

Every citation carries `notebookLmSourceRef`, so any sentence a member reads
traces back to a specific document the church approved. To connect the real
workspace, set `NOTEBOOKLM_NOTEBOOK_ID`, `GOOGLE_DRIVE_FOLDER_ID` and
`GOOGLE_SERVICE_ACCOUNT_JSON`, then build the sync job against the
`KnowledgeRetriever` interface in `lib/ai/types.ts` — that interface is the
single swap point (a NotebookLM Enterprise or Vertex RAG adapter drops in
without touching orchestration or UI).

---

## How hallucination is prevented

Five layers, in `lib/ai/`:

1. **Retrieval gating** (`orchestrator.ts`) — generation never runs unless
   approved chunks clear the confidence threshold. The model is never asked an
   open question.
2. **Closed-context prompting** (`generator.ts`) — the prompt contains only
   retrieved excerpts; the member's words are wrapped as data, never as
   instructions.
3. **Structural verification** (`verifier.ts`) — hymn numbers and verse
   references are joined against real corpus rows; video URLs must be genuine
   YouTube URLs that came from the corpus, or nothing is embedded.
4. **Citation verification** — any cited chunk id not in the retrieved set is
   treated as fabrication and the response falls back to the offline composer.
5. **Human loop** — ratings and doctrinal flags write to the review queue.

With no API key, prayers are assembled by `composeTemplatePrayer`, which uses
fixed connective phrases that make no spiritual claim plus verbatim quotations
from the corpus — structurally unable to hallucinate. Setting
`GOOGLE_AI_API_KEY` routes generation through Gemini under the same rules, with
the template composer as the fallback on any violation.

---

## Layout

```
app/
  page.tsx                  the companion (home)
  journal/ saved/ history/  member surfaces
  admin/sources/            source registry + retrieval test console
  api/assistant/            SSE streaming pipeline endpoint
components/
  assistant/                cards, prayer editor, client orchestration
lib/
  ai/
    types.ts                contracts, incl. KnowledgeRetriever
    retriever.ts            BM25 hybrid retrieval over the mirrored corpus
    orchestrator.ts         the pipeline
    generator.ts            template + Gemini prayer generation
    verifier.ts             structural checks
  db.ts  session.ts
prisma/
  schema.prisma             SQLite for dev, Postgres-ready
  sample-corpus.json        UNVERIFIED seed data
planning/                   full technical planning document
```

The dev database is SQLite so the app runs with nothing installed. Production
targets PostgreSQL + pgvector — swap the adapter in `lib/db.ts` and the
`provider` in `prisma/schema.prisma`.

Full architecture, roadmap and rationale:
[`planning/sda-spiritual-companion-plan.md`](planning/sda-spiritual-companion-plan.md).
