/**
 * @vitest-environment node
 */

import { ROOT_CONTEXT } from '@opentelemetry/api'
import { adminByokGetContract, validateKeyDeleteContract } from '@sim/mothership-contracts/routes'
import { createEnvMock } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TraceAttr } from '@/lib/copilot/generated/trace-attributes-v1'

const { mockFetchGo } = vi.hoisted(() => ({
  mockFetchGo: vi.fn(),
}))

vi.mock('@/lib/core/config/env', () =>
  createEnvMock({
    COPILOT_API_KEY: 'legacy-runtime-key',
    SIM_TO_MOTHERSHIP_API_KEY: undefined,
    MOTHERSHIP_RUNTIME_HEADER_MODE: 'legacy',
    MOTHERSHIP_ADMIN_API_KEY: 'admin-key',
    COPILOT_SOURCE_ENV: 'staging',
  })
)

vi.mock('@/lib/copilot/request/go/fetch', () => ({
  fetchGo: mockFetchGo,
}))

import { env } from '@/lib/core/config/env'
import { requestMothershipAdmin, requestMothershipRuntime } from '@/lib/mothership/client'

describe('requestMothershipRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    env.COPILOT_API_KEY = 'legacy-runtime-key'
    env.SIM_TO_MOTHERSHIP_API_KEY = undefined
    env.MOTHERSHIP_RUNTIME_HEADER_MODE = 'legacy'
    env.MOTHERSHIP_ADMIN_API_KEY = 'admin-key'
    env.COPILOT_SOURCE_ENV = 'staging'
    mockFetchGo.mockResolvedValue(Response.json({ success: true }))
  })

  it('defaults hosted Copilot runtime URLs to legacy wire mode', async () => {
    env.MOTHERSHIP_RUNTIME_HEADER_MODE = undefined

    await requestMothershipRuntime({
      contract: validateKeyDeleteContract,
      baseUrl: 'https://copilot.sim.ai',
      input: { body: { userId: 'user-123', apiKeyId: 'key-123' } },
      spanName: 'sim -> hosted /api/validate-key/delete',
      operation: 'delete_api_key',
    })

    expect(mockFetchGo).toHaveBeenCalledWith(
      'https://copilot.sim.ai/api/validate-key/delete',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-api-key': 'legacy-runtime-key',
          'x-sim-source-env': 'staging',
        }),
      })
    )
    expect(
      new Headers(mockFetchGo.mock.calls[0]?.[1]?.headers as HeadersInit).get(
        'x-mothership-runtime-key'
      )
    ).toBeNull()
  })

  it('defaults owned Mothership runtime URLs to strict wire mode', async () => {
    env.MOTHERSHIP_RUNTIME_HEADER_MODE = undefined

    await requestMothershipRuntime({
      contract: validateKeyDeleteContract,
      baseUrl: 'http://127.0.0.1:6891',
      input: { body: { userId: 'user-123', apiKeyId: 'key-123' } },
      spanName: 'sim -> mothership /api/validate-key/delete',
      operation: 'delete_api_key',
    })

    expect(mockFetchGo).toHaveBeenCalledWith(
      'http://127.0.0.1:6891/api/validate-key/delete',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-mothership-runtime-key': 'legacy-runtime-key',
          'x-sim-source-env': 'staging',
        }),
      })
    )
    expect(
      new Headers(mockFetchGo.mock.calls[0]?.[1]?.headers as HeadersInit).get('x-api-key')
    ).toBeNull()
  })

  it('uses explicit legacy runtime wire mode and preserves trace attributes', async () => {
    env.MOTHERSHIP_RUNTIME_HEADER_MODE = 'legacy'

    await requestMothershipRuntime({
      contract: validateKeyDeleteContract,
      baseUrl: 'https://agent.sim.example.com',
      input: { body: { userId: 'user-123', apiKeyId: 'key-123' } },
      spanName: 'sim -> go /api/validate-key/delete',
      operation: 'delete_api_key',
      userId: 'user-123',
      otelContext: ROOT_CONTEXT,
      attributes: { [TraceAttr.ApiKeyId]: 'key-123' },
    })

    expect(mockFetchGo).toHaveBeenCalledWith(
      'https://agent.sim.example.com/api/validate-key/delete',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-api-key': 'legacy-runtime-key',
          'x-sim-source-env': 'staging',
        }),
        body: JSON.stringify({ userId: 'user-123', apiKeyId: 'key-123' }),
        otelContext: ROOT_CONTEXT,
        spanName: 'sim -> go /api/validate-key/delete',
        operation: 'delete_api_key',
        attributes: {
          [TraceAttr.UserId]: 'user-123',
          [TraceAttr.ApiKeyId]: 'key-123',
        },
      })
    )
  })

  it('uses strict runtime headers when the owned Mothership mode is enabled', async () => {
    env.MOTHERSHIP_RUNTIME_HEADER_MODE = 'strict'

    await requestMothershipRuntime({
      contract: validateKeyDeleteContract,
      baseUrl: 'https://agent.sim.example.com',
      input: { body: { userId: 'user-123', apiKeyId: 'key-123' } },
      spanName: 'sim -> mothership /api/validate-key/delete',
      operation: 'delete_api_key',
    })

    expect(mockFetchGo).toHaveBeenCalledWith(
      'https://agent.sim.example.com/api/validate-key/delete',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-mothership-runtime-key': 'legacy-runtime-key',
          'x-sim-source-env': 'staging',
        }),
      })
    )
    expect(
      new Headers(mockFetchGo.mock.calls[0]?.[1]?.headers as HeadersInit).get('x-api-key')
    ).toBeNull()
  })

  it('uses explicit legacy admin wire mode for admin contracts', async () => {
    env.MOTHERSHIP_RUNTIME_HEADER_MODE = 'legacy'
    mockFetchGo.mockResolvedValueOnce(Response.json({ providers: [] }))

    await requestMothershipAdmin({
      contract: adminByokGetContract,
      baseUrl: 'https://agent.sim.example.com',
      input: { query: { workspaceId: 'ws-1' } },
      spanName: 'sim -> go /api/admin/byok',
      operation: 'admin_byok_get',
      attributes: { workspaceId: 'ws-1' },
    })

    expect(mockFetchGo).toHaveBeenCalledWith(
      'https://agent.sim.example.com/api/admin/byok?workspaceId=ws-1',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-api-key': 'admin-key',
          'x-sim-source-env': 'staging',
        }),
        spanName: 'sim -> go /api/admin/byok',
        operation: 'admin_byok_get',
        attributes: { workspaceId: 'ws-1' },
      })
    )
  })
})
