/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAbortActiveStream,
  mockAuthenticateCopilotRequestSessionOnly,
  mockGetLatestRunForStream,
  mockReleasePendingChatStream,
  mockRequestExplicitStreamAbort,
  mockWaitForPendingChatStream,
} = vi.hoisted(() => ({
  mockAbortActiveStream: vi.fn(),
  mockAuthenticateCopilotRequestSessionOnly: vi.fn(),
  mockGetLatestRunForStream: vi.fn(),
  mockReleasePendingChatStream: vi.fn(),
  mockRequestExplicitStreamAbort: vi.fn(),
  mockWaitForPendingChatStream: vi.fn(),
}))

vi.mock('@/lib/copilot/request/http', () => ({
  authenticateCopilotRequestSessionOnly: mockAuthenticateCopilotRequestSessionOnly,
}))

vi.mock('@/lib/copilot/async-runs/repository', () => ({
  getLatestRunForStream: mockGetLatestRunForStream,
}))

vi.mock('@/lib/copilot/request/session', () => ({
  abortActiveStream: mockAbortActiveStream,
  releasePendingChatStream: mockReleasePendingChatStream,
  waitForPendingChatStream: mockWaitForPendingChatStream,
}))

vi.mock('@/lib/copilot/request/session/explicit-abort', () => ({
  DEFAULT_EXPLICIT_ABORT_TIMEOUT_MS: 3000,
  requestExplicitStreamAbort: mockRequestExplicitStreamAbort,
}))

vi.mock('@/lib/copilot/request/otel', () => ({
  withIncomingGoSpan: async (
    _headers: Headers,
    _spanName: string,
    _attributes: unknown,
    fn: (span: {
      setAttribute: ReturnType<typeof vi.fn>
      setAttributes: ReturnType<typeof vi.fn>
    }) => Promise<Response>
  ) => fn({ setAttribute: vi.fn(), setAttributes: vi.fn() }),
  withCopilotSpan: async (
    _spanName: string,
    _attributes: unknown,
    fn: (span: { setAttributes: ReturnType<typeof vi.fn> }) => Promise<boolean>
  ) => fn({ setAttributes: vi.fn() }),
}))

import { POST } from '@/app/api/copilot/chat/abort/route'

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/copilot/chat/abort', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('copilot chat abort route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticateCopilotRequestSessionOnly.mockResolvedValue({
      userId: 'user-1',
      isAuthenticated: true,
    })
    mockGetLatestRunForStream.mockResolvedValue({ chatId: 'chat-1', workspaceId: 'ws-1' })
    mockAbortActiveStream.mockResolvedValue(true)
    mockRequestExplicitStreamAbort.mockResolvedValue(undefined)
    mockWaitForPendingChatStream.mockResolvedValue(true)
  })

  it('marks the explicit Mothership abort through the shared helper', async () => {
    const response = await POST(createRequest({ streamId: 'stream-1' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ aborted: true, settled: true })
    expect(mockRequestExplicitStreamAbort).toHaveBeenCalledWith({
      streamId: 'stream-1',
      userId: 'user-1',
      chatId: 'chat-1',
      workspaceId: 'ws-1',
      timeoutMs: 3000,
    })
  })

  it('continues local abort cleanup when the explicit Mothership abort fails', async () => {
    mockRequestExplicitStreamAbort.mockRejectedValueOnce(new Error('agent down'))

    const response = await POST(createRequest({ streamId: 'stream-1', chatId: 'chat-1' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ aborted: true, settled: true })
    expect(mockWaitForPendingChatStream).toHaveBeenCalledWith('chat-1', 8000, 'stream-1')
    expect(mockReleasePendingChatStream).not.toHaveBeenCalled()
  })
})
