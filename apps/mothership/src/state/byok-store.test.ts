import { encrypt } from '@sim/security/encryption'
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
  workspaceBYOKKeys: {
    id: 'byok_id',
    workspaceId: 'byok_workspace_id',
    providerId: 'byok_provider_id',
    encryptedApiKey: 'byok_encrypted_api_key',
    name: 'byok_name',
    createdBy: 'byok_created_by',
    createdAt: 'byok_created_at',
    updatedAt: 'byok_updated_at',
  },
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  asc: vi.fn((column: unknown) => ({ type: 'asc', column: getColumnName(column) })),
  desc: vi.fn((column: unknown) => ({ type: 'desc', column: getColumnName(column) })),
  eq: vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left: getColumnName(left), right })),
}))

import {
  deleteMothershipByokProviderKeys,
  getMothershipByokProviderKey,
  listMothershipByokProviders,
  upsertMothershipByokProviderKey,
} from './byok-store'

const ENCRYPTION_KEY = 'a'.repeat(64)

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

describe('mothership BYOK store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
  })

  it('lists configured provider records without exposing encrypted keys', async () => {
    dbChainMockFns.orderBy.mockResolvedValueOnce([
      {
        providerId: 'anthropic',
        createdBy: 'admin-1',
        createdAt: new Date('2026-06-21T00:00:00.000Z'),
        updatedAt: new Date('2026-06-21T00:00:01.000Z'),
      },
    ])

    await expect(listMothershipByokProviders({ workspaceId: 'workspace-1' })).resolves.toEqual([
      {
        provider: 'anthropic',
        configured: true,
        createdBy: 'admin-1',
        createdAt: '2026-06-21T00:00:00.000Z',
        updatedAt: '2026-06-21T00:00:01.000Z',
      },
    ])

    expect(dbChainMockFns.select).toHaveBeenCalledWith({
      providerId: 'byok_provider_id',
      createdBy: 'byok_created_by',
      createdAt: 'byok_created_at',
      updatedAt: 'byok_updated_at',
    })
    expect(whereCondition(0)).toMatchObject({
      type: 'eq',
      left: 'byok_workspace_id',
      right: 'workspace-1',
    })
  })

  it('inserts a new encrypted provider key when none exists', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([])

    await expect(
      upsertMothershipByokProviderKey({
        workspaceId: 'workspace-1',
        provider: 'anthropic',
        apiKey: 'sk-ant-secret',
        encryptionKey: ENCRYPTION_KEY,
        createdBy: 'admin-1',
      })
    ).resolves.toEqual({ workspaceId: 'workspace-1', provider: 'anthropic' })

    const valuesCall = dbChainMockFns.values.mock.calls[0] as unknown as
      | [Record<string, unknown>]
      | undefined
    expect(valuesCall).toBeDefined()
    const values = valuesCall![0]
    expect(values).toMatchObject({
      workspaceId: 'workspace-1',
      providerId: 'anthropic',
      name: null,
      createdBy: 'admin-1',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
    expect(typeof values.encryptedApiKey).toBe('string')
    expect(values.encryptedApiKey).not.toBe('sk-ant-secret')
  })

  it('updates an existing provider key instead of inserting a duplicate', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([{ id: 'key-1' }])

    await expect(
      upsertMothershipByokProviderKey({
        workspaceId: 'workspace-1',
        provider: 'anthropic',
        apiKey: 'sk-ant-secret',
        encryptionKey: ENCRYPTION_KEY,
      })
    ).resolves.toEqual({ workspaceId: 'workspace-1', provider: 'anthropic' })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
    const setCall = dbChainMockFns.set.mock.calls[0] as unknown as
      | [Record<string, unknown>]
      | undefined
    expect(setCall).toBeDefined()
    const set = setCall![0]
    expect(typeof set.encryptedApiKey).toBe('string')
    expect(set.encryptedApiKey).not.toBe('sk-ant-secret')
    expect(set.updatedAt).toEqual(expect.any(Date))
    expect(whereCondition(1)).toMatchObject({
      type: 'eq',
      left: 'byok_id',
      right: 'key-1',
    })
  })

  it('deletes all keys for a workspace provider', async () => {
    await expect(
      deleteMothershipByokProviderKeys({
        workspaceId: 'workspace-1',
        provider: 'anthropic',
      })
    ).resolves.toEqual({ workspaceId: 'workspace-1', provider: 'anthropic' })

    const conditions = expectAndCondition(whereCondition(0), 2)
    expectEqCondition(conditions[0]!, 'byok_workspace_id', 'workspace-1')
    expectEqCondition(conditions[1]!, 'byok_provider_id', 'anthropic')
  })

  it('returns a decrypted provider key for runtime use', async () => {
    const { encrypted } = await encrypt('sk-ant-secret', Buffer.from(ENCRYPTION_KEY, 'hex'))
    dbChainMockFns.orderBy.mockResolvedValueOnce([{ encryptedApiKey: encrypted }])

    await expect(
      getMothershipByokProviderKey({
        workspaceId: 'workspace-1',
        provider: 'anthropic',
        encryptionKey: ENCRYPTION_KEY,
      })
    ).resolves.toEqual({
      workspaceId: 'workspace-1',
      provider: 'anthropic',
      apiKey: 'sk-ant-secret',
    })

    expect(dbChainMockFns.select).toHaveBeenCalledWith({
      encryptedApiKey: 'byok_encrypted_api_key',
    })
    const conditions = expectAndCondition(whereCondition(0), 2)
    expectEqCondition(conditions[0]!, 'byok_workspace_id', 'workspace-1')
    expectEqCondition(conditions[1]!, 'byok_provider_id', 'anthropic')
  })

  it('skips corrupt provider keys and returns the newest decryptable key', async () => {
    const { encrypted } = await encrypt('sk-ant-valid', Buffer.from(ENCRYPTION_KEY, 'hex'))
    dbChainMockFns.orderBy.mockResolvedValueOnce([
      { encryptedApiKey: 'not-valid-ciphertext' },
      { encryptedApiKey: encrypted },
    ])

    await expect(
      getMothershipByokProviderKey({
        workspaceId: 'workspace-1',
        provider: 'anthropic',
        encryptionKey: ENCRYPTION_KEY,
      })
    ).resolves.toEqual({
      workspaceId: 'workspace-1',
      provider: 'anthropic',
      apiKey: 'sk-ant-valid',
    })
  })

  it('returns null when all stored provider keys are corrupt', async () => {
    dbChainMockFns.orderBy.mockResolvedValueOnce([
      { encryptedApiKey: 'not-valid-ciphertext' },
      { encryptedApiKey: 'also-not-valid-ciphertext' },
    ])

    await expect(
      getMothershipByokProviderKey({
        workspaceId: 'workspace-1',
        provider: 'anthropic',
        encryptionKey: ENCRYPTION_KEY,
      })
    ).resolves.toBeNull()
  })

  it('returns null when no provider key is stored', async () => {
    dbChainMockFns.orderBy.mockResolvedValueOnce([])

    await expect(
      getMothershipByokProviderKey({
        workspaceId: 'workspace-1',
        provider: 'anthropic',
        encryptionKey: ENCRYPTION_KEY,
      })
    ).resolves.toBeNull()
  })
})
