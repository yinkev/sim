'use client'

import type React from 'react'
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { createLogger } from '@sim/logger'
import { usePathname } from 'next/navigation'
import { ANONYMOUS_USER, ANONYMOUS_USER_ID } from '@/lib/auth/constants'
import { extractSessionDataFromAuthClientResult } from '@/lib/auth/session-response'

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

const ANONYMOUS_SESSION: AppSession = {
  user: { ...ANONYMOUS_USER },
  session: {
    id: 'anonymous-session',
    userId: ANONYMOUS_USER_ID,
  },
}

export const SessionContext = createContext<SessionHookResult | null>(null)

const logger = createLogger('SessionProvider')

async function getAuthClient() {
  const { client } = await import('@/lib/auth/auth-client')
  return client
}

function isCenterPath(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname === '/center' ||
    pathname.startsWith('/center/') ||
    /^\/workspace\/[^/]+\/center(?:\/|$)/.test(pathname)
  )
}

interface SessionProviderProps {
  authDisabled: boolean
  children: React.ReactNode
}

export function SessionProvider({ authDisabled, children }: SessionProviderProps) {
  const pathname = usePathname()
  const useAnonymousSession = authDisabled && !isCenterPath(pathname)
  const [data, setData] = useState<AppSession>(() =>
    useAnonymousSession ? ANONYMOUS_SESSION : null
  )
  const [isPending, setIsPending] = useState(!useAnonymousSession)
  const [error, setError] = useState<Error | null>(null)

  const loadSession = useCallback(
    async (bypassCache = false) => {
      if (authDisabled) {
        setData(ANONYMOUS_SESSION)
        setError(null)
        setIsPending(false)
        return ANONYMOUS_SESSION
      }

      try {
        setIsPending(true)
        setError(null)
        const client = await getAuthClient()
        const res = bypassCache
          ? await client.getSession({ query: { disableCookieCache: true } })
          : await client.getSession()
        const session = extractSessionDataFromAuthClientResult(res) as AppSession
        setData(session)
        return session
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Failed to fetch session'))
        return null
      } finally {
        setIsPending(false)
      }
    },
    [authDisabled]
  )

  useEffect(() => {
    let isCancelled = false

    if (isCenterPath(pathname)) {
      setData(null)
      setError(null)
      setIsPending(false)
      return () => {
        isCancelled = true
      }
    }

    if (authDisabled) {
      setData(ANONYMOUS_SESSION)
      setError(null)
      setIsPending(false)
      return () => {
        isCancelled = true
      }
    }

    // Check if user was redirected after plan upgrade
    const params = new URLSearchParams(window.location.search)
    const wasUpgraded = params.get('upgraded') === 'true'

    if (wasUpgraded) {
      params.delete('upgraded')
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }

    const initializeSession = async () => {
      const session = await loadSession(wasUpgraded)

      if (!wasUpgraded || isCancelled) {
        return
      }

      const { getQueryClient } = await import('@/app/_shell/providers/get-query-client')
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      queryClient.invalidateQueries({ queryKey: ['subscription'] })

      const activeOrganizationId = session?.session?.activeOrganizationId ?? null
      if (activeOrganizationId) {
        return
      }

      try {
        const [{ requestJson }, { listCreatorOrganizationsContract }] = await Promise.all([
          import('@/lib/api/client/request'),
          import('@/lib/api/contracts/organizations'),
        ])
        const orgData = await requestJson(listCreatorOrganizationsContract, {}).catch(() => null)
        if (!orgData) return

        const organizationId = orgData.organizations?.[0]?.id

        if (!organizationId || isCancelled) {
          return
        }

        const client = await getAuthClient()
        await client.organization.setActive({ organizationId })

        if (!isCancelled) {
          await loadSession(true)
        }
      } catch (error) {
        logger.warn('Failed to activate organization after subscription upgrade', { error })
      }
    }

    void initializeSession()

    return () => {
      isCancelled = true
    }
  }, [authDisabled, loadSession, pathname])

  useEffect(() => {
    if (isPending) return
    if (isCenterPath(pathname)) return

    import('posthog-js')
      .then(({ default: posthog }) => {
        try {
          if (typeof posthog.identify !== 'function') return

          if (data?.user) {
            posthog.identify(data.user.id, {
              email: data.user.email,
              name: data.user.name,
              email_verified: data.user.emailVerified,
              created_at: data.user.createdAt,
            })
            if (
              typeof posthog.startSessionRecording === 'function' &&
              typeof posthog.sessionRecordingStarted === 'function' &&
              !posthog.sessionRecordingStarted()
            ) {
              posthog.startSessionRecording()
            }
          } else {
            posthog.reset()
          }
        } catch {}
      })
      .catch(() => {})
  }, [data, isPending, pathname])

  const refetch = useCallback(async () => {
    if (authDisabled && isCenterPath(pathname)) return
    await loadSession()
  }, [authDisabled, loadSession, pathname])

  const value = useMemo<SessionHookResult>(
    () => ({ data, isPending, error, refetch }),
    [data, isPending, error, refetch]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
