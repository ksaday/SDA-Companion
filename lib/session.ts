import { cookies } from 'next/headers'
import { db } from './db'

export async function getCurrentUser() {
  const store = await cookies()
  const email = store.get('gc_user')?.value

  if (email) {
    const user = await db.user.findUnique({ where: { email } })
    if (user) return user
  }

  // Fallback demo user for guest / offline mode
  return db.user.findUnique({ where: { email: 'demo@grace.local' } })
}

export async function requireUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

