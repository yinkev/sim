/**
 * @vitest-environment jsdom
 */
import { act, useContext } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authDisabled: false,
  getQueryClient: vi.fn(),
  getSession: vi.fn(),
  pathname: '/workspace/workspace-1/home',
  posthogIdentify: vi.fn(),
  posthogReset: vi.fn(),
  requestJson: vi.fn(),
  setActive: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}))

vi.mock('@/app/_shell/providers/get-query-client', () => ({
  getQueryClient: mocks.getQueryClient,
}))

vi.mock('@/lib/auth/auth-client', () => ({
  client: {
    getSession: mocks.getSession,
    organization: { setActive: mocks.setActive },
  },
}))

vi.mock('@/lib/api/client/request', () => ({
  requestJson: mocks.requestJson,
}))

vi.mock('posthog-js', () => ({
  default: {
    identify: mocks.posthogIdentify,
    reset: mocks.posthogReset,
    sessionRecordingStarted: vi.fn(() => true),
    startSessionRecording: vi.fn(),
  },
}))

import { ANONYMOUS_USER, ANONYMOUS_USER_ID } from '@/lib/auth/constants'
import {
  SessionContext,
  type SessionHookResult,
  SessionProvider,
} from '@/app/_shell/providers/session-provider'

let observedSession: SessionHookResult | null = null

function SessionProbe() {
  observedSession = useContext(SessionContext)
  return null
}

async function flushUntil(predicate: () => boolean, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
  }
}

describe('SessionProvider auth mode', () => {
  let container: HTMLDivElement
  let queryClient: QueryClient
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.clearAllMocks()
    mocks.getQueryClient.mockReset()
    mocks.getSession.mockReset()
    mocks.posthogIdentify.mockReset()
    mocks.posthogReset.mockReset()
    mocks.requestJson.mockReset()
    mocks.setActive.mockReset()
    mocks.authDisabled = false
    mocks.pathname = '/workspace/workspace-1/home'
    mocks.requestJson.mockResolvedValue(null)
    observedSession = null
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mocks.getQueryClient.mockReturnValue(queryClient)
    window.history.replaceState({}, '', '/workspace/workspace-1/home')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    queryClient.clear()
    container.remove()
    vi.unstubAllGlobals()
  })

  async function renderProvider() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SessionProvider authDisabled={mocks.authDisabled}>
            <SessionProbe />
          </SessionProvider>
        </QueryClientProvider>
      )
    })
    await flushUntil(() => observedSession?.isPending === false)
  }

  it('uses anonymous context without session requests when auth is disabled', async () => {
    mocks.authDisabled = true

    await renderProvider()

    expect(observedSession).toMatchObject({
      data: {
        user: ANONYMOUS_USER,
        session: {
          id: 'anonymous-session',
          userId: ANONYMOUS_USER_ID,
        },
      },
      isPending: false,
      error: null,
    })
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.posthogIdentify).toHaveBeenCalledWith(
      ANONYMOUS_USER_ID,
      expect.objectContaining({ email: ANONYMOUS_USER.email })
    )

    await act(async () => observedSession?.refetch())

    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(observedSession?.data?.user?.id).toBe(ANONYMOUS_USER_ID)
  })

  it('loads and refetches through Better Auth when auth is enabled', async () => {
    const session = {
      user: { id: 'user-1', email: 'user@example.com' },
      session: { id: 'session-1', userId: 'user-1' },
    }
    mocks.getSession.mockResolvedValue({ data: session })

    await renderProvider()

    expect(mocks.getSession).toHaveBeenCalledTimes(1)
    expect(mocks.getSession).toHaveBeenLastCalledWith()
    expect(observedSession).toMatchObject({ data: session, isPending: false, error: null })
    expect(mocks.posthogIdentify).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ email: 'user@example.com' })
    )

    await act(async () => observedSession?.refetch())

    expect(mocks.getSession).toHaveBeenCalledTimes(2)
    expect(mocks.getSession).toHaveBeenLastCalledWith()
  })

  it('keeps auth-disabled Center sessionless without session requests', async () => {
    mocks.authDisabled = true
    mocks.pathname = '/center'

    await renderProvider()

    expect(observedSession).toMatchObject({ data: null, isPending: false, error: null })
    expect(mocks.getSession).not.toHaveBeenCalled()

    await act(async () => observedSession?.refetch())

    expect(observedSession?.data).toBeNull()
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('keeps auth-enabled Center mount behavior unchanged', async () => {
    mocks.pathname = '/center'
    mocks.getSession.mockResolvedValue({ data: null })

    await renderProvider()

    expect(observedSession).toMatchObject({ data: null, isPending: false, error: null })
    expect(mocks.getSession).not.toHaveBeenCalled()

    await act(async () => observedSession?.refetch())

    expect(mocks.getSession).toHaveBeenCalledTimes(1)
  })

  it('falls back to the cached session when the upgrade refresh fails', async () => {
    const session = {
      user: { id: 'user-1', email: 'user@example.com' },
      session: { id: 'session-1', userId: 'user-1', activeOrganizationId: 'org-1' },
    }
    mocks.getSession.mockRejectedValueOnce(new Error('refresh failed'))
    mocks.getSession.mockResolvedValueOnce({ data: session })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    window.history.replaceState({}, '', '/workspace/workspace-1/home?upgraded=true&keep=1')

    await renderProvider()

    expect(mocks.getSession).toHaveBeenNthCalledWith(1, {
      query: { disableCookieCache: true },
    })
    expect(mocks.getSession).toHaveBeenNthCalledWith(2)
    expect(observedSession).toMatchObject({ data: session, isPending: false, error: null })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['organizations'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['subscription'] })
    expect(window.location.search).toBe('?keep=1')
  })

  it('uses the fresh upgrade session without starting a stale session request', async () => {
    const session = {
      user: { id: 'user-1', email: 'user@example.com' },
      session: { id: 'session-1', userId: 'user-1', activeOrganizationId: 'org-1' },
    }
    mocks.getSession.mockResolvedValue({ data: session })
    window.history.replaceState({}, '', '/workspace/workspace-1/home?upgraded=true')

    await renderProvider()

    expect(mocks.getSession).toHaveBeenCalledTimes(1)
    expect(mocks.getSession).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    })
    expect(observedSession).toMatchObject({ data: session, isPending: false, error: null })
    expect(window.location.search).toBe('')
  })
})
