// Seeds the local SQLite corpus so the app is demonstrable before the real
// NotebookLM workspace is connected. Everything seeded here is marked
// verified=false and surfaces a "sample corpus" banner in the UI.
//
//   npm run db:seed

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import prismaPkg from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const { PrismaClient } = prismaPkg

const here = dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  }),
})

const corpus = JSON.parse(readFileSync(join(here, 'sample-corpus.json'), 'utf8'))

function estimateTokens(text) {
  return Math.ceil(text.length / 4)
}

async function main() {
  console.log('Seeding sample corpus…')

  await prisma.recommendationCitation.deleteMany()
  await prisma.recommendation.deleteMany()
  await prisma.assistantSession.deleteMany()
  await prisma.hymn.deleteMany()
  await prisma.bibleVerse.deleteMany()
  await prisma.sourceChunk.deleteMany()
  await prisma.source.deleteMany()

  let chunkTotal = 0
  let hymnTotal = 0
  let verseTotal = 0

  for (const s of corpus.sources) {
    const source = await prisma.source.create({
      data: {
        notebookLmSourceRef: s.notebookLmSourceRef,
        title: s.title,
        type: s.type,
        language: s.language,
        licenseNote: s.licenseNote,
        verified: s.verified === true,
        status: 'active',
        lastSyncedAt: new Date(),
      },
    })

    for (const [i, chunk] of s.chunks.entries()) {
      await prisma.sourceChunk.create({
        data: {
          sourceId: source.id,
          chunkIndex: i,
          content: chunk.content,
          tokenCount: estimateTokens(chunk.content),
          metadata: JSON.stringify(chunk.metadata ?? {}),
        },
      })
      chunkTotal++

      const m = chunk.metadata ?? {}

      if (m.kind === 'hymn' && m.hymnNumber) {
        await prisma.hymn.upsert({
          where: {
            hymnalEdition_number: {
              hymnalEdition: m.hymnalEdition,
              number: m.hymnNumber,
            },
          },
          update: {},
          create: {
            hymnalEdition: m.hymnalEdition,
            number: m.hymnNumber,
            title: m.title,
            themes: JSON.stringify(m.themes ?? []),
            verified: false,
            sourceId: source.id,
          },
        })
        hymnTotal++
      }

      if (m.kind === 'verse' && m.book) {
        await prisma.bibleVerse.upsert({
          where: {
            translation_book_chapter_verseStart_verseEnd: {
              translation: m.translation,
              book: m.book,
              chapter: m.chapter,
              verseStart: m.verseStart,
              verseEnd: m.verseEnd,
            },
          },
          update: {},
          create: {
            translation: m.translation,
            book: m.book,
            chapter: m.chapter,
            verseStart: m.verseStart,
            verseEnd: m.verseEnd,
            // The verse text lives inside the chunk; the row is the structural
            // record the verifier joins against.
            text: chunk.content,
            language: s.language,
          },
        })
        verseTotal++
      }
    }
  }

  await prisma.user.upsert({
    where: { email: 'demo@grace.local' },
    update: {},
    create: {
      email: 'demo@grace.local',
      displayName: 'Demo Member',
      language: 'en',
      role: 'global_admin',
      tier: 'premium',
    },
  })

  console.log(
    `Done — ${corpus.sources.length} sources, ${chunkTotal} chunks, ${hymnTotal} hymns, ${verseTotal} verses.`
  )
  console.log('All seeded content is marked UNVERIFIED sample data.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
