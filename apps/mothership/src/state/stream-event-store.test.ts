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
  copilotRunEvents: {
    id: 'id',
    runId: 'run_id',
    streamId: 'stream_id',
    seq: 'seq',
    cursor: 'cursor',
    eventType: 'event_type',
    requestId: 'request_id',
    envelope: 'envelope',
    createdAt: 'created_at',
  },
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
  asc: vi.fn((column: unknown) => ({ type: 'asc', column: getColumnName(column) })),
  desc: vi.fn((column: unknown) => ({ type: 'desc', column: getColumnName(column) })),
  eq: vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left: getColumnName(left), right })),
  gt: vi.fn((left: unknown, right: unknown) => ({ type: 'gt', left: getColumnName(left), right })),
  inArray: vi.fn((left: unknown, right: unknown[]) => ({
    type: 'inArray',
    left: getColumnName(left),
    right,
  })),
}))

import {
  appendMothershipRunEvents,
  getLatestMothershipRunEventSeq,
  type MothershipStreamEventEnvelope,
  readMothershipRunEvents,
} from './stream-event-store'

function event(seq: number, overrides: Partial<MothershipStreamEventEnvelope> = {}) {
  return {
    v: 1,
    seq,
    type: seq === 2 ? 'error' : 'run',
    stream: {
      streamId: 'stream-1',
      cursor: String(seq),
    },
    trace: {
      requestId: 'req-1',
    },
    payload: seq === 2 ? { code: 'done' } : { kind: 'started' },
    ...overrides,
  } satisfies MothershipStreamEventEnvelope
}

function rowFor(envelope: MothershipStreamEventEnvelope) {
  return {
    id: `event-${envelope.seq}`,
    runId: 'run-1',
    streamId: envelope.stream.streamId,
    seq: envelope.seq,
    cursor: envelope.stream.cursor ?? String(envelope.seq),
    eventType: envelope.type,
    requestId: envelope.trace?.requestId ?? null,
    envelope,
    createdAt: new Date('2026-06-21T00:00:00.000Z'),
  }
}

function whereCondition(callIndex: number): unknown {
  const calls = dbChainMockFns.where.mock.calls as unknown as Array<[unknown]>
  return calls[callIndex]?.[0]
}

describe('mothership stream event store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
  })

  it('appends stream events with durable run and stream indexes', async () => {
    const first = event(1)
    const second = event(2)
    dbChainMockFns.returning.mockResolvedValueOnce([{ seq: 1 }, { seq: 2 }])

    await expect(
      appendMothershipRunEvents({
        runId: 'run-1',
        streamId: 'stream-1',
        events: [first, second],
      })
    ).resolves.toEqual([first, second])

    expect(dbChainMockFns.insert).toHaveBeenCalledWith(expect.any(Object))
    expect(dbChainMockFns.values).toHaveBeenCalledWith([
      {
        runId: 'run-1',
        streamId: 'stream-1',
        seq: 1,
        cursor: '1',
        eventType: 'run',
        requestId: 'req-1',
        envelope: first,
      },
      {
        runId: 'run-1',
        streamId: 'stream-1',
        seq: 2,
        cursor: '2',
        eventType: 'error',
        requestId: 'req-1',
        envelope: second,
      },
    ])
    expect(dbChainMockFns.onConflictDoNothing).toHaveBeenCalledWith({
      target: ['stream_id', 'seq'],
    })
    expect(dbChainMockFns.returning).toHaveBeenCalledWith({ seq: 'seq' })
  })

  it('accepts idempotent duplicate inserts when only volatile metadata differs', async () => {
    const first = event(1)
    const duplicate = event(2, {
      ts: '2026-06-21T00:00:01.000Z',
      trace: { requestId: 'req-retry' },
    })
    const storedDuplicate = event(2, {
      ts: '2026-06-21T00:00:00.000Z',
      trace: { requestId: 'req-original' },
    })
    dbChainMockFns.returning.mockResolvedValueOnce([{ seq: 1 }])
    dbChainMockFns.where.mockResolvedValueOnce([rowFor(storedDuplicate)])

    await expect(
      appendMothershipRunEvents({
        runId: 'run-1',
        streamId: 'stream-1',
        events: [first, duplicate],
      })
    ).resolves.toEqual([first, storedDuplicate])
  })

  it('rejects events for a different stream before writing', async () => {
    await expect(
      appendMothershipRunEvents({
        runId: 'run-1',
        streamId: 'stream-1',
        events: [event(1, { stream: { streamId: 'stream-2' } })],
      })
    ).rejects.toThrow('belongs to stream stream-2')

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
  })

  it('accepts idempotent duplicate inserts when the stored envelope matches', async () => {
    const first = event(1)
    const duplicate = event(2)
    dbChainMockFns.returning.mockResolvedValueOnce([{ seq: 1 }])
    dbChainMockFns.where.mockResolvedValueOnce([rowFor(duplicate)])

    await expect(
      appendMothershipRunEvents({
        runId: 'run-1',
        streamId: 'stream-1',
        events: [first, duplicate],
      })
    ).resolves.toEqual([first, duplicate])

    expect(dbChainMockFns.where).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'and',
        conditions: [
          { type: 'eq', left: 'stream_id', right: 'stream-1' },
          { type: 'inArray', left: 'seq', right: [2] },
        ],
      })
    )
  })

  it('rejects duplicate inserts when the stored envelope differs', async () => {
    const duplicate = event(2)
    dbChainMockFns.returning.mockResolvedValueOnce([{ seq: 1 }])
    dbChainMockFns.where.mockResolvedValueOnce([
      rowFor(event(2, { payload: { code: 'different' } })),
    ])

    await expect(
      appendMothershipRunEvents({
        runId: 'run-1',
        streamId: 'stream-1',
        events: [event(1), duplicate],
      })
    ).rejects.toThrow('event conflict for stream stream-1 seq 2')
  })

  it('reads stream events after a numeric cursor in seq order', async () => {
    const stored = rowFor(event(3))
    dbChainMockFns.limit.mockResolvedValueOnce([stored])

    await expect(
      readMothershipRunEvents({ streamId: 'stream-1', afterSeq: 2, limit: 10 })
    ).resolves.toEqual([stored])

    expect(whereCondition(0)).toMatchObject({
      type: 'and',
      conditions: [
        { type: 'eq', left: 'stream_id', right: 'stream-1' },
        { type: 'gt', left: 'seq', right: 2 },
      ],
    })
    expect(dbChainMockFns.orderBy).toHaveBeenCalledWith({ type: 'asc', column: 'seq' })
    expect(dbChainMockFns.limit).toHaveBeenCalledWith(10)
  })

  it('loads the latest durable stream sequence', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([{ seq: 42 }])

    await expect(getLatestMothershipRunEventSeq({ streamId: 'stream-1' })).resolves.toBe(42)

    expect(whereCondition(0)).toMatchObject({
      type: 'eq',
      left: 'stream_id',
      right: 'stream-1',
    })
    expect(dbChainMockFns.orderBy).toHaveBeenCalledWith({ type: 'desc', column: 'seq' })
    expect(dbChainMockFns.limit).toHaveBeenCalledWith(1)
  })
})
