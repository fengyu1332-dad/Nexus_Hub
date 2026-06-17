/**
 * Minimal JWT helper for email verification tokens.
 * Uses Web Crypto API (jose) — works in Edge/Node.js.
 */
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'nexus-hub-dev-secret')

export async function signVerificationToken(userId: string): Promise<string> {
  return new SignJWT({ userId, purpose: 'verify-email' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(secret)
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.purpose !== 'verify-email') return null
    return { userId: payload.userId as string }
  } catch {
    return null
  }
}
