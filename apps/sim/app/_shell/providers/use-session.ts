'use client'

import { useContext } from 'react'
import { SessionContext, type SessionHookResult } from '@/app/_shell/providers/session-provider'

export function useSession(): SessionHookResult {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error(
      'SessionProvider is not mounted. Wrap your app with <SessionProvider> in app/layout.tsx.'
    )
  }
  return ctx
}
