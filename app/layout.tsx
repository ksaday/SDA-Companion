import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthModal } from '@/components/auth/AuthModal'
import './globals.css'

export const metadata: Metadata = {
  title: 'Grace Companion — spiritual guidance from approved sources',
  description:
    'A spiritual companion for Seventh-day Adventist members. Hymns, scripture, sermons and prayer — drawn only from a trusted, church-approved knowledge base.',
}

const nav = [
  { href: '/', label: 'Companion' },
  { href: '/journal', label: 'Journal' },
  { href: '/saved', label: 'Saved' },
  { href: '/history', label: 'History' },
  { href: '/admin/sources', label: 'Sources' },
]

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <header
          className="no-print sticky top-0 z-20 border-b backdrop-blur"
          style={{
            borderColor: 'var(--rule)',
            background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
          }}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
            <Link href="/" className="serif text-lg font-semibold tracking-tight">
              Grace <span style={{ color: 'var(--accent)' }}>Companion</span>
            </Link>
            <nav className="ml-auto flex items-center gap-2 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 transition-colors hover:bg-[var(--accent-quiet)]"
                  style={{ color: 'var(--text-soft)' }}
                >
                  {item.label}
                </Link>
              ))}
              <div className="ml-2 border-l pl-3" style={{ borderColor: 'var(--rule)' }}>
                <AuthModal />
              </div>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24 pt-8">
          {children}
        </main>

        <footer
          className="no-print border-t px-5 py-8 text-center text-xs"
          style={{ borderColor: 'var(--rule)', color: 'var(--text-soft)' }}
        >
          <p className="mx-auto max-w-xl">
            Every recommendation is drawn only from the approved knowledge source.
            When nothing matches, this app says so rather than guessing.
          </p>
        </footer>
      </body>
    </html>
  )
}
