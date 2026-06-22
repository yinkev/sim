import { dbChainMock, dbChainMockFns, resetDbChainMock } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getColumnName } = vi.hoisted(() => ({
  getColumnName: (column: unknown): string => {
    const namedColumn = column as { name?: unknown }
    return typeof namedColumn.name === 'string' ? namedColumn.name : String(column)
  },
}))

vi.mock('@sim/db', () => dbChainMock)
vi.mock('@sim/db/schema', () => ({
  apiKey: {
    id: 'api_key_id',
    userId: 'api_key_user_id',
    workspaceId: 'api_key_workspace_id',
    createdBy: 'api_key_created_by',
    name: 'api_key_name',
    key: 'api_key_key',
    keyHash: 'api_key_key_hash',
    type: 'api_key_type',
    lastUsed: 'api_key_last_used',
    createdAt: 'api_key_created_at',
    updatedAt: 'api_key_updated_at',
  },
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  desc: vi.fn((column: unknown) => ({ type: 'desc', column: getColumnName(column) })),
  eq: vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left: getColumnName(left), right })),
}))
vi.mock('@sim/security/tokens', () => ({
  generateSecureToken: vi.fn(() => 'token-body'),
}))
vi.mock('@sim/utils/id', () => ({
  generateShortId: vi.fn(() => 'api-key-1'),
}))

import { encrypt } from '@sim/security/encryption'
import {
  deleteMothershipApiKey,
  generateMothershipApiKey,
  listMothershipApiKeys,
} from './api-key-store'

const API_ENCRYPTION_KEY = 'b'.repeat(64)

function whereCondition(callIndex: number): unknown {
  const calls = dbChainMockFns.where.mock.calls as unknown as Array<[unknown]>
  return calls[callIndex]?.[0]
}

function expectAndCondition(
  condition: unknown,
  expectedChildCount: number
): Array<Record<string, unknown>> {
  expect(condition).toMatchObject({
    type: 'and',
    conditions: expect.any(Array),
  })
  const conditions = (condition as { conditions: Array<Record<string, unknown>> }).conditions
  expect(conditions).toHaveLength(expectedChildCount)
  return conditions
}

function expectEqCondition(
  condition: Record<string, unknown>,
  columnName: string,
  value: string
): void {
  expect(condition).toMatchObject({
    type: 'eq',
    left: columnName,
    right: value,
  })
}

describe('mothership API key store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
  })

  it('lists personal API keys with display-only values', async () => {
    const { encrypted } = await encrypt('sk-sim-token-body', Buffer.from(API_ENCRYPTION_KEY, 'hex'))
    dbChainMockFns.orderBy.mockResolvedValueOnce([
      {
        id: 'api-key-1',
        name: 'Default',
        key: encrypted,
        createdAt: new Date('2026-06-21T00:00:00.000Z'),
        lastUsed: null,
      },
    ])

    await expect(
      listMothershipApiKeys({
        userId: 'user-1',
        apiEncryptionKey: API_ENCRYPTION_KEY,
      })
    ).resolves.toEqual([
      {
        id: 'api-key-1',
        name: 'Default',
        displayKey: 'sk-sim-...body',
        createdAt: '2026-06-21T00:00:00.000Z',
        lastUsed: null,
      },
    ])

    const conditions = expectAndCondition(whereCondition(0), 2)
    expectEqCondition(conditions[0]!, 'api_key_user_id', 'user-1')
    expectEqCondition(conditions[1]!, 'api_key_type', 'personal')
  })

  it('does not expose encrypted list values when the encryption key is unavailable', async () => {
    const { encrypted } = await encrypt('sk-sim-token-body', Buffer.from(API_ENCRYPTION_KEY, 'hex'))
    dbChainMockFns.orderBy.mockResolvedValueOnce([
      {
        id: 'api-key-1',
        name: 'Default',
        key: encrypted,
        createdAt: null,
        lastUsed: null,
      },
    ])

    await expect(listMothershipApiKeys({ userId: 'user-1' })).resolves.toEqual([
      {
        id: 'api-key-1',
        name: 'Default',
        displayKey: '****',
        createdAt: null,
        lastUsed: null,
      },
    ])
  })

  it('generates encrypted personal API keys with deterministic hashes', async () => {
    await expect(
      generateMothershipApiKey({
        userId: 'user-1',
        name: 'Default',
        apiEncryptionKey: API_ENCRYPTION_KEY,
      })
    ).resolves.toEqual({
      id: 'api-key-1',
      apiKey: 'sk-sim-token-body',
    })

    const valuesCall = dbChainMockFns.values.mock.calls[0] as unknown as
      | [Record<string, unknown>]
      | undefined
    expect(valuesCall).toBeDefined()
    const values = valuesCall![0]
    expect(values).toMatchObject({
      id: 'api-key-1',
      userId: 'user-1',
      workspaceId: null,
      createdBy: 'user-1',
      name: 'Default',
      type: 'personal',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
    expect(typeof values.key).toBe('string')
    expect(values.key).not.toBe('sk-sim-token-body')
    expect(typeof values.keyHash).toBe('string')
  })

  it('deletes only the requesting user personal API key', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'api-key-1' }])

    await expect(
      deleteMothershipApiKey({
        userId: 'user-1',
        apiKeyId: 'api-key-1',
      })
    ).resolves.toEqual({ deleted: true })

    const conditions = expectAndCondition(whereCondition(0), 3)
    expectEqCondition(conditions[0]!, 'api_key_id', 'api-key-1')
    expectEqCondition(conditions[1]!, 'api_key_user_id', 'user-1')
    expectEqCondition(conditions[2]!, 'api_key_type', 'personal')
  })

  it('reports delete misses without deleting another user key', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([])

    await expect(
      deleteMothershipApiKey({
        userId: 'user-1',
        apiKeyId: 'api-key-missing',
      })
    ).resolves.toEqual({ deleted: false })
  })
})
