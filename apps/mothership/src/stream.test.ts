import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAppendMothershipRunEvents, mockGetLatestMothershipRunEventSeq } = vi.hoisted(() => ({
  mockAppendMothershipRunEvents: vi.fn(),
  mockGetLatestMothershipRunEventSeq: vi.fn(),
}))

vi.mock('@/state/stream-event-store', () => ({
  appendMothershipRunEvents: mockAppendMothershipRunEvents,
  getLatestMothershipRunEventSeq: mockGetLatestMothershipRunEventSeq,
}))

import {
  mothershipStreamResponse,
  replayStreamResponse,
  resumeContinuationNotImplementedStream,
  unsupportedRuntimeStream,
} from '@/stream'

async function readSseData(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text()
  return text
    .trim()
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk.replace(/^data: /, '')) as Record<string, unknown>)
}

describe('mothership stream writer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAppendMothershipRunEvents.mockImplementation(async ({ events }) => events)
    mockGetLatestMothershipRunEventSeq.mockResolvedValue(0)
  })

  it('persists and streams the honest resume continuation terminal', async () => {
    const response = resumeContinuationNotImplementedStream({
      runId: 'run-1',
      streamId: 'stream-1',
      checkpointId: 'checkpoint-1',
      requestId: 'req-1',
    })

    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('x-request-id')).toBe('req-1')

    const events = await readSseData(response)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 1,
      type: 'run',
      stream: { streamId: 'stream-1', cursor: '1' },
      trace: { requestId: 'req-1' },
      payload: { kind: 'resumed' },
    })
    expect(events[1]).toMatchObject({
      v: 1,
      seq: 2,
      type: 'error',
      stream: { streamId: 'stream-1', cursor: '2' },
      payload: {
        code: 'resume_continuation_not_implemented',
        data: { checkpointId: 'checkpoint-1' },
      },
    })
    expect(mockAppendMothershipRunEvents).toHaveBeenNthCalledWith(1, {
      runId: 'run-1',
      streamId: 'stream-1',
      events: [expect.objectContaining({ seq: 1, type: 'run' })],
    })
    expect(mockAppendMothershipRunEvents).toHaveBeenNthCalledWith(2, {
      runId: 'run-1',
      streamId: 'stream-1',
      events: [expect.objectContaining({ seq: 2, type: 'error' })],
    })
  })

  it('persists the honest unsupported runtime terminal before durable status work', async () => {
    const afterPersist = vi.fn().mockResolvedValue(undefined)
    const response = unsupportedRuntimeStream({
      runId: 'run-1',
      streamId: 'stream-1',
      requestId: 'req-1',
      route: '/api/copilot',
      startSeq: 0,
      code: 'owned_provider_continuation_not_implemented',
      message: 'Owned Mothership provider continuation is not implemented yet.',
      model: 'claude-opus-4-8',
      provider: 'anthropic',
      afterPersist,
    })

    const events = await readSseData(response)
    expect(afterPersist).toHaveBeenCalledTimes(1)
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[0]!).toBeLessThan(
      afterPersist.mock.invocationCallOrder[0]!
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 1,
      type: 'error',
      stream: { streamId: 'stream-1', cursor: '1' },
      trace: { requestId: 'req-1' },
      payload: {
        code: 'owned_provider_continuation_not_implemented',
        message: 'Owned Mothership provider continuation is not implemented yet.',
        provider: 'anthropic',
        data: {
          route: '/api/copilot',
          model: 'claude-opus-4-8',
        },
      },
    })
  })

  it('does not run terminal status work when unsupported terminal persistence fails', async () => {
    const afterPersist = vi.fn().mockResolvedValue(undefined)
    mockAppendMothershipRunEvents.mockRejectedValueOnce(new Error('database unavailable'))
    const response = unsupportedRuntimeStream({
      runId: 'run-1',
      streamId: 'stream-1',
      requestId: 'req-1',
      route: '/api/copilot',
      code: 'owned_provider_continuation_not_implemented',
      message: 'Owned Mothership provider continuation is not implemented yet.',
      afterPersist,
    })

    await expect(response.text()).rejects.toThrow('database unavailable')
    expect(afterPersist).not.toHaveBeenCalled()
  })

  it('continues after the latest durable sequence by default', async () => {
    mockGetLatestMothershipRunEventSeq.mockResolvedValueOnce(3)
    const response = mothershipStreamResponse(
      { runId: 'run-1', streamId: 'stream-1', requestId: 'req-1' },
      async (writer) => {
        await writer.publish({ type: 'run', payload: { kind: 'resumed' } })
        await writer.publish({ type: 'error', payload: { code: 'done' } })
      }
    )

    const events = await readSseData(response)
    expect(events.map((event) => event.seq)).toEqual([4, 5])
    expect(mockGetLatestMothershipRunEventSeq).toHaveBeenCalledWith({ streamId: 'stream-1' })
  })

  it('streams durable replay envelopes without appending new events', async () => {
    const response = replayStreamResponse({
      requestId: 'req-replay-1',
      events: [
        {
          v: 1,
          seq: 3,
          ts: '2026-06-20T00:00:00.000Z',
          type: 'error',
          stream: { streamId: 'stream-1', cursor: '3' },
          trace: { requestId: 'req-original' },
          payload: {
            code: 'owned_provider_continuation_not_implemented',
            message: 'Owned Mothership provider continuation is not implemented yet.',
          },
        },
      ],
    })

    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('x-request-id')).toBe('req-replay-1')
    expect(await readSseData(response)).toEqual([
      expect.objectContaining({
        seq: 3,
        type: 'error',
        stream: { streamId: 'stream-1', cursor: '3' },
      }),
    ])
    expect(mockAppendMothershipRunEvents).not.toHaveBeenCalled()
  })

  it('persists and streams scoped subagent events', async () => {
    const response = mothershipStreamResponse(
      { runId: 'run-1', streamId: 'stream-1', requestId: 'req-1', startSeq: 0 },
      async (writer) => {
        await writer.publish({
          type: 'span',
          scope: {
            lane: 'subagent',
            agentId: 'workflow',
            parentToolCallId: 'call-parent-1',
            spanId: 'span-workflow-1',
          },
          payload: {
            kind: 'subagent',
            event: 'start',
            agent: 'workflow',
            data: { toolCallId: 'call-parent-1' },
          },
        })
        await writer.publish({ type: 'error', payload: { code: 'done' } })
      }
    )

    const events = await readSseData(response)
    expect(events[0]).toMatchObject({
      seq: 1,
      type: 'span',
      scope: {
        lane: 'subagent',
        agentId: 'workflow',
        parentToolCallId: 'call-parent-1',
        spanId: 'span-workflow-1',
      },
      payload: {
        kind: 'subagent',
        event: 'start',
        agent: 'workflow',
      },
    })
    expect(mockAppendMothershipRunEvents).toHaveBeenNthCalledWith(1, {
      runId: 'run-1',
      streamId: 'stream-1',
      events: [
        expect.objectContaining({
          seq: 1,
          type: 'span',
          scope: expect.objectContaining({
            lane: 'subagent',
            parentToolCallId: 'call-parent-1',
          }),
        }),
      ],
    })
  })

  it('streams the stored envelope on idempotent append conflicts', async () => {
    mockAppendMothershipRunEvents.mockImplementation(async ({ events }) => [
      {
        ...events[0],
        ts: '2026-06-21T00:00:00.000Z',
        trace: { requestId: 'req-original' },
      },
    ])
    const response = mothershipStreamResponse(
      { runId: 'run-1', streamId: 'stream-1', requestId: 'req-retry', startSeq: 0 },
      async (writer) => {
        await writer.publish({ type: 'error', payload: { code: 'done' } })
      }
    )

    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      seq: 1,
      type: 'error',
      ts: '2026-06-21T00:00:00.000Z',
      trace: { requestId: 'req-original' },
    })
  })

  it('fails closed when the stream closes without a terminal event', async () => {
    const response = mothershipStreamResponse(
      { runId: 'run-1', streamId: 'stream-1', requestId: 'req-1' },
      async (writer) => {
        await writer.publish({ type: 'run', payload: { kind: 'started' } })
      }
    )

    await expect(response.text()).rejects.toThrow('closed without a terminal event')
  })

  it('allows checkpoint pause to close a stream leg without marking failure or completion', async () => {
    const response = mothershipStreamResponse(
      { runId: 'run-1', streamId: 'stream-1', requestId: 'req-1' },
      async (writer) => {
        await writer.publish({
          type: 'run',
          payload: {
            kind: 'checkpoint_pause',
            checkpointId: 'checkpoint-1',
            runId: 'run-1',
            executionId: 'exec-1',
            pendingToolCallIds: ['tool-1'],
          },
        })
      }
    )

    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      seq: 1,
      type: 'run',
      payload: {
        kind: 'checkpoint_pause',
        checkpointId: 'checkpoint-1',
        pendingToolCallIds: ['tool-1'],
      },
    })
  })

  it('rejects duplicate terminal events before persisting the duplicate', async () => {
    const response = mothershipStreamResponse(
      { runId: 'run-1', streamId: 'stream-1', requestId: 'req-1' },
      async (writer) => {
        await writer.publish({ type: 'error', payload: { code: 'first' } })
        await writer.publish({ type: 'error', payload: { code: 'second' } })
      }
    )

    await expect(response.text()).rejects.toThrow('already published a terminal event')
    expect(mockAppendMothershipRunEvents).toHaveBeenCalledTimes(1)
  })

  it('rejects complete after checkpoint pause before persisting the duplicate terminal', async () => {
    const response = mothershipStreamResponse(
      { runId: 'run-1', streamId: 'stream-1', requestId: 'req-1' },
      async (writer) => {
        await writer.publish({
          type: 'run',
          payload: {
            kind: 'checkpoint_pause',
            checkpointId: 'checkpoint-1',
            runId: 'run-1',
            executionId: 'exec-1',
            pendingToolCallIds: ['tool-1'],
          },
        })
        await writer.publish({ type: 'complete', payload: { status: 'complete' } })
      }
    )

    await expect(response.text()).rejects.toThrow('already published a terminal event')
    expect(mockAppendMothershipRunEvents).toHaveBeenCalledTimes(1)
  })

  it('does not enqueue events that fail durable persistence', async () => {
    mockAppendMothershipRunEvents.mockRejectedValueOnce(new Error('database unavailable'))
    const response = mothershipStreamResponse(
      { runId: 'run-1', streamId: 'stream-1', requestId: 'req-1' },
      async (writer) => {
        await writer.publish({ type: 'error', payload: { code: 'failed' } })
      }
    )

    await expect(response.text()).rejects.toThrow('database unavailable')
  })
})
