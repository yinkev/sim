/**
 * @vitest-environment node
 */

import { copilotHttpMock, copilotHttpMockFns } from '@sim/testing'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MothershipStreamV1CompletionStatus,
  MothershipStreamV1EventType,
} from '@/lib/copilot/generated/mothership-stream-v1'

const {
  getLatestRunForStream,
  readEvents,
  readFilePreviewSessions,
  checkForReplayGap,
  parsePersistedStreamEventEnvelope,
  getMothershipBaseURL,
  requestMothershipRuntime,
  getMothershipRuntimeHeaderMode,
} = vi.hoisted(() => ({
  getLatestRunForStream: vi.fn(),
  readEvents: vi.fn(),
  readFilePreviewSessions: vi.fn(),
  checkForReplayGap: vi.fn(),
  parsePersistedStreamEventEnvelope: vi.fn(),
  getMothershipBaseURL: vi.fn(),
  requestMothershipRuntime: vi.fn(),
  getMothershipRuntimeHeaderMode: vi.fn(),
}))

vi.mock('@/lib/copilot/async-runs/repository', () => ({
  getLatestRunForStream,
}))

vi.mock('@/lib/copilot/request/session', () => ({
  readEvents,
  readFilePreviewSessions,
  checkForReplayGap,
  createEvent: (event: Record<string, unknown>) => ({
    stream: {
      streamId: event.streamId,
      cursor: event.cursor,
    },
    seq: event.seq,
    trace: { requestId: event.requestId ?? '' },
    type: event.type,
    payload: event.payload,
  }),
  encodeSSEEnvelope: (event: Record<string, unknown>) =>
    new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`),
  encodeSSEComment: (comment: string) => new TextEncoder().encode(`: ${comment}\n\n`),
  parsePersistedStreamEventEnvelope,
  SSE_RESPONSE_HEADERS: {
    'Content-Type': 'text/event-stream',
  },
}))

vi.mock('@/lib/copilot/request/http', () => copilotHttpMock)
vi.mock('@/lib/copilot/server/agent-url', () => ({
  getMothershipBaseURL,
}))
vi.mock('@/lib/mothership/client', () => ({
  requestMothershipRuntime,
}))
vi.mock('@/lib/mothership/service-auth', () => ({
  getMothershipRuntimeHeaderMode,
}))

import { GET } from './route'

async function readAllChunks(response: Response): Promise<string[]> {
  const reader = response.body?.getReader()
  expect(reader).toBeTruthy()

  const chunks: string[] = []
  while (true) {
    const { done, value } = await reader!.read()
    if (done) {
      break
    }
    chunks.push(new TextDecoder().decode(value))
  }
  return chunks
}

describe('copilot chat stream replay route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    copilotHttpMockFns.mockAuthenticateCopilotRequestSessionOnly.mockResolvedValue({
      userId: 'user-1',
      isAuthenticated: true,
    })
    readEvents.mockResolvedValue([])
    readFilePreviewSessions.mockResolvedValue([])
    checkForReplayGap.mockResolvedValue(null)
    getMothershipBaseURL.mockResolvedValue('https://owned.mothership.test')
    requestMothershipRuntime.mockResolvedValue({
      success: true,
      events: [],
      status: 'active',
    })
    getMothershipRuntimeHeaderMode.mockReturnValue('legacy')
    parsePersistedStreamEventEnvelope.mockImplementation((event) => ({ ok: true, event }))
  })

  it('returns preview sessions in batch mode', async () => {
    getLatestRunForStream.mockResolvedValue({
      status: 'active',
      executionId: 'exec-1',
      id: 'run-1',
    })
    readFilePreviewSessions.mockResolvedValue([
      {
        schemaVersion: 1,
        id: 'preview-1',
        streamId: 'stream-1',
        toolCallId: 'preview-1',
        status: 'streaming',
        fileName: 'draft.md',
        previewText: 'hello',
        previewVersion: 2,
        updatedAt: '2026-04-10T00:00:00.000Z',
      },
    ])

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/copilot/chat/stream?streamId=stream-1&after=0&batch=true'
      )
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      previewSessions: [
        expect.objectContaining({
          id: 'preview-1',
          previewText: 'hello',
          previewVersion: 2,
        }),
      ],
      status: 'active',
    })
  })

  it('uses owned replay batches in strict runtime mode', async () => {
    getMothershipRuntimeHeaderMode.mockReturnValue('strict')
    getLatestRunForStream.mockResolvedValue({
      status: 'active',
      executionId: 'exec-1',
      id: 'run-1',
      chatId: 'chat-local',
    })
    const replayEvent = {
      stream: { streamId: 'stream-1', cursor: '6' },
      seq: 6,
      trace: { requestId: 'req-owned' },
      type: MothershipStreamV1EventType.text,
      payload: {
        channel: 'assistant',
        text: 'owned replay',
      },
    }
    requestMothershipRuntime.mockResolvedValue({
      success: true,
      events: [{ eventId: 6, streamId: 'stream-1', event: replayEvent }],
      status: 'resuming',
      chatId: 'chat-owned',
    })

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/copilot/chat/stream?streamId=stream-1&after=5&batch=true'
      )
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      events: [{ eventId: 6, streamId: 'stream-1', event: replayEvent }],
      previewSessions: [],
      status: 'resuming',
      chatId: 'chat-owned',
    })
    expect(readEvents).not.toHaveBeenCalled()
    expect(getMothershipBaseURL).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(requestMothershipRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://owned.mothership.test',
        input: {
          query: {
            streamId: 'stream-1',
            userId: 'user-1',
            after: '5',
            batch: 'true',
            limit: 1000,
          },
        },
        operation: 'stream_replay_batch',
        userId: 'user-1',
      })
    )
  })

  it('paginates owned replay batches before exposing terminal status', async () => {
    getMothershipRuntimeHeaderMode.mockReturnValue('strict')
    getLatestRunForStream.mockResolvedValue({
      status: 'active',
      executionId: 'exec-1',
      id: 'run-1',
    })
    const firstPageEvents = Array.from({ length: 1000 }, (_, index) => {
      const seq = index + 1
      const event = {
        stream: { streamId: 'stream-1', cursor: String(seq) },
        seq,
        trace: { requestId: 'req-owned' },
        type: MothershipStreamV1EventType.text,
        payload: {
          channel: 'assistant',
          text: `chunk-${seq}`,
        },
      }
      return { eventId: seq, streamId: 'stream-1', event }
    })
    const terminalEvent = {
      stream: { streamId: 'stream-1', cursor: '1001' },
      seq: 1001,
      trace: { requestId: 'req-owned' },
      type: MothershipStreamV1EventType.complete,
      payload: {
        status: MothershipStreamV1CompletionStatus.complete,
      },
    }
    requestMothershipRuntime
      .mockResolvedValueOnce({
        success: true,
        events: firstPageEvents,
        status: 'complete',
      })
      .mockResolvedValueOnce({
        success: true,
        events: [{ eventId: 1001, streamId: 'stream-1', event: terminalEvent }],
        status: 'complete',
      })

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/copilot/chat/stream?streamId=stream-1&after=0&batch=true'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      success: true,
      status: 'complete',
    })
    expect(body.events).toHaveLength(1001)
    expect(body.events[999]).toMatchObject({ eventId: 1000 })
    expect(body.events[1000]).toMatchObject({ eventId: 1001, event: terminalEvent })
    expect(requestMothershipRuntime).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: {
          query: {
            streamId: 'stream-1',
            userId: 'user-1',
            after: '0',
            batch: 'true',
            limit: 1000,
          },
        },
      })
    )
    expect(requestMothershipRuntime).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: {
          query: {
            streamId: 'stream-1',
            userId: 'user-1',
            after: '1000',
            batch: 'true',
            limit: 1000,
          },
        },
      })
    )
  })

  it('fails closed when owned replay returns an invalid envelope', async () => {
    getMothershipRuntimeHeaderMode.mockReturnValue('strict')
    getLatestRunForStream.mockResolvedValue({
      status: 'active',
      executionId: 'exec-1',
      id: 'run-1',
    })
    requestMothershipRuntime.mockResolvedValue({
      success: true,
      events: [
        {
          eventId: 1,
          streamId: 'stream-1',
          event: { seq: 1, type: 'text' },
        },
      ],
      status: 'active',
    })
    parsePersistedStreamEventEnvelope.mockReturnValueOnce({
      ok: false,
      message: 'missing stream metadata',
      reason: 'invalid_envelope',
    })

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/copilot/chat/stream?streamId=stream-1&after=0&batch=true'
      )
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Internal server error',
    })
  })

  it('streams owned replay events in strict runtime mode', async () => {
    getMothershipRuntimeHeaderMode.mockReturnValue('strict')
    getLatestRunForStream.mockResolvedValue({
      status: 'active',
      executionId: 'exec-1',
      id: 'run-1',
    })
    const textEvent = {
      stream: { streamId: 'stream-1', cursor: '1' },
      seq: 1,
      trace: { requestId: 'req-owned' },
      type: MothershipStreamV1EventType.text,
      payload: {
        channel: 'assistant',
        text: 'owned replay',
      },
    }
    const completeEvent = {
      stream: { streamId: 'stream-1', cursor: '2' },
      seq: 2,
      trace: { requestId: 'req-owned' },
      type: MothershipStreamV1EventType.complete,
      payload: {
        status: MothershipStreamV1CompletionStatus.complete,
      },
    }
    requestMothershipRuntime.mockResolvedValue({
      success: true,
      events: [
        { eventId: 1, streamId: 'stream-1', event: textEvent },
        { eventId: 2, streamId: 'stream-1', event: completeEvent },
      ],
      status: 'complete',
    })

    const response = await GET(
      new NextRequest('http://localhost:3000/api/copilot/chat/stream?streamId=stream-1&after=0')
    )

    const body = (await readAllChunks(response)).join('')
    expect(body).toContain(': accepted\n\n')
    expect(body).toContain('"text":"owned replay"')
    expect(body).toContain(`"type":"${MothershipStreamV1EventType.complete}"`)
    expect(readEvents).not.toHaveBeenCalled()
    expect(requestMothershipRuntime).toHaveBeenCalledTimes(1)
  })

  it('does not use local replay-gap checks in strict runtime mode', async () => {
    getMothershipRuntimeHeaderMode.mockReturnValue('strict')
    getLatestRunForStream.mockResolvedValue({
      status: 'active',
      executionId: 'exec-1',
      id: 'run-1',
    })
    checkForReplayGap.mockResolvedValue({
      gapDetected: true,
      envelopes: [
        {
          stream: { streamId: 'stream-1', cursor: '99' },
          seq: 99,
          trace: { requestId: 'req-local-gap' },
          type: MothershipStreamV1EventType.error,
          payload: {
            code: 'replay_gap',
            message: 'local gap should be ignored',
          },
        },
      ],
    })
    const ownedComplete = {
      stream: { streamId: 'stream-1', cursor: '6' },
      seq: 6,
      trace: { requestId: 'req-owned' },
      type: MothershipStreamV1EventType.complete,
      payload: {
        status: MothershipStreamV1CompletionStatus.complete,
      },
    }
    requestMothershipRuntime.mockResolvedValue({
      success: true,
      events: [{ eventId: 6, streamId: 'stream-1', event: ownedComplete }],
      status: 'complete',
    })

    const response = await GET(
      new NextRequest('http://localhost:3000/api/copilot/chat/stream?streamId=stream-1&after=5')
    )

    const body = (await readAllChunks(response)).join('')
    expect(body).toContain('"requestId":"req-owned"')
    expect(body).not.toContain('local gap should be ignored')
    expect(checkForReplayGap).not.toHaveBeenCalled()
    expect(readEvents).not.toHaveBeenCalled()
  })

  it('stops replay polling when run becomes cancelled', async () => {
    getLatestRunForStream
      .mockResolvedValueOnce({
        status: 'active',
        executionId: 'exec-1',
        id: 'run-1',
      })
      .mockResolvedValueOnce({
        status: 'cancelled',
        executionId: 'exec-1',
        id: 'run-1',
      })

    const response = await GET(
      new NextRequest('http://localhost:3000/api/copilot/chat/stream?streamId=stream-1&after=0')
    )

    const chunks = await readAllChunks(response)
    expect(chunks[0]).toBe(': accepted\n\n')
    expect(chunks.join('')).toContain(
      JSON.stringify({
        status: MothershipStreamV1CompletionStatus.cancelled,
        reason: 'terminal_status',
      })
    )
    expect(getLatestRunForStream).toHaveBeenCalledTimes(2)
  })

  it('emits structured terminal replay error when run metadata disappears', async () => {
    getLatestRunForStream
      .mockResolvedValueOnce({
        status: 'active',
        executionId: 'exec-1',
        id: 'run-1',
      })
      .mockResolvedValueOnce(null)

    const response = await GET(
      new NextRequest('http://localhost:3000/api/copilot/chat/stream?streamId=stream-1&after=0')
    )

    const chunks = await readAllChunks(response)
    const body = chunks.join('')
    expect(body).toContain(`"type":"${MothershipStreamV1EventType.error}"`)
    expect(body).toContain('"code":"resume_run_unavailable"')
    expect(body).toContain(`"type":"${MothershipStreamV1EventType.complete}"`)
  })

  it('uses the latest live request id for synthetic terminal replay events', async () => {
    getLatestRunForStream
      .mockResolvedValueOnce({
        status: 'active',
        executionId: 'exec-1',
        id: 'run-1',
      })
      .mockResolvedValueOnce({
        status: 'cancelled',
        executionId: 'exec-1',
        id: 'run-1',
      })
    readEvents
      .mockResolvedValueOnce([
        {
          stream: { streamId: 'stream-1', cursor: '1' },
          seq: 1,
          trace: { requestId: 'req-live-123' },
          type: MothershipStreamV1EventType.text,
          payload: {
            channel: 'assistant',
            text: 'hello',
          },
        },
      ])
      .mockResolvedValueOnce([])

    const response = await GET(
      new NextRequest('http://localhost:3000/api/copilot/chat/stream?streamId=stream-1&after=0')
    )

    const chunks = await readAllChunks(response)
    const terminalChunk = chunks[chunks.length - 1] ?? ''
    expect(terminalChunk).toContain(`"type":"${MothershipStreamV1EventType.complete}"`)
    expect(terminalChunk).toContain('"requestId":"req-live-123"')
    expect(terminalChunk).toContain('"status":"cancelled"')
  })
})
