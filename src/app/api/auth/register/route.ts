import { NextResponse } from 'next/server'
import { createToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import type { User } from '@/types'

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json()

    const newUser: User = {
      id: 'u_new_' + Date.now(),
      name,
      email,
      role: 'phd',
      avatar: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      department: 'Computer Science',
      joinedAt: new Date().toISOString(),
      researchDNA: [],
      labId: 'lab1',
    }

    const token = await createToken(newUser.id)
    const cookieStore = await cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ user: newUser })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
