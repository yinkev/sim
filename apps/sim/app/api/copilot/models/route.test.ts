/**
 * @vitest-environment node
 */
import { authMockFns, createEnvMock } from '@sim/testing'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetch, mockGetMothershipBaseURL } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockGetMothershipBaseURL: vi.fn(),
}))

vi.mock('@/lib/copilot/server/agent-url', () => ({
  getMothershipBaseURL: mockGetMothershipBaseURL,
}))

vi.mock('@/lib/core/config/env', () =>
  createEnvMock({
    COPILOT_API_KEY: 'legacy-runtime-key',
    SIM_TO_MOTHERSHIP_API_KEY: undefined,
    MOTHERSHIP_RUNTIME_HEADER_MODE: 'legacy',
  })
)

import { GET } from '@/app/api/copilot/models/route'

describe('GET /api/copilot/models', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMockFns.mockGetSession.mockResolvedValue({ user: { id: 'user-123' } })
    mockGetMothershipBaseURL.mockResolvedValue('https://agent.sim.example.com')
    global.fetch = mockFetch
  })

  it('returns normalized models from the Mothership contract response', async () => {
    mockFetch.mockResolvedValueOnce(
      Response.json({
        success: true,
        models: [
          { id: 'claude-4.8', friendlyName: 'Claude Opus 4.8', provider: 'anthropic' },
          { id: 'gpt-5.5', displayName: 'GPT 5.5', provider: 'openai' },
          { id: 'minimal-model' },
        ],
      })
    )

    const response = await GET(new NextRequest('http://localhost:3000/api/copilot/models'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      models: [
        { id: 'claude-4.8', friendlyName: 'Claude Opus 4.8', provider: 'anthropic' },
        { id: 'gpt-5.5', friendlyName: 'GPT 5.5', provider: 'openai' },
        { id: 'minimal-model', friendlyName: 'minimal-model', provider: 'unknown' },
      ],
    })
  })

  it('uses explicit legacy runtime wire mode while preserving typed headers', async () => {
    mockFetch.mockResolvedValueOnce(Response.json({ success: true, models: [] }))

    await GET(new NextRequest('http://localhost:3000/api/copilot/models'))

    expect(mockFetch).toHaveBeenCalledWith(
      'https://agent.sim.example.com/api/get-available-models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-api-key': 'legacy-runtime-key',
        }),
      })
    )
  })

  it('returns upstream status and error when Mothership rejects the request', async () => {
    mockFetch.mockResolvedValueOnce(
      Response.json({ success: false, error: 'models unavailable' }, { status: 503 })
    )

    const response = await GET(new NextRequest('http://localhost:3000/api/copilot/models'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'models unavailable',
      models: [],
    })
  })

  it('returns 500 when Mothership returns an invalid successful response', async () => {
    mockFetch.mockResolvedValueOnce(Response.json({ success: true }))

    const response = await GET(new NextRequest('http://localhost:3000/api/copilot/models'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Invalid response from Sim Agent',
      models: [],
    })
  })

  it('returns 401 without calling Mothership when the user is not authenticated', async () => {
    authMockFns.mockGetSession.mockResolvedValueOnce(null)

    const response = await GET(new NextRequest('http://localhost:3000/api/copilot/models'))

    expect(response.status).toBe(401)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
