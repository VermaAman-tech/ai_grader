import { SignJWT, jwtVerify } from 'jose'
import { users } from './mock-data'
import type { User } from '@/types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'researchos-demo-secret-key-change-in-production-2024'
)

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { userId: string }
  } catch {
    return null
  }
}

const DEMO_PASSWORD = 'demo123'

export function authenticateUser(email: string, password: string): User | null {
  if (password !== DEMO_PASSWORD) return null
  const user = users.find(u => u.email === email)
  if (user) return user
  return null
}

export const DEMO_ACCOUNTS = users.map(u => ({
  email: u.email,
  name: u.name,
  role: u.role,
  password: DEMO_PASSWORD,
}))
