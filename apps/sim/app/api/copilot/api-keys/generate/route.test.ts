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
  })
)

import { POST } from '@/app/api/copilot/api-keys/generate/route'

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/copilot/api-keys/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/copilot/api-keys/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMockFns.mockGetSession.mockResolvedValue({ user: { id: 'user-123' } })
    mockGetMothershipBaseURL.mockResolvedValue('https://agent.sim.example.com')
    global.fetch = mockFetch
  })

  it('generates a Copilot API key through the typed owned Mothership client', async () => {
    mockFetch.mockResolvedValueOnce(Response.json({ id: 'key-123', apiKey: 'sk-sim-secret' }))

    const response = await POST(createRequest({ name: 'Production' }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      success: true,
      key: { id: 'key-123', apiKey: 'sk-sim-secret' },
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://agent.sim.example.com/api/validate-key/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-mothership-runtime-key': 'legacy-runtime-key',
        }),
        body: JSON.stringify({ userId: 'user-123', name: 'Production' }),
      })
    )
  })

  it('preserves upstream error status', async () => {
    mockFetch.mockResolvedValueOnce(Response.json({ error: 'quota' }, { status: 429 }))

    const response = await POST(createRequest({ name: 'Production' }))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to generate copilot API key' })
  })

  it('returns invalid response when Mothership omits the API key', async () => {
    mockFetch.mockResolvedValueOnce(Response.json({ id: 'key-123' }))

    const response = await POST(createRequest({ name: 'Production' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid response from Sim Agent' })
  })

  it('returns 401 without calling Mothership when the user is not authenticated', async () => {
    authMockFns.mockGetSession.mockResolvedValueOnce(null)

    const response = await POST(createRequest({ name: 'Production' }))

    expect(response.status).toBe(401)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
