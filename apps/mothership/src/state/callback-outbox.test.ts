import { dbChainMock, dbChainMockFns, resetDbChainMock } from '@sim/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
vi.mock('@sim/utils/retry', () => ({
  backoffWithJitter: vi.fn(() => 5_000),
}))

import {
  claimMothershipBillingCallbackOutboxEventById,
  completeMothershipBillingCallbackOutboxEvent,
  enqueueMothershipBillingCallbackOutboxEvent,
  type MothershipBillingCallbackOutboxEvent,
  reclaimStaleMothershipBillingCallbackOutboxEvents,
  recordMothershipBillingCallbackOutboxFailure,
} from './callback-outbox'

function makeClaimedEvent(
  overrides: Partial<MothershipBillingCallbackOutboxEvent> = {}
): MothershipBillingCallbackOutboxEvent {
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
    status: 'processing',
    attempts: 0,
    maxAttempts: 10,
    availableAt: new Date('2026-06-21T00:00:00.000Z'),
    lockedAt: new Date('2026-06-21T00:00:01.000Z'),
    lastError: null,
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
    processedAt: null,
    ...overrides,
  }
}

function makePendingEventRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...makeClaimedEvent(),
    status: 'pending' as const,
    lockedAt: null,
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

function expectWhereCall(index: number, expectedConditions: Record<string, unknown>[]): void {
  const calls = dbChainMockFns.where.mock.calls as unknown as Array<[Record<string, unknown>]>
  const where = calls[index]?.[0]
  expect(where).toBeDefined()
  expect(where).toMatchObject({
    type: 'and',
    conditions: expect.arrayContaining(
      expectedConditions.map((condition) => expect.objectContaining(condition))
    ),
  })
}

describe('mothership callback outbox state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('enqueues billing payload fields without storing callback secrets', async () => {
    await expect(
      enqueueMothershipBillingCallbackOutboxEvent({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        cost: 0.000115,
        model: 'claude-opus-4-8',
        inputTokens: 3,
        outputTokens: 4,
        source: 'copilot',
        idempotencyKey: 'mothership-run:run-1:anthropic',
      })
    ).resolves.toBe('outbox-event-1')

    const valuesCalls = dbChainMockFns.values.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >
    const values = valuesCalls[0]?.[0]
    expect(values).toBeDefined()
    expect(values).toMatchObject({
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
    expect((values!.payload as Record<string, unknown>).callbackKey).toBeUndefined()
    expect((values!.payload as Record<string, unknown>).apiKey).toBeUndefined()
  })

  it('delays default batch availability so immediate delivery can claim first', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T00:00:00.000Z'))

    await enqueueMothershipBillingCallbackOutboxEvent({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      cost: 0.000115,
      model: 'claude-opus-4-8',
      inputTokens: 3,
      outputTokens: 4,
      source: 'copilot',
      idempotencyKey: 'mothership-run:run-1:anthropic',
    })

    const valuesCalls = dbChainMockFns.values.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >
    expect(valuesCalls[0]?.[0].availableAt).toEqual(new Date('2026-06-21T00:00:30.000Z'))
  })

  it('leaves future-available rows pending unless immediate delivery is allowed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T00:00:00.000Z'))
    dbChainMockFns.limit.mockResolvedValueOnce([
      makePendingEventRow({
        availableAt: new Date('2026-06-21T00:00:30.000Z'),
      }),
    ])

    await expect(claimMothershipBillingCallbackOutboxEventById('outbox-event-1')).resolves.toEqual({
      status: 'pending',
    })

    expect(dbChainMockFns.set).not.toHaveBeenCalled()
  })

  it('allows immediate by-id delivery to claim future-available rows', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T00:00:00.000Z'))
    dbChainMockFns.limit.mockResolvedValueOnce([
      makePendingEventRow({
        availableAt: new Date('2026-06-21T00:00:30.000Z'),
      }),
    ])

    await expect(
      claimMothershipBillingCallbackOutboxEventById('outbox-event-1', {
        allowBeforeAvailableAt: true,
      })
    ).resolves.toEqual({
      status: 'claimed',
      event: expect.objectContaining({
        id: 'outbox-event-1',
        status: 'processing',
        lockedAt: expect.any(Date),
      }),
    })

    expectSetCall(0, {
      status: 'processing',
      lockedAt: new Date('2026-06-21T00:00:00.000Z'),
    })
  })

  it('can claim a due pending billing callback event by id', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([makePendingEventRow()])

    await expect(claimMothershipBillingCallbackOutboxEventById('outbox-event-1')).resolves.toEqual({
      status: 'claimed',
      event: expect.objectContaining({
        id: 'outbox-event-1',
        status: 'processing',
        lockedAt: expect.any(Date),
      }),
    })

    expectSetCall(0, {
      status: 'processing',
      lockedAt: expect.any(Date),
    })
    expect(dbChainMockFns.for).toHaveBeenCalledWith('update', { skipLocked: true })
    expectWhereCall(1, [
      {
        type: 'eq',
        left: 'outbox_id',
        right: 'outbox-event-1',
      },
      {
        type: 'eq',
        left: 'outbox_event_type',
        right: 'mothership_billing_usage',
      },
      {
        type: 'eq',
        left: 'outbox_status',
        right: 'pending',
      },
    ])
  })

  it('dead-letters invalid persisted billing callback payloads during claim', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([
      makePendingEventRow({
        payload: {
          userId: '',
          cost: 0.000115,
          model: 'claude-opus-4-8',
        },
      }),
    ])
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'outbox-event-1' }])

    await expect(claimMothershipBillingCallbackOutboxEventById('outbox-event-1')).resolves.toEqual({
      status: 'dead_letter',
    })

    expectSetCall(0, {
      attempts: 1,
      status: 'dead_letter',
      lockedAt: null,
      processedAt: expect.any(Date),
      lastError: expect.stringContaining('Invalid Mothership billing callback outbox payload'),
    })
    expectSetCall(0, {
      status: 'dead_letter',
    })
  })

  it('marks a claimed billing callback event completed', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'outbox-event-1' }])

    await expect(completeMothershipBillingCallbackOutboxEvent(makeClaimedEvent())).resolves.toBe(
      true
    )

    expectSetCall(0, {
      status: 'completed',
      lockedAt: null,
      processedAt: expect.any(Date),
      lastError: null,
    })
    expectWhereCall(0, [
      {
        type: 'eq',
        left: 'outbox_id',
        right: 'outbox-event-1',
      },
      {
        type: 'eq',
        left: 'outbox_status',
        right: 'processing',
      },
      {
        type: 'eq',
        left: 'outbox_locked_at',
        right: new Date('2026-06-21T00:00:01.000Z'),
      },
    ])
  })

  it('returns false when completion loses the claimed lease', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([])

    await expect(completeMothershipBillingCallbackOutboxEvent(makeClaimedEvent())).resolves.toBe(
      false
    )

    expectWhereCall(0, [
      {
        type: 'eq',
        left: 'outbox_locked_at',
        right: new Date('2026-06-21T00:00:01.000Z'),
      },
    ])
  })

  it('reschedules a failed billing callback event with retry metadata', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T00:00:00.000Z'))
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'outbox-event-1' }])

    await expect(
      recordMothershipBillingCallbackOutboxFailure(makeClaimedEvent(), new Error('network down'))
    ).resolves.toEqual({
      status: 'pending',
      attempts: 1,
      availableAt: new Date('2026-06-21T00:00:05.000Z'),
    })

    expectSetCall(0, {
      attempts: 1,
      status: 'pending',
      availableAt: new Date('2026-06-21T00:00:05.000Z'),
      lockedAt: null,
      processedAt: null,
      lastError: 'network down',
    })
    expectWhereCall(0, [
      {
        type: 'eq',
        left: 'outbox_locked_at',
        right: new Date('2026-06-21T00:00:01.000Z'),
      },
    ])
  })

  it('returns lease_lost when retry scheduling loses the claimed lease', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([])

    await expect(
      recordMothershipBillingCallbackOutboxFailure(makeClaimedEvent(), new Error('network down'))
    ).resolves.toEqual({
      status: 'lease_lost',
      attempts: 1,
    })

    expectWhereCall(0, [
      {
        type: 'eq',
        left: 'outbox_locked_at',
        right: new Date('2026-06-21T00:00:01.000Z'),
      },
    ])
  })

  it('dead-letters a failed billing callback event after max attempts', async () => {
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'outbox-event-1' }])

    await expect(
      recordMothershipBillingCallbackOutboxFailure(
        makeClaimedEvent({
          attempts: 9,
          maxAttempts: 10,
        }),
        new Error('still down')
      )
    ).resolves.toEqual({
      status: 'dead_letter',
      attempts: 10,
    })

    expectSetCall(0, {
      attempts: 10,
      status: 'dead_letter',
      lockedAt: null,
      processedAt: expect.any(Date),
      lastError: 'still down',
    })
  })

  it('reclaims stale processing billing callback leases', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-21T00:10:00.000Z'))
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: 'outbox-event-1' }])

    await expect(reclaimStaleMothershipBillingCallbackOutboxEvents()).resolves.toBe(1)

    expectSetCall(0, {
      status: 'pending',
      lockedAt: null,
    })
    expectWhereCall(0, [
      {
        type: 'eq',
        left: 'outbox_event_type',
        right: 'mothership_billing_usage',
      },
      {
        type: 'eq',
        left: 'outbox_status',
        right: 'processing',
      },
    ])
    const whereCalls = dbChainMockFns.where.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >
    const where = whereCalls[0]?.[0] as {
      conditions: Array<Record<string, unknown>>
    }
    expect(where.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'or',
          conditions: expect.arrayContaining([
            expect.objectContaining({ type: 'isNull', column: 'outbox_locked_at' }),
            expect.objectContaining({
              type: 'lte',
              left: 'outbox_locked_at',
              right: new Date('2026-06-21T00:00:00.000Z'),
            }),
          ]),
        }),
      ])
    )
  })
})
