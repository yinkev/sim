import { dbChainMock, dbChainMockFns, resetDbChainMock } from '@sim/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MothershipEnv } from '@/env'

const { getColumnName } = vi.hoisted(() => ({
  getColumnName: (column: unknown): string => {
    const namedColumn = column as { name?: unknown }
    return typeof namedColumn.name === 'string' ? namedColumn.name : String(column)
  },
}))

vi.mock('@sim/db', () => dbChainMock)
vi.mock('@sim/db/schema', () => ({
  outboxEvent: {
    id: 'outbox_id',
    eventType: 'outbox_event_type',
    payload: 'outbox_payload',
    status: 'outbox_status',
    attempts: 'outbox_attempts',
    maxAttempts: 'outbox_max_attempts',
    availableAt: 'outbox_available_at',
    lockedAt: 'outbox_locked_at',
    lastError: 'outbox_last_error',
    createdAt: 'outbox_created_at',
    processedAt: 'outbox_processed_at',
  },
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  asc: vi.fn((column: unknown) => ({ type: 'asc', column: getColumnName(column) })),
  eq: vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left: getColumnName(left), right })),
  isNull: vi.fn((column: unknown) => ({ type: 'isNull', column: getColumnName(column) })),
  lte: vi.fn((left: unknown, right: unknown) => ({
    type: 'lte',
    left: getColumnName(left),
    right,
  })),
  or: vi.fn((...conditions: unknown[]) => ({ type: 'or', conditions })),
}))
vi.mock('@sim/utils/id', () => ({
  generateId: vi.fn(() => 'outbox-event-1'),
}))

import {
  executeWorkflowSubagentCallback,
  processPendingMothershipBillingUsageCallbacks,
  reportMothershipBillingUsage,
  validateMothershipApiKeyEntitlement,
  validateMothershipByokEntitlement,
} from './callbacks'

const TEST_ENV: MothershipEnv = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 6891,
  SIM_TO_MOTHERSHIP_API_KEY: 'runtime-secret-at-least-16',
  MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
  SIM_BASE_URL: 'http://sim.local',
}

const workflowSubagentRequest = {
  runId: '11111111-1111-4111-8111-111111111111',
  streamId: 'stream-1',
  chatId: 'chat-1',
  userId: 'user-1',
  workspaceId: 'workspace-1',
  parentToolCallId: 'tool-call-1',
  model: 'claude-opus-4-8',
  provider: 'anthropic',
  depth: 0,
  input: {
    prompt: 'Inspect the workflow and fix the failing block.',
    workflowId: 'workflow-1',
  },
  context: {
    workflowId: 'workflow-1',
    messages: [
      {
        role: 'user' as const,
        content: 'Fix my workflow.',
      },
    ],
    resources: [
      {
        type: 'workflow' as const,
        id: 'workflow-1',
        title: 'Support workflow',
      },
    ],
  },
  limits: {
    maxDepth: 1,
    maxProviderRounds: 8,
    maxChildToolCalls: 30,
  },
}

function makePendingBillingOutboxRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'outbox-event-1',
    eventType: 'mothership_billing_usage',
    payload: {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      cost: 0.000115,
      model: 'claude-opus-4-8',
      inputTokens: 3,
      outputTokens: 4,
      source: 'copilot',
      idempotencyKey: 'mothership-run:run-1:anthropic',
    },
    status: 'pending',
    attempts: 0,
    maxAttempts: 10,
    availableAt: new Date('2026-06-21T00:00:00.000Z'),
    lockedAt: null,
    lastError: null,
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    processedAt: null,
    ...overrides,
  }
}

function expectSetCall(index: number, expected: Record<string, unknown>): Record<string, unknown> {
  const calls = dbChainMockFns.set.mock.calls as unknown as Array<[Record<string, unknown>]>
  const call = calls[index]?.[0]
  expect(call).toBeDefined()
  expect(call).toMatchObject(expected)
  return call!
}

describe('validateMothershipApiKeyEntitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
  })

  it('calls the strict Sim API-key validation callback without enqueuing an outbox event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    await expect(
      validateMothershipApiKeyEntitlement({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        fetch: fetchMock,
      })
    ).resolves.toEqual({ status: 'ok' })

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://sim.local/api/copilot/api-keys/validate'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({
          userId: 'user-1',
          workspaceId: 'workspace-1',
        }),
      })
    )
    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('reports Sim API-key callback rejection statuses without enqueuing an outbox event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 402 }))

    await expect(
      validateMothershipApiKeyEntitlement({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'rejected',
      statusCode: 402,
      body: null,
    })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('fails API-key entitlement closed when callback config is missing', async () => {
    const fetchMock = vi.fn()
    const { MOTHERSHIP_TO_SIM_CALLBACK_KEY: _callbackKey, ...envWithoutCallback } = TEST_ENV

    await expect(
      validateMothershipApiKeyEntitlement({
        env: envWithoutCallback,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'misconfigured',
      missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('reports API-key callback network errors without enqueuing an outbox event', async () => {
    const error = new Error('network down')
    const fetchMock = vi.fn().mockRejectedValue(error)

    await expect(
      validateMothershipApiKeyEntitlement({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'callback_error',
      error,
    })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })
})

describe('reportMothershipBillingUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('enqueues a durable billing callback event and completes it on success', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([makePendingBillingOutboxRow()])
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'outbox-event-1' }])
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: {
          userId: 'user-1',
          cost: 0.000115,
          processedAt: '2026-06-21T00:00:00.000Z',
          requestId: 'req-1',
        },
      })
    )

    await expect(
      reportMothershipBillingUsage({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        source: 'copilot',
        model: 'claude-opus-4-8',
        inputTokens: 3,
        outputTokens: 4,
        cost: 0.000115,
        idempotencyKey: 'mothership-run:run-1:anthropic',
        fetch: fetchMock,
      })
    ).resolves.toEqual({ status: 'ok' })

    expect(dbChainMockFns.values).toHaveBeenCalledWith({
      id: 'outbox-event-1',
      eventType: 'mothership_billing_usage',
      payload: {
        userId: 'user-1',
        workspaceId: 'workspace-1',
        cost: 0.000115,
        model: 'claude-opus-4-8',
        inputTokens: 3,
        outputTokens: 4,
        source: 'copilot',
        idempotencyKey: 'mothership-run:run-1:anthropic',
      },
      status: 'pending',
      attempts: 0,
      maxAttempts: 10,
      availableAt: expect.any(Date),
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://sim.local/api/billing/update-cost')
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      cost: 0.000115,
      model: 'claude-opus-4-8',
      inputTokens: 3,
      outputTokens: 4,
      source: 'copilot',
      idempotencyKey: 'mothership-run:run-1:anthropic',
    })
    expectSetCall(0, {
      status: 'processing',
      lockedAt: expect.any(Date),
    })
    expectSetCall(1, {
      status: 'completed',
      lockedAt: null,
      processedAt: expect.any(Date),
      lastError: null,
    })
  })

  it('treats duplicate callbacks as idempotent success and still completes the outbox event', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([makePendingBillingOutboxRow()])
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'outbox-event-1' }])
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          success: false,
          error: 'Duplicate request: cumulative cost already recorded',
          requestId: 'req-1',
        },
        { status: 409 }
      )
    )

    await expect(
      reportMothershipBillingUsage({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        source: 'workspace-chat',
        model: 'claude-opus-4-8',
        inputTokens: 3,
        outputTokens: 4,
        cost: 0.000115,
        idempotencyKey: 'mothership-run:run-1:anthropic',
        fetch: fetchMock,
      })
    ).resolves.toEqual({ status: 'ok', duplicate: true })

    expectSetCall(1, {
      status: 'completed',
      lockedAt: null,
      processedAt: expect.any(Date),
      lastError: null,
    })
  })

  it('keeps a failed callback event pending for retry when Sim rejects the callback', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T00:00:00.000Z'))
    dbChainMockFns.limit.mockResolvedValueOnce([makePendingBillingOutboxRow()])
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'outbox-event-1' }])
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: 'bad' }, { status: 500 }))

    await expect(
      reportMothershipBillingUsage({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        source: 'copilot',
        model: 'claude-opus-4-8',
        inputTokens: 3,
        outputTokens: 4,
        cost: 0.000115,
        idempotencyKey: 'mothership-run:run-1:anthropic',
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'rejected',
      statusCode: 500,
      body: { error: 'bad' },
    })

    const retrySet = expectSetCall(1, {
      attempts: 1,
      status: 'pending',
      lockedAt: null,
      processedAt: null,
      lastError: 'Mothership billing callback failed with status 500',
      availableAt: expect.any(Date),
    })
    expect((retrySet.availableAt as Date).getTime()).toBeGreaterThan(Date.now())
  })

  it('keeps a transient callback error pending for retry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T00:00:00.000Z'))
    dbChainMockFns.limit.mockResolvedValueOnce([makePendingBillingOutboxRow()])
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'outbox-event-1' }])
    const error = new Error('network down')
    const fetchMock = vi.fn().mockRejectedValue(error)

    await expect(
      reportMothershipBillingUsage({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        source: 'copilot',
        model: 'claude-opus-4-8',
        inputTokens: 3,
        outputTokens: 4,
        cost: 0.000115,
        idempotencyKey: 'mothership-run:run-1:anthropic',
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'callback_error',
      error,
    })

    expectSetCall(1, {
      attempts: 1,
      status: 'pending',
      lockedAt: null,
      processedAt: null,
      lastError: 'network down',
      availableAt: expect.any(Date),
    })
  })

  it('fails closed without enqueuing when billing callback config is missing', async () => {
    const fetchMock = vi.fn()
    const { SIM_BASE_URL: _simBaseUrl, ...envWithoutSimBaseUrl } = TEST_ENV

    await expect(
      reportMothershipBillingUsage({
        env: envWithoutSimBaseUrl,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        source: 'copilot',
        model: 'claude-opus-4-8',
        inputTokens: 3,
        outputTokens: 4,
        cost: 0.000115,
        idempotencyKey: 'mothership-run:run-1:anthropic',
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'misconfigured',
      missing: 'SIM_BASE_URL',
    })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('can claim and complete a pending billing callback event later with current env credentials', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([makePendingBillingOutboxRow()])
    dbChainMockFns.returning
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'outbox-event-1' }])
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: {
          userId: 'user-1',
          cost: 0.000115,
          processedAt: '2026-06-21T00:00:00.000Z',
          requestId: 'req-1',
        },
      })
    )

    await expect(
      processPendingMothershipBillingUsageCallbacks({
        env: TEST_ENV,
        batchSize: 1,
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      attempted: 1,
      completed: 1,
      deadLettered: 0,
      leaseLost: 0,
      reaped: 0,
      retryable: 0,
    })

    expectSetCall(0, {
      status: 'pending',
      lockedAt: null,
    })
    expectSetCall(1, {
      status: 'processing',
      lockedAt: expect.any(Date),
    })
    expectSetCall(2, {
      status: 'completed',
      lockedAt: null,
      processedAt: expect.any(Date),
      lastError: null,
    })
  })

  it('counts dead-lettered billing callback events separately from retryable failures', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T00:00:00.000Z'))
    dbChainMockFns.limit.mockResolvedValueOnce([
      makePendingBillingOutboxRow({
        maxAttempts: 1,
      }),
    ])
    dbChainMockFns.returning
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'outbox-event-1' }])
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: 'bad' }, { status: 500 }))

    await expect(
      processPendingMothershipBillingUsageCallbacks({
        env: TEST_ENV,
        batchSize: 1,
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      attempted: 1,
      completed: 0,
      deadLettered: 1,
      leaseLost: 0,
      reaped: 0,
      retryable: 0,
    })

    expectSetCall(2, {
      attempts: 1,
      status: 'dead_letter',
      lockedAt: null,
      processedAt: expect.any(Date),
      lastError: 'Mothership billing callback failed with status 500',
    })
  })
})

describe('validateMothershipByokEntitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
  })

  it('calls the strict Sim BYOK validation callback without enqueuing an outbox event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    await expect(
      validateMothershipByokEntitlement({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        fetch: fetchMock,
      })
    ).resolves.toEqual({ status: 'ok' })

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://sim.local/api/copilot/byok/validate'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({
          userId: 'user-1',
          workspaceId: 'workspace-1',
        }),
      })
    )
    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('reports BYOK callback rejection statuses without enqueuing an outbox event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }))

    await expect(
      validateMothershipByokEntitlement({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'rejected',
      statusCode: 403,
      body: null,
    })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('fails BYOK entitlement closed when callback base URL is missing', async () => {
    const fetchMock = vi.fn()
    const { SIM_BASE_URL: _simBaseUrl, ...envWithoutSimBaseUrl } = TEST_ENV

    await expect(
      validateMothershipByokEntitlement({
        env: envWithoutSimBaseUrl,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'misconfigured',
      missing: 'SIM_BASE_URL',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('reports BYOK callback network errors without enqueuing an outbox event', async () => {
    const error = new Error('network down')
    const fetchMock = vi.fn().mockRejectedValue(error)

    await expect(
      validateMothershipByokEntitlement({
        env: TEST_ENV,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'callback_error',
      error,
    })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })
})

describe('executeWorkflowSubagentCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
  })

  it('calls the strict Sim workflow subagent callback without legacy headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        result: {
          status: 'completed',
          summary: 'Workflow updated.',
        },
      })
    )

    await expect(
      executeWorkflowSubagentCallback({
        env: TEST_ENV,
        request: workflowSubagentRequest,
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'ok',
      response: {
        success: true,
        result: {
          status: 'completed',
          summary: 'Workflow updated.',
          changedResources: [],
          artifacts: [],
        },
        streamEvents: [],
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://sim.local/api/copilot/subagents/workflow/execute')
    expect(init).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(init.body))).toEqual(workflowSubagentRequest)
    const headers = init.headers as Headers
    expect(headers.get('x-sim-callback-key')).toBe('callback-secret-at-least-16')
    expect(headers.has('x-api-key')).toBe(false)
    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('reports workflow subagent callback rejection statuses without enqueuing an outbox event', async () => {
    const body = {
      success: false,
      code: 'workflow_subagent_execution_failed',
      error: 'Workflow subagent execution failed before a contract response was produced.',
      streamEvents: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(Response.json(body, { status: 503 }))

    await expect(
      executeWorkflowSubagentCallback({
        env: TEST_ENV,
        request: workflowSubagentRequest,
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'rejected',
      statusCode: 503,
      body,
    })

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('fails workflow subagent execution closed when callback config is missing', async () => {
    const fetchMock = vi.fn()
    const { MOTHERSHIP_TO_SIM_CALLBACK_KEY: _callbackKey, ...envWithoutCallback } = TEST_ENV

    await expect(
      executeWorkflowSubagentCallback({
        env: envWithoutCallback,
        request: workflowSubagentRequest,
        fetch: fetchMock,
      })
    ).resolves.toEqual({
      status: 'misconfigured',
      missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })
})
