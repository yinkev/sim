import { dbChainMock, dbChainMockFns, resetDbChainMock } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getColumnName, mockGetLatestMothershipRunEventSeq } = vi.hoisted(() => ({
  getColumnName: (column: unknown): string => {
    const namedColumn = column as { name?: unknown }
    return typeof namedColumn.name === 'string' ? namedColumn.name : String(column)
  },
  mockGetLatestMothershipRunEventSeq: vi.fn(),
}))

vi.mock('@sim/db', () => dbChainMock)
vi.mock('@sim/db/schema', () => ({
  copilotRuns: {
    id: 'run_id',
    streamId: 'stream_id',
    userId: 'user_id',
    workspaceId: 'workspace_id',
    status: 'run_status',
    updatedAt: 'run_updated_at',
  },
  copilotRunCheckpoints: {
    id: 'checkpoint_id',
    runId: 'checkpoint_run_id',
    pendingToolCallId: 'pending_tool_call_id',
    conversationSnapshot: 'conversation_snapshot',
    agentState: 'agent_state',
    providerRequest: 'provider_request',
    resumeEventStartSeq: 'resume_event_start_seq',
    createdAt: 'checkpoint_created_at',
    updatedAt: 'checkpoint_updated_at',
  },
  copilotAsyncToolCalls: {
    id: 'tool_row_id',
    runId: 'tool_run_id',
    checkpointId: 'tool_checkpoint_id',
    toolCallId: 'tool_call_id',
    toolName: 'tool_name',
    args: 'tool_args',
    status: 'tool_status',
    result: 'tool_result',
    error: 'tool_error',
    claimedAt: 'tool_claimed_at',
    claimedBy: 'tool_claimed_by',
    completedAt: 'tool_completed_at',
    createdAt: 'tool_created_at',
    updatedAt: 'tool_updated_at',
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
  isNull: vi.fn((column: unknown) => ({ type: 'isNull', left: getColumnName(column) })),
}))
vi.mock('@/state/stream-event-store', () => ({
  getLatestMothershipRunEventSeq: mockGetLatestMothershipRunEventSeq,
}))

import {
  createMothershipToolCheckpoint,
  getMothershipResumeCheckpoint,
  getOrSetMothershipResumeEventStartSeq,
  markMothershipResumeToolResultDelivered,
  recordMothershipResumeToolResults,
} from './resume-store'

type WhereBuilder = Promise<unknown[]> & {
  limit: typeof dbChainMockFns.limit
  orderBy: typeof dbChainMockFns.orderBy
  returning: typeof dbChainMockFns.returning
  groupBy: typeof dbChainMockFns.groupBy
  for: typeof dbChainMockFns.for
}

function whereBuilder(rows: unknown[] = []): WhereBuilder {
  const builder = Promise.resolve(rows) as WhereBuilder
  builder.limit = dbChainMockFns.limit
  builder.orderBy = dbChainMockFns.orderBy
  builder.returning = dbChainMockFns.returning
  builder.groupBy = dbChainMockFns.groupBy
  builder.for = dbChainMockFns.for
  return builder
}

function queueCheckpointAndTools(checkpoint: unknown | null, tools: unknown[]): void {
  dbChainMockFns.where
    .mockImplementationOnce(() => whereBuilder())
    .mockImplementationOnce(() => whereBuilder(tools))
  dbChainMockFns.limit.mockResolvedValueOnce(checkpoint ? [checkpoint] : [])
}

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

const checkpointRow = {
  checkpointId: 'checkpoint-1',
  runId: 'run-1',
  streamId: 'stream-1',
  userId: 'user-1',
  workspaceId: 'workspace-1',
  runStatus: 'paused_waiting_for_tool',
  pendingToolCallId: 'tool-1',
  conversationSnapshot: { messages: [] },
  agentState: {},
  providerRequest: {},
  resumeEventStartSeq: null,
}

const pendingToolRow = {
  id: 'tool-row-1',
  runId: 'run-1',
  checkpointId: 'checkpoint-1',
  toolCallId: 'tool-1',
  toolName: 'read_workflow',
  status: 'running',
  result: null,
  error: null,
  completedAt: null,
}

describe('mothership resume store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
    mockGetLatestMothershipRunEventSeq.mockResolvedValue(3)
  })

  it('loads a resume checkpoint by checkpoint, stream, and user', async () => {
    queueCheckpointAndTools(checkpointRow, [pendingToolRow])

    await expect(
      getMothershipResumeCheckpoint({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
      })
    ).resolves.toEqual({ ...checkpointRow, toolCalls: [pendingToolRow] })

    expect(dbChainMockFns.innerJoin).toHaveBeenCalledWith(expect.any(Object), {
      type: 'eq',
      left: 'checkpoint_run_id',
      right: 'run_id',
    })
    const lookupConditions = expectAndCondition(whereCondition(0), 3)
    expectEqCondition(lookupConditions[0]!, 'checkpoint_id', 'checkpoint-1')
    expectEqCondition(lookupConditions[1]!, 'stream_id', 'stream-1')
    expectEqCondition(lookupConditions[2]!, 'user_id', 'user-1')
    expect(whereCondition(1)).toMatchObject({
      type: 'eq',
      left: 'tool_checkpoint_id',
      right: 'checkpoint-1',
    })
  })

  it('can require a durable workspace match when loading a resume checkpoint', async () => {
    queueCheckpointAndTools(checkpointRow, [pendingToolRow])

    await expect(
      getMothershipResumeCheckpoint({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
      })
    ).resolves.toEqual({ ...checkpointRow, toolCalls: [pendingToolRow] })

    const lookupConditions = expectAndCondition(whereCondition(0), 4)
    expectEqCondition(lookupConditions[0]!, 'checkpoint_id', 'checkpoint-1')
    expectEqCondition(lookupConditions[1]!, 'stream_id', 'stream-1')
    expectEqCondition(lookupConditions[2]!, 'user_id', 'user-1')
    expectEqCondition(lookupConditions[3]!, 'workspace_id', 'workspace-1')
  })

  it('creates a provider checkpoint and running async tool rows', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'checkpoint-new' }])

    await expect(
      createMothershipToolCheckpoint({
        runId: 'run-1',
        pendingToolCalls: [
          {
            toolCallId: 'tool-1',
            toolName: 'read_workflow',
            args: { workflowId: 'workflow-1' },
          },
        ],
        conversationSnapshot: { messages: [{ role: 'user', content: 'hello' }] },
        agentState: { provider: 'anthropic' },
        providerRequest: { provider: 'anthropic', request: { messages: [] } },
      })
    ).resolves.toEqual({
      status: 'ready',
      checkpointId: expect.any(String),
      pendingToolCallIds: ['tool-1'],
    })

    expect(dbChainMockFns.insert).toHaveBeenNthCalledWith(1, expect.any(Object))
    expect(dbChainMockFns.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        runId: 'run-1',
        pendingToolCallId: 'tool-1',
        conversationSnapshot: { messages: [{ role: 'user', content: 'hello' }] },
        agentState: { provider: 'anthropic' },
        providerRequest: { provider: 'anthropic', request: { messages: [] } },
      })
    )
    expect(dbChainMockFns.onConflictDoNothing).toHaveBeenNthCalledWith(1, {
      target: ['checkpoint_run_id', 'pending_tool_call_id'],
    })
    expect(dbChainMockFns.insert).toHaveBeenNthCalledWith(2, expect.any(Object))
    expect(dbChainMockFns.values).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        runId: 'run-1',
        checkpointId: expect.any(String),
        toolCallId: 'tool-1',
        toolName: 'read_workflow',
        args: { workflowId: 'workflow-1' },
        status: 'running',
      }),
    ])
    expect(dbChainMockFns.onConflictDoNothing).toHaveBeenNthCalledWith(2, {
      target: 'tool_call_id',
    })
  })

  it('rejects checkpoint creation when no tool calls are pending', async () => {
    await expect(
      createMothershipToolCheckpoint({
        runId: 'run-1',
        pendingToolCalls: [],
        providerRequest: {},
      })
    ).resolves.toEqual({ status: 'missing_tool_calls' })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('sets a stable resume event start seq the first time a checkpoint resumes', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([{ resumeEventStartSeq: 3 }])

    await expect(
      getOrSetMothershipResumeEventStartSeq({
        checkpointId: 'checkpoint-1',
        runId: 'run-1',
        proposedStartSeq: 3,
      })
    ).resolves.toBe(3)

    expect(dbChainMockFns.update).toHaveBeenCalledWith(expect.any(Object))
    expect(dbChainMockFns.set).toHaveBeenCalledWith({
      resumeEventStartSeq: 3,
      updatedAt: expect.any(Date),
    })
    const conditions = expectAndCondition(whereCondition(0), 3)
    expectEqCondition(conditions[0]!, 'checkpoint_id', 'checkpoint-1')
    expectEqCondition(conditions[1]!, 'checkpoint_run_id', 'run-1')
    expect(conditions[2]).toEqual({ type: 'isNull', left: 'resume_event_start_seq' })
  })

  it('reuses the existing resume event start seq on retry', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([])
    dbChainMockFns.limit.mockResolvedValueOnce([{ resumeEventStartSeq: 3 }])

    await expect(
      getOrSetMothershipResumeEventStartSeq({
        checkpointId: 'checkpoint-1',
        runId: 'run-1',
        proposedStartSeq: 5,
      })
    ).resolves.toBe(3)

    expect(dbChainMockFns.select).toHaveBeenCalledWith({
      resumeEventStartSeq: 'resume_event_start_seq',
    })
    const conditions = expectAndCondition(whereCondition(1), 2)
    expectEqCondition(conditions[0]!, 'checkpoint_id', 'checkpoint-1')
    expectEqCondition(conditions[1]!, 'checkpoint_run_id', 'run-1')
  })

  it('records resume results and marks the run resuming', async () => {
    const recordedTool = {
      ...pendingToolRow,
      status: 'completed',
      result: { ok: true },
      completedAt: new Date('2026-06-21T00:00:00.000Z'),
    }
    queueCheckpointAndTools(checkpointRow, [pendingToolRow])
    dbChainMockFns.returning
      .mockResolvedValueOnce([{ id: 'run-1' }])
      .mockResolvedValueOnce([recordedTool])
      .mockResolvedValueOnce([{ resumeEventStartSeq: 3 }])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [{ callId: 'tool-1', name: 'read_workflow', data: { ok: true }, success: true }],
      })
    ).resolves.toMatchObject({
      status: 'ready',
      recordedResults: [recordedTool],
      resumeEventStartSeq: 3,
    })

    expect(dbChainMockFns.transaction).toHaveBeenCalledTimes(1)
    expect(dbChainMockFns.update).toHaveBeenCalledTimes(3)
    expect(dbChainMockFns.set).toHaveBeenNthCalledWith(1, {
      status: 'resuming',
      updatedAt: expect.any(Date),
    })
    expect(dbChainMockFns.set).toHaveBeenNthCalledWith(2, {
      status: 'completed',
      result: { ok: true },
      error: null,
      completedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
    expect(dbChainMockFns.set).toHaveBeenNthCalledWith(3, {
      resumeEventStartSeq: 3,
      updatedAt: expect.any(Date),
    })
    expect(mockGetLatestMothershipRunEventSeq).toHaveBeenCalledWith(
      { streamId: 'stream-1' },
      expect.anything()
    )
    const runUpdateConditions = expectAndCondition(whereCondition(2), 2)
    expectEqCondition(runUpdateConditions[0]!, 'run_id', 'run-1')
    expect(runUpdateConditions[1]).toMatchObject({
      type: 'inArray',
      left: 'run_status',
      right: ['paused_waiting_for_tool'],
    })
    const toolUpdateConditions = expectAndCondition(whereCondition(3), 3)
    expectEqCondition(toolUpdateConditions[0]!, 'tool_checkpoint_id', 'checkpoint-1')
    expectEqCondition(toolUpdateConditions[1]!, 'tool_call_id', 'tool-1')
    expect(toolUpdateConditions[2]).toMatchObject({
      type: 'inArray',
      left: 'tool_status',
      right: ['pending', 'running'],
    })
  })

  it('records cancelled resume results with a readable error', async () => {
    const recordedTool = {
      ...pendingToolRow,
      status: 'cancelled',
      result: { cancelled: true },
      error: 'Tool cancelled',
      completedAt: new Date('2026-06-21T00:00:00.000Z'),
    }
    queueCheckpointAndTools(checkpointRow, [pendingToolRow])
    dbChainMockFns.returning
      .mockResolvedValueOnce([{ id: 'run-1' }])
      .mockResolvedValueOnce([recordedTool])
      .mockResolvedValueOnce([{ resumeEventStartSeq: 3 }])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [
          {
            callId: 'tool-1',
            name: 'read_workflow',
            data: { cancelled: true },
            success: false,
          },
        ],
      })
    ).resolves.toMatchObject({
      status: 'ready',
      recordedResults: [recordedTool],
    })

    expect(dbChainMockFns.set).toHaveBeenNthCalledWith(2, {
      status: 'cancelled',
      result: { cancelled: true },
      error: 'Tool cancelled',
      completedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
  })

  it('returns missing_checkpoint without touching state when the checkpoint is absent', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-missing',
        userId: 'user-1',
        results: [{ callId: 'tool-1', name: 'read_workflow', data: {}, success: true }],
      })
    ).resolves.toEqual({ status: 'missing_checkpoint' })

    expect(dbChainMockFns.update).not.toHaveBeenCalled()
  })

  it('rejects duplicate result call ids before updating state', async () => {
    queueCheckpointAndTools(checkpointRow, [pendingToolRow])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [
          { callId: 'tool-1', name: 'read_workflow', data: {}, success: true },
          { callId: 'tool-1', name: 'read_workflow', data: {}, success: true },
        ],
      })
    ).resolves.toMatchObject({
      status: 'invalid_results',
      reason: 'duplicate_result',
      toolCallIds: ['tool-1'],
    })

    expect(dbChainMockFns.update).not.toHaveBeenCalled()
  })

  it('marks a durably streamed resume tool result delivered', async () => {
    const deliveredTool = {
      ...pendingToolRow,
      status: 'delivered',
      result: { ok: true },
      completedAt: new Date('2026-06-21T00:00:00.000Z'),
    }
    dbChainMockFns.returning.mockResolvedValueOnce([deliveredTool])

    await expect(
      markMothershipResumeToolResultDelivered({
        checkpointId: 'checkpoint-1',
        toolCallId: 'tool-1',
      })
    ).resolves.toEqual(deliveredTool)

    expect(dbChainMockFns.set).toHaveBeenCalledWith({
      status: 'delivered',
      claimedAt: null,
      claimedBy: null,
      updatedAt: expect.any(Date),
    })
    const conditions = expectAndCondition(whereCondition(0), 3)
    expectEqCondition(conditions[0]!, 'tool_checkpoint_id', 'checkpoint-1')
    expectEqCondition(conditions[1]!, 'tool_call_id', 'tool-1')
    expect(conditions[2]).toMatchObject({
      type: 'inArray',
      left: 'tool_status',
      right: ['completed', 'failed', 'cancelled'],
    })
  })

  it('rejects already delivered tool rows as consumed checkpoints', async () => {
    queueCheckpointAndTools(checkpointRow, [{ ...pendingToolRow, status: 'delivered' }])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [{ callId: 'tool-1', name: 'read_workflow', data: {}, success: true }],
      })
    ).resolves.toMatchObject({
      status: 'checkpoint_already_consumed',
      toolCallIds: ['tool-1'],
    })

    expect(dbChainMockFns.update).not.toHaveBeenCalled()
  })

  it('rejects non-resumable run statuses before updating state', async () => {
    queueCheckpointAndTools({ ...checkpointRow, runStatus: 'complete' }, [pendingToolRow])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [{ callId: 'tool-1', name: 'read_workflow', data: {}, success: true }],
      })
    ).resolves.toMatchObject({
      status: 'run_not_resumable',
      runStatus: 'complete',
    })

    expect(dbChainMockFns.update).not.toHaveBeenCalled()
  })

  it('rejects duplicate resume producers while the run is already resuming', async () => {
    queueCheckpointAndTools({ ...checkpointRow, runStatus: 'resuming' }, [pendingToolRow])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [{ callId: 'tool-1', name: 'read_workflow', data: {}, success: true }],
      })
    ).resolves.toMatchObject({
      status: 'run_not_resumable',
      runStatus: 'resuming',
    })

    expect(dbChainMockFns.update).not.toHaveBeenCalled()
    expect(mockGetLatestMothershipRunEventSeq).not.toHaveBeenCalled()
  })

  it('rejects unknown result call ids before updating state', async () => {
    queueCheckpointAndTools(checkpointRow, [pendingToolRow])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [{ callId: 'tool-missing', name: 'read_workflow', data: {}, success: true }],
      })
    ).resolves.toMatchObject({
      status: 'invalid_results',
      reason: 'unknown_tool_call',
      toolCallIds: ['tool-missing'],
    })

    expect(dbChainMockFns.update).not.toHaveBeenCalled()
  })

  it('rejects missing result call ids before updating state', async () => {
    const secondTool = { ...pendingToolRow, id: 'tool-row-2', toolCallId: 'tool-2' }
    queueCheckpointAndTools(checkpointRow, [pendingToolRow, secondTool])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [{ callId: 'tool-1', name: 'read_workflow', data: {}, success: true }],
      })
    ).resolves.toMatchObject({
      status: 'invalid_results',
      reason: 'missing_tool_result',
      toolCallIds: ['tool-2'],
    })

    expect(dbChainMockFns.update).not.toHaveBeenCalled()
  })

  it('accepts idempotent terminal results only when payload and error match', async () => {
    const terminalTool = {
      ...pendingToolRow,
      status: 'completed',
      result: { nested: { a: 1, b: 2 } },
      completedAt: new Date('2026-06-21T00:00:00.000Z'),
    }
    queueCheckpointAndTools(checkpointRow, [terminalTool])
    dbChainMockFns.returning
      .mockResolvedValueOnce([{ id: 'run-1' }])
      .mockResolvedValueOnce([{ resumeEventStartSeq: 3 }])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [
          {
            callId: 'tool-1',
            name: 'read_workflow',
            data: { nested: { b: 2, a: 1 } },
            success: true,
          },
        ],
      })
    ).resolves.toMatchObject({
      status: 'ready',
      recordedResults: [terminalTool],
      resumeEventStartSeq: 3,
    })

    expect(dbChainMockFns.update).toHaveBeenCalledTimes(2)
    expect(dbChainMockFns.set).toHaveBeenNthCalledWith(1, {
      status: 'resuming',
      updatedAt: expect.any(Date),
    })
    expect(dbChainMockFns.set).toHaveBeenNthCalledWith(2, {
      resumeEventStartSeq: 3,
      updatedAt: expect.any(Date),
    })
  })

  it('rejects terminal result retries when payload differs', async () => {
    queueCheckpointAndTools(checkpointRow, [
      {
        ...pendingToolRow,
        status: 'completed',
        result: { value: 1 },
        completedAt: new Date('2026-06-21T00:00:00.000Z'),
      },
    ])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [{ callId: 'tool-1', name: 'read_workflow', data: { value: 2 }, success: true }],
      })
    ).resolves.toMatchObject({
      status: 'result_conflict',
      toolCallIds: ['tool-1'],
    })

    expect(dbChainMockFns.update).not.toHaveBeenCalled()
  })

  it('returns result_conflict for late per-tool update misses', async () => {
    const secondTool = { ...pendingToolRow, id: 'tool-row-2', toolCallId: 'tool-2' }
    queueCheckpointAndTools(checkpointRow, [pendingToolRow, secondTool])
    dbChainMockFns.returning
      .mockResolvedValueOnce([{ id: 'run-1' }])
      .mockResolvedValueOnce([{ ...pendingToolRow, status: 'completed', result: { ok: 1 } }])
      .mockResolvedValueOnce([])

    await expect(
      recordMothershipResumeToolResults({
        streamId: 'stream-1',
        checkpointId: 'checkpoint-1',
        userId: 'user-1',
        results: [
          { callId: 'tool-1', name: 'read_workflow', data: { ok: 1 }, success: true },
          { callId: 'tool-2', name: 'read_workflow', data: { ok: 2 }, success: true },
        ],
      })
    ).resolves.toMatchObject({
      status: 'result_conflict',
      toolCallIds: ['tool-2'],
    })

    expect(dbChainMockFns.update).toHaveBeenCalledTimes(3)
  })
})
