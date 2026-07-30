'use client'

import { useState, useEffect } from 'react'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

export function AuthModal() {
  const [user, setUser] = useState<User | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        // Sync session to HTTP-only cookie & DB
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoUrl: currentUser.photoURL,
          }),
        })
      }
    })
    return () => unsubscribe()
  }, [])

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      setIsOpen(false)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      setIsOpen(false)
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
    await fetch('/api/auth/session', { method: 'DELETE' })
    window.location.reload()
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-soft)' }}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="h-6 w-6 rounded-full" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-quiet)] font-medium text-[var(--accent)]">
              {user.email?.[0].toUpperCase() ?? 'U'}
            </div>
          )}
          <span className="hidden sm:inline">{user.email}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-full px-2.5 py-1 text-xs transition-colors hover:bg-[var(--accent-quiet)]"
          style={{ color: 'var(--text-soft)' }}
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        Sign In
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-6 shadow-xl"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--rule)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="serif text-lg font-semibold">
                {isSignUp ? 'Create Account' : 'Sign In to Grace Companion'}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-500 border border-red-500/20">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors hover:bg-[var(--accent-quiet)]"
              style={{ borderColor: 'var(--rule)' }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="my-4 flex items-center gap-3 text-xs" style={{ color: 'var(--text-soft)' }}>
              <div className="h-px flex-1" style={{ background: 'var(--rule)' }} />
              <span>or email</span>
              <div className="h-px flex-1" style={{ background: 'var(--rule)' }} />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-hidden focus:border-[var(--accent)]"
                  style={{ borderColor: 'var(--rule)', background: 'var(--surface)' }}
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-hidden focus:border-[var(--accent)]"
                  style={{ borderColor: 'var(--rule)', background: 'var(--surface)' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="mt-4 text-center text-xs" style={{ color: 'var(--text-soft)' }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-medium underline hover:text-[var(--accent)]"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
