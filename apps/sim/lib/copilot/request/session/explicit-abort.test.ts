/**
 * @vitest-environment node
 */

import { ROOT_CONTEXT } from '@opentelemetry/api'
import { createEnvMock } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TraceAttr } from '@/lib/copilot/generated/trace-attributes-v1'

const { mockFetchGo, mockGetMothershipBaseURL } = vi.hoisted(() => ({
  mockFetchGo: vi.fn(),
  mockGetMothershipBaseURL: vi.fn(),
}))

vi.mock('@/lib/core/config/env', () =>
  createEnvMock({
    COPILOT_API_KEY: 'legacy-runtime-key',
    SIM_TO_MOTHERSHIP_API_KEY: undefined,
    COPILOT_SOURCE_ENV: 'dev',
  })
)

vi.mock('@/lib/copilot/server/agent-url', () => ({
  getMothershipBaseURL: mockGetMothershipBaseURL,
}))

vi.mock('@/lib/copilot/request/go/fetch', () => ({
  fetchGo: mockFetchGo,
}))

import { requestExplicitStreamAbort } from '@/lib/copilot/request/session/explicit-abort'

describe('requestExplicitStreamAbort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMothershipBaseURL.mockResolvedValue('https://agent.sim.example.com')
    mockFetchGo.mockResolvedValue(Response.json({ success: true }))
  })

  it('posts the explicit abort marker through the typed runtime client', async () => {
    await requestExplicitStreamAbort({
      streamId: 'stream-1',
      userId: 'user-1',
      chatId: 'chat-1',
      workspaceId: 'ws-1',
      otelContext: ROOT_CONTEXT,
    })

    expect(mockGetMothershipBaseURL).toHaveBeenCalledWith({ userId: 'user-1' })
    expect(mockFetchGo).toHaveBeenCalledWith(
      'https://agent.sim.example.com/api/streams/explicit-abort',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-mothership-runtime-key': 'legacy-runtime-key',
          'x-sim-source-env': 'dev',
        }),
        body: JSON.stringify({
          messageId: 'stream-1',
          userId: 'user-1',
          chatId: 'chat-1',
          workspaceId: 'ws-1',
        }),
        otelContext: ROOT_CONTEXT,
        spanName: 'sim → go /api/streams/explicit-abort',
        operation: 'explicit_abort',
        attributes: {
          [TraceAttr.StreamId]: 'stream-1',
          [TraceAttr.ChatId]: 'chat-1',
        },
      })
    )
  })

  it('preserves the explicit abort status error message for non-OK responses', async () => {
    mockFetchGo.mockResolvedValueOnce(Response.json({ error: 'unavailable' }, { status: 503 }))

    await expect(
      requestExplicitStreamAbort({
        streamId: 'stream-1',
        userId: 'user-1',
      })
    ).rejects.toThrow('Explicit abort marker request failed: 503')
  })
})
