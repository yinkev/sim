/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFetch,
  mockCreateMothershipAdminAuthHeaders,
  mockGetRequiredSimAgentApiUrl,
  mockGetSession,
  mockGetMothershipSourceEnvHeaders,
  mockSelectLimit,
} = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockCreateMothershipAdminAuthHeaders: vi.fn(),
  mockGetRequiredSimAgentApiUrl: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetMothershipSourceEnvHeaders: vi.fn(),
  mockSelectLimit: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession,
}))

vi.mock('@sim/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: mockSelectLimit,
          })),
        })),
      })),
    })),
  },
}))

vi.mock('@sim/db/schema', () => ({
  settings: {
    superUserModeEnabled: 'settings.superUserModeEnabled',
    userId: 'settings.userId',
  },
  user: {
    id: 'user.id',
    role: 'user.role',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}))

vi.mock('@/lib/copilot/constants', () => ({
  getRequiredSimAgentApiUrl: mockGetRequiredSimAgentApiUrl,
}))

vi.mock('@/lib/copilot/server/agent-url', () => ({
  getMothershipSourceEnvHeaders: mockGetMothershipSourceEnvHeaders,
}))

vi.mock('@/lib/mothership/service-auth', () => ({
  createMothershipAdminAuthHeaders: mockCreateMothershipAdminAuthHeaders,
}))

import { DELETE, GET, POST } from '@/app/api/copilot/byok/route'

function createRequest(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json')

  return new NextRequest(url, {
    ...init,
    headers,
  })
}

describe('/api/copilot/byok admin proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1' } })
    mockSelectLimit.mockResolvedValue([{ role: 'admin', superUserModeEnabled: true }])
    mockGetRequiredSimAgentApiUrl.mockReturnValue('https://agent.sim.example.com')
    mockGetMothershipSourceEnvHeaders.mockReturnValue({ 'X-Sim-Source-Env': 'staging' })
    mockCreateMothershipAdminAuthHeaders.mockReturnValue({ 'x-api-key': 'runtime-key' })
    mockFetch.mockResolvedValue(Response.json({ providers: [] }))
    global.fetch = mockFetch
  })

  it('lists BYOK keys through the legacy runtime-authenticated Mothership admin proxy', async () => {
    const response = await GET(
      createRequest('http://localhost:3000/api/copilot/byok?workspaceId=ws-1')
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ providers: [] })
    expect(mockCreateMothershipAdminAuthHeaders).toHaveBeenCalledWith(
      'https://agent.sim.example.com'
    )
    expect(mockFetch).toHaveBeenCalledWith(
      'https://agent.sim.example.com/api/admin/byok?workspaceId=ws-1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-api-key': 'runtime-key',
          'X-Sim-Source-Env': 'staging',
        }),
      })
    )
  })

  it('uses strict admin auth headers for owned Mothership admin proxy targets', async () => {
    mockGetRequiredSimAgentApiUrl.mockReturnValueOnce('http://127.0.0.1:6891')
    mockCreateMothershipAdminAuthHeaders.mockReturnValueOnce({
      'x-mothership-admin-key': 'admin-key',
    })

    const response = await GET(
      createRequest('http://localhost:3000/api/copilot/byok?workspaceId=ws-1')
    )

    expect(response.status).toBe(200)
    expect(mockCreateMothershipAdminAuthHeaders).toHaveBeenCalledWith('http://127.0.0.1:6891')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:6891/api/admin/byok?workspaceId=ws-1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-mothership-admin-key': 'admin-key',
          'X-Sim-Source-Env': 'staging',
        }),
      })
    )
  })

  it('binds BYOK creation to the authenticated superuser', async () => {
    mockFetch.mockResolvedValueOnce(Response.json({ success: true, provider: 'openai' }))

    const response = await POST(
      createRequest('http://localhost:3000/api/copilot/byok', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'ws-1',
          provider: 'openai',
          apiKey: 'sk-test',
          createdBy: 'client-supplied',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, provider: 'openai' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://agent.sim.example.com/api/admin/byok',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'x-api-key': 'runtime-key',
          'X-Sim-Source-Env': 'staging',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: 'ws-1',
          provider: 'openai',
          apiKey: 'sk-test',
          createdBy: 'admin-1',
        }),
      })
    )
  })

  it('preserves upstream admin errors', async () => {
    mockFetch.mockResolvedValueOnce(Response.json({ error: 'Forbidden' }, { status: 403 }))

    const response = await DELETE(
      createRequest('http://localhost:3000/api/copilot/byok?workspaceId=ws-1&provider=openai', {
        method: 'DELETE',
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
  })

  it('tolerates empty successful upstream bodies', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const response = await DELETE(
      createRequest('http://localhost:3000/api/copilot/byok?workspaceId=ws-1&provider=openai', {
        method: 'DELETE',
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({})
  })

  it('returns a configuration error when admin proxy auth cannot be built', async () => {
    mockCreateMothershipAdminAuthHeaders.mockImplementationOnce(() => {
      throw new Error('MOTHERSHIP_ADMIN_API_KEY is required for owned Mothership admin calls')
    })

    const response = await GET(
      createRequest('http://localhost:3000/api/copilot/byok?workspaceId=ws-1')
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error:
        'Mothership admin authentication not configured: MOTHERSHIP_ADMIN_API_KEY is required for owned Mothership admin calls',
    })
  })
})
