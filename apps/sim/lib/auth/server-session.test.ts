import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  authState,
  mockCreateAnonymousSession,
  mockEnsureAnonymousUserExists,
  mockGetSession,
  mockHeaders,
} = vi.hoisted(() => ({
  authState: { disabled: false },
  mockCreateAnonymousSession: vi.fn(() => ({ user: { id: 'anonymous-user' } })),
  mockEnsureAnonymousUserExists: vi.fn(),
  mockGetSession: vi.fn(),
  mockHeaders: vi.fn(),
}))

vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: mockHeaders }))
vi.mock('@sim/auth/verify', () => ({
  createVerifyAuth: () => ({ api: { getSession: mockGetSession } }),
}))
vi.mock('@/lib/auth/anonymous', () => ({
  createAnonymousSession: mockCreateAnonymousSession,
  ensureAnonymousUserExists: mockEnsureAnonymousUserExists,
}))
vi.mock('@/lib/core/config/env', () => ({
  env: { BETTER_AUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters' },
}))
vi.mock('@/lib/core/config/env-flags', () => ({
  get isAuthDisabled() {
    return authState.disabled
  },
}))
vi.mock('@/lib/core/utils/urls', () => ({ getBaseUrl: () => 'http://localhost:6888' }))

import { getServerSession } from '@/lib/auth/server-session'

describe('getServerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.disabled = false
  })

  it('returns the anonymous session without reading request headers when auth is disabled', async () => {
    authState.disabled = true

    await expect(getServerSession()).resolves.toEqual({ user: { id: 'anonymous-user' } })
    expect(mockEnsureAnonymousUserExists).toHaveBeenCalledOnce()
    expect(mockHeaders).not.toHaveBeenCalled()
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('forces a read-only database session verification when auth is enabled', async () => {
    const requestHeaders = new Headers({ cookie: 'better-auth.session_token=signed' })
    const session = { user: { id: 'user-1' }, session: { activeOrganizationId: 'org-1' } }
    mockHeaders.mockResolvedValue(requestHeaders)
    mockGetSession.mockResolvedValue(session)

    await expect(getServerSession()).resolves.toBe(session)
    expect(mockGetSession).toHaveBeenCalledWith({
      headers: requestHeaders,
      query: { disableCookieCache: true, disableRefresh: true },
    })
  })
})
