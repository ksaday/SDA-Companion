import { cookies } from 'next/headers'
import { db } from './db'

/**
 * PLACEHOLDER AUTH — replace with Firebase Auth in Phase 0.
 *
 * Everything downstream already takes a userId, so wiring real auth means
 * changing this one function: verify the Firebase ID token, look the user up
 * (or provision them), and return the row. Nothing else needs to move.
 */
export async function getCurrentUser() {
  const store = await cookies()
  const email = store.get('gc_user')?.value ?? 'demo@grace.local'

  const user = await db.user.findUnique({ where: { email } })
  if (user) return user

  return db.user.findUnique({ where: { email: 'demo@grace.local' } })
}

export async function requireUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}
