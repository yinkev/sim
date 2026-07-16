import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockBegin, mockEnd, mockTransaction, mockPostgres } = vi.hoisted(() => {
  const mockTransaction = vi.fn(async () => [])
  const mockBegin = vi.fn(async (run: (sql: typeof mockTransaction) => Promise<void>) => {
    await run(mockTransaction)
  })
  const mockEnd = vi.fn(async () => {})
  return {
    mockBegin,
    mockEnd,
    mockTransaction,
    mockPostgres: vi.fn(() => ({ begin: mockBegin, end: mockEnd })),
  }
})

vi.mock('postgres', () => ({ default: mockPostgres }))

import { ensureAnonymousUserExists } from '@/lib/auth/anonymous'

describe('anonymous user bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses one short-lived transaction and coalesces concurrent callers', async () => {
    await Promise.all([ensureAnonymousUserExists(), ensureAnonymousUserExists()])

    expect(mockPostgres).toHaveBeenCalledOnce()
    expect(mockBegin).toHaveBeenCalledOnce()
    expect(mockTransaction).toHaveBeenCalledTimes(2)
    expect(mockEnd).toHaveBeenCalledOnce()
  })
})
