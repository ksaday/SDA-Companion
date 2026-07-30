import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { email, displayName, photoUrl, uid } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Provision or update user record in database
    const user = await db.user.upsert({
      where: { email },
      update: {
        displayName: displayName || email.split('@')[0],
        photoUrl: photoUrl || null,
      },
      create: {
        email,
        displayName: displayName || email.split('@')[0],
        photoUrl: photoUrl || null,
        role: 'member',
        tier: 'free',
      },
    })

    const cookieStore = await cookies()
    cookieStore.set('gc_user', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return NextResponse.json({ success: true, user })
  } catch (err) {
    console.error('Session sync error:', err)
    return NextResponse.json({ error: 'Failed to sync session' }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('gc_user')
  return NextResponse.json({ success: true })
}
