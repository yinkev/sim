'use client'

import { createContext, type ReactNode } from 'react'
import { ANONYMOUS_USER, ANONYMOUS_USER_ID } from '@/lib/auth/constants'

export type AppSession = {
  user: {
    id: string
    email: string
    emailVerified?: boolean
    name?: string | null
    image?: string | null
    role?: string
    createdAt?: Date
    updatedAt?: Date
  } | null
  session?: {
    id?: string
    userId?: string
    activeOrganizationId?: string
    impersonatedBy?: string | null
  }
} | null

export type SessionHookResult = {
  data: AppSession
  isPending: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const refetch = (): Promise<void> => Promise.resolve()

const SESSION_RESULT: SessionHookResult = {
  data: {
    user: { ...ANONYMOUS_USER },
    session: { id: 'anonymous-session', userId: ANONYMOUS_USER_ID },
  },
  isPending: false,
  error: null,
  refetch,
}

export const SessionContext = createContext<SessionHookResult | null>(null)

interface SessionProviderProps {
  authDisabled: boolean
  children: ReactNode
}

/** Provides the dependency-free anonymous session in disabled-auth development. */
export function SessionProvider({ authDisabled, children }: SessionProviderProps) {
  if (!authDisabled) {
    throw new Error('Anonymous SessionProvider requires DISABLE_AUTH')
  }
  return <SessionContext.Provider value={SESSION_RESULT}>{children}</SessionContext.Provider>
}
