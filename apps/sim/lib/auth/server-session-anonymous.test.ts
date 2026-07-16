import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authState, mockCreateAnonymousSession, mockEnsureAnonymousUserExists } = vi.hoisted(() => ({
  authState: { disabled: true },
  mockCreateAnonymousSession: vi.fn(() => ({ user: { id: 'anonymous-user' } })),
  mockEnsureAnonymousUserExists: vi.fn(),
}))

vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/anonymous', () => ({
  createAnonymousSession: mockCreateAnonymousSession,
  ensureAnonymousUserExists: mockEnsureAnonymousUserExists,
}))
vi.mock('@/lib/core/config/env-flags', () => ({
  get isAuthDisabled() {
    return authState.disabled
  },
}))

import { getServerSession } from '@/lib/auth/server-session-anonymous'

describe('anonymous-only getServerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.disabled = true
  })

  it('returns the anonymous session when auth is disabled', async () => {
    await expect(getServerSession()).resolves.toEqual({ user: { id: 'anonymous-user' } })
    expect(mockEnsureAnonymousUserExists).toHaveBeenCalledOnce()
    expect(mockCreateAnonymousSession).toHaveBeenCalledOnce()
  })

  it('fails closed if the module is reached while auth is enabled', async () => {
    authState.disabled = false

    await expect(getServerSession()).rejects.toThrow(
      'Anonymous session boundary requires DISABLE_AUTH'
    )
    expect(mockEnsureAnonymousUserExists).not.toHaveBeenCalled()
    expect(mockCreateAnonymousSession).not.toHaveBeenCalled()
  })
})
