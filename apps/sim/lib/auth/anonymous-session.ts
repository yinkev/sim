import { ANONYMOUS_USER, ANONYMOUS_USER_ID } from '@/lib/auth/constants'

export interface AnonymousSession {
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: null
    createdAt: Date
    updatedAt: Date
  }
  session: {
    id: string
    userId: string
    expiresAt: Date
    createdAt: Date
    updatedAt: Date
    token: string
    ipAddress: null
    userAgent: null
  }
}

/** Creates an anonymous session without accessing persistence. */
export function createAnonymousSession(): AnonymousSession {
  const now = new Date()
  return {
    user: {
      ...ANONYMOUS_USER,
      createdAt: now,
      updatedAt: now,
    },
    session: {
      id: 'anonymous-session',
      userId: ANONYMOUS_USER_ID,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      token: 'anonymous-token',
      ipAddress: null,
      userAgent: null,
    },
  }
}
