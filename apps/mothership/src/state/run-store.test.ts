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
  copilotRuns: {
    id: 'id',
    executionId: 'execution_id',
    parentRunId: 'parent_run_id',
    chatId: 'chat_id',
    streamId: 'stream_id',
    userId: 'user_id',
    workflowId: 'workflow_id',
    workspaceId: 'workspace_id',
    model: 'model',
    provider: 'provider',
    status: 'status',
    requestContext: 'request_context',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    createdAt: 'created_at',
    error: 'error',
    updatedAt: 'updated_at',
  },
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  eq: vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left: getColumnName(left), right })),
  inArray: vi.fn((left: unknown, right: unknown[]) => ({
    type: 'inArray',
    left: getColumnName(left),
    right,
  })),
}))

import {
  claimMothershipRuntimeRun,
  getMothershipRunByStream,
  markMothershipRunCancelled,
  markMothershipRunComplete,
  markMothershipRunFailed,
  markMothershipRunPausedForTool,
} from '@/state/run-store'

const PARENT_RUN_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_PARENT_RUN_ID = '22222222-2222-4222-8222-222222222222'

function latestWhereCondition(): unknown {
  const calls = dbChainMockFns.where.mock.calls as unknown as Array<[unknown]>
  return calls.at(-1)?.[0]
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

describe('mothership run store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
  })

  it('loads a run by stream and user', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      parentRunId: PARENT_RUN_ID,
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'active',
      completedAt: null,
      error: null,
    }
    dbChainMockFns.limit.mockResolvedValueOnce([row])

    await expect(
      getMothershipRunByStream({ streamId: 'stream-1', userId: 'user-1' })
    ).resolves.toEqual(row)

    expect(dbChainMockFns.select).toHaveBeenCalledWith(expect.any(Object))
    const conditions = expectAndCondition(latestWhereCondition(), 2)
    expectEqCondition(conditions[0]!, 'stream_id', 'stream-1')
    expectEqCondition(conditions[1]!, 'user_id', 'user-1')
    expect(dbChainMockFns.limit).toHaveBeenCalledWith(1)
  })

  it('returns null when no run exists for the stream and user', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([])

    await expect(
      getMothershipRunByStream({ streamId: 'stream-missing', userId: 'user-1' })
    ).resolves.toBeNull()
  })

  it('returns an existing runtime run for the same stream and user', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      parentRunId: null,
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'active',
      completedAt: null,
      error: null,
    }
    dbChainMockFns.limit.mockResolvedValueOnce([row])

    await expect(
      claimMothershipRuntimeRun({
        runId: 'run-1',
        executionId: 'exec-1',
        chatId: 'chat-1',
        userId: 'user-1',
        streamId: 'stream-1',
      })
    ).resolves.toEqual({ status: 'ready', run: row })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('rejects a runtime run claim when the stream belongs to another user', async () => {
    const row = {
      id: 'run-other',
      executionId: 'exec-other',
      parentRunId: null,
      chatId: 'chat-other',
      streamId: 'stream-1',
      userId: 'user-other',
      status: 'active',
      completedAt: null,
      error: null,
    }
    dbChainMockFns.limit.mockResolvedValueOnce([row])

    await expect(
      claimMothershipRuntimeRun({
        runId: 'run-1',
        executionId: 'exec-1',
        chatId: 'chat-1',
        userId: 'user-1',
        streamId: 'stream-1',
      })
    ).resolves.toEqual({ status: 'stream_conflict', run: row })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('rejects a runtime run claim when the stream has different durable run identity', async () => {
    const row = {
      id: 'run-existing',
      executionId: 'exec-existing',
      parentRunId: null,
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'active',
      completedAt: null,
      error: null,
    }
    dbChainMockFns.limit.mockResolvedValueOnce([row])

    await expect(
      claimMothershipRuntimeRun({
        runId: 'run-1',
        executionId: 'exec-1',
        chatId: 'chat-1',
        userId: 'user-1',
        streamId: 'stream-1',
      })
    ).resolves.toEqual({ status: 'run_identity_conflict', run: row })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('rejects a runtime run claim when the stream has different durable parent identity', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      parentRunId: PARENT_RUN_ID,
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'active',
      completedAt: null,
      error: null,
    }
    dbChainMockFns.limit.mockResolvedValueOnce([row])

    await expect(
      claimMothershipRuntimeRun({
        runId: 'run-1',
        executionId: 'exec-1',
        parentRunId: OTHER_PARENT_RUN_ID,
        chatId: 'chat-1',
        userId: 'user-1',
        streamId: 'stream-1',
      })
    ).resolves.toEqual({ status: 'run_identity_conflict', run: row })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('rejects a runtime run claim when the existing stream is already terminal', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      parentRunId: null,
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'complete',
      completedAt: new Date('2026-06-21T00:00:00.000Z'),
      error: null,
    }
    dbChainMockFns.limit.mockResolvedValueOnce([row])

    await expect(
      claimMothershipRuntimeRun({
        runId: 'run-1',
        executionId: 'exec-1',
        chatId: 'chat-1',
        userId: 'user-1',
        streamId: 'stream-1',
      })
    ).resolves.toEqual({ status: 'run_terminal', run: row })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('claims a new runtime run with the caller-provided run identity', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      parentRunId: PARENT_RUN_ID,
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'active',
      completedAt: null,
      error: null,
    }
    dbChainMockFns.limit.mockResolvedValueOnce([])
    dbChainMockFns.returning.mockResolvedValueOnce([row])

    await expect(
      claimMothershipRuntimeRun({
        runId: 'run-1',
        executionId: 'exec-1',
        parentRunId: PARENT_RUN_ID,
        chatId: 'chat-1',
        userId: 'user-1',
        workflowId: 'workflow-1',
        workspaceId: 'workspace-1',
        streamId: 'stream-1',
        model: 'claude-opus-4-8',
        provider: 'anthropic',
        requestContext: { requestId: 'req-1' },
      })
    ).resolves.toEqual({ status: 'ready', run: row })

    expect(dbChainMockFns.insert).toHaveBeenCalledTimes(1)
    expect(dbChainMockFns.values).toHaveBeenCalledWith({
      id: 'run-1',
      executionId: 'exec-1',
      parentRunId: PARENT_RUN_ID,
      chatId: 'chat-1',
      userId: 'user-1',
      workflowId: 'workflow-1',
      workspaceId: 'workspace-1',
      streamId: 'stream-1',
      model: 'claude-opus-4-8',
      provider: 'anthropic',
      requestContext: { requestId: 'req-1' },
      status: 'active',
      startedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
    expect(dbChainMockFns.onConflictDoNothing).toHaveBeenCalledWith({ target: 'stream_id' })
  })

  it('loads the stream winner when a concurrent runtime claim wins first', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      parentRunId: PARENT_RUN_ID,
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'active',
      completedAt: null,
      error: null,
    }
    dbChainMockFns.limit.mockResolvedValueOnce([])
    dbChainMockFns.returning.mockResolvedValueOnce([])
    dbChainMockFns.limit.mockResolvedValueOnce([row])

    await expect(
      claimMothershipRuntimeRun({
        runId: 'run-1',
        executionId: 'exec-1',
        parentRunId: PARENT_RUN_ID,
        chatId: 'chat-1',
        userId: 'user-1',
        streamId: 'stream-1',
      })
    ).resolves.toEqual({ status: 'ready', run: row })
  })

  it('rejects a concurrent runtime claim winner with a different parent identity', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      parentRunId: PARENT_RUN_ID,
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'active',
      completedAt: null,
      error: null,
    }
    dbChainMockFns.limit.mockResolvedValueOnce([])
    dbChainMockFns.returning.mockResolvedValueOnce([])
    dbChainMockFns.limit.mockResolvedValueOnce([row])

    await expect(
      claimMothershipRuntimeRun({
        runId: 'run-1',
        executionId: 'exec-1',
        parentRunId: OTHER_PARENT_RUN_ID,
        chatId: 'chat-1',
        userId: 'user-1',
        streamId: 'stream-1',
      })
    ).resolves.toEqual({ status: 'run_identity_conflict', run: row })
  })

  it('rejects a runtime run claim when the existing stream is already errored', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      parentRunId: null,
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'error',
      completedAt: new Date('2026-06-21T00:00:00.000Z'),
      error: 'owned_provider_credentials_missing',
    }
    dbChainMockFns.limit.mockResolvedValueOnce([row])

    await expect(
      claimMothershipRuntimeRun({
        runId: 'run-1',
        executionId: 'exec-1',
        chatId: 'chat-1',
        userId: 'user-1',
        streamId: 'stream-1',
      })
    ).resolves.toEqual({ status: 'run_terminal', run: row })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('marks an abortable run cancelled durably', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'cancelled',
      completedAt: new Date('2026-06-21T00:00:00.000Z'),
      error: 'user_abort',
    }
    dbChainMockFns.returning.mockResolvedValueOnce([row])

    await expect(
      markMothershipRunCancelled({
        streamId: 'stream-1',
        userId: 'user-1',
        reason: 'user_abort',
      })
    ).resolves.toEqual(row)

    expect(dbChainMockFns.update).toHaveBeenCalledTimes(1)
    expect(dbChainMockFns.set).toHaveBeenCalledWith({
      status: 'cancelled',
      completedAt: expect.any(Date),
      updatedAt: expect.any(Date),
      error: 'user_abort',
    })
    const conditions = expectAndCondition(latestWhereCondition(), 3)
    expectEqCondition(conditions[0]!, 'stream_id', 'stream-1')
    expectEqCondition(conditions[1]!, 'user_id', 'user-1')
    expect(conditions[2]).toMatchObject({
      type: 'inArray',
      left: 'status',
      right: ['active', 'paused_waiting_for_tool', 'resuming'],
    })
    expect(dbChainMockFns.returning).toHaveBeenCalledWith(expect.any(Object))
  })

  it('returns null when no abortable run was updated', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([])

    await expect(
      markMothershipRunCancelled({ streamId: 'stream-1', userId: 'user-1' })
    ).resolves.toBeNull()
  })

  it('marks a fail-able runtime run errored durably', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'error',
      completedAt: new Date('2026-06-21T00:00:00.000Z'),
      error: 'owned_provider_continuation_not_implemented',
    }
    dbChainMockFns.returning.mockResolvedValueOnce([row])

    await expect(
      markMothershipRunFailed({
        runId: 'run-1',
        error: 'owned_provider_continuation_not_implemented',
      })
    ).resolves.toEqual(row)

    expect(dbChainMockFns.update).toHaveBeenCalledTimes(1)
    expect(dbChainMockFns.set).toHaveBeenCalledWith({
      status: 'error',
      completedAt: expect.any(Date),
      updatedAt: expect.any(Date),
      error: 'owned_provider_continuation_not_implemented',
    })
    const conditions = expectAndCondition(latestWhereCondition(), 2)
    expectEqCondition(conditions[0]!, 'id', 'run-1')
    expect(conditions[1]).toMatchObject({
      type: 'inArray',
      left: 'status',
      right: ['active', 'paused_waiting_for_tool', 'resuming', 'error'],
    })
  })

  it('does not mark completed or cancelled runtime runs errored', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([])

    await expect(
      markMothershipRunFailed({
        runId: 'run-1',
        error: 'owned_provider_continuation_not_implemented',
      })
    ).resolves.toBeNull()
  })

  it('marks a completable runtime run complete durably', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'complete',
      completedAt: new Date('2026-06-21T00:00:00.000Z'),
      error: null,
    }
    dbChainMockFns.returning.mockResolvedValueOnce([row])

    await expect(markMothershipRunComplete({ runId: 'run-1' })).resolves.toEqual(row)

    expect(dbChainMockFns.update).toHaveBeenCalledTimes(1)
    expect(dbChainMockFns.set).toHaveBeenCalledWith({
      status: 'complete',
      completedAt: expect.any(Date),
      updatedAt: expect.any(Date),
      error: null,
    })
    const conditions = expectAndCondition(latestWhereCondition(), 2)
    expectEqCondition(conditions[0]!, 'id', 'run-1')
    expect(conditions[1]).toMatchObject({
      type: 'inArray',
      left: 'status',
      right: ['active', 'paused_waiting_for_tool', 'resuming'],
    })
  })

  it('does not mark terminal runtime runs complete again', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([])

    await expect(markMothershipRunComplete({ runId: 'run-1' })).resolves.toBeNull()
  })

  it('marks an active runtime run paused for an async tool checkpoint', async () => {
    const row = {
      id: 'run-1',
      executionId: 'exec-1',
      chatId: 'chat-1',
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'paused_waiting_for_tool',
      completedAt: null,
      error: null,
    }
    dbChainMockFns.returning.mockResolvedValueOnce([row])

    await expect(markMothershipRunPausedForTool({ runId: 'run-1' })).resolves.toEqual(row)

    expect(dbChainMockFns.update).toHaveBeenCalledTimes(1)
    expect(dbChainMockFns.set).toHaveBeenCalledWith({
      status: 'paused_waiting_for_tool',
      updatedAt: expect.any(Date),
    })
    const conditions = expectAndCondition(latestWhereCondition(), 2)
    expectEqCondition(conditions[0]!, 'id', 'run-1')
    expect(conditions[1]).toMatchObject({
      type: 'inArray',
      left: 'status',
      right: ['active', 'resuming'],
    })
  })

  it('does not pause terminal runtime runs for async tools', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([])

    await expect(markMothershipRunPausedForTool({ runId: 'run-1' })).resolves.toBeNull()
  })
})
