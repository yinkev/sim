import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateAnonymousSession } = vi.hoisted(() => ({
  mockCreateAnonymousSession: vi.fn(() => ({ user: { id: 'anonymous-user' } })),
}))

vi.mock('react', () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/anonymous-session', () => ({
  createAnonymousSession: mockCreateAnonymousSession,
}))

import { getPageSession } from '@/lib/auth/page-session-anonymous'

describe('anonymous page session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an anonymous session without bootstrapping persistence', async () => {
    await expect(getPageSession()).resolves.toEqual({ user: { id: 'anonymous-user' } })
    expect(mockCreateAnonymousSession).toHaveBeenCalledOnce()
  })
})
