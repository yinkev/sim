/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { envMock } = vi.hoisted(() => ({
  envMock: {
    SIM_TO_MOTHERSHIP_API_KEY: 'runtime-key',
    MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-key',
    MOTHERSHIP_ADMIN_API_KEY: 'admin-key',
    MOTHERSHIP_RUNTIME_HEADER_MODE: 'legacy' as 'legacy' | 'strict' | undefined,
    INTERNAL_API_SECRET: 'internal-secret',
    COPILOT_API_KEY: undefined as string | undefined,
    SIM_AGENT_API_URL: 'https://copilot.sim.ai' as string | undefined,
  },
}))

vi.mock('@/lib/core/config/env', () => ({
  env: envMock,
}))

import {
  assertMothershipServiceSecretTopology,
  checkSimCallbackAuth,
  createMothershipAdminAuthHeaders,
  createMothershipRuntimeAuthHeaders,
  getMothershipAdminHeaderMode,
  getMothershipRuntimeHeaderMode,
} from '@/lib/mothership/service-auth'

describe('checkSimCallbackAuth', () => {
  beforeEach(() => {
    envMock.SIM_TO_MOTHERSHIP_API_KEY = 'runtime-key'
    envMock.MOTHERSHIP_TO_SIM_CALLBACK_KEY = 'callback-key'
    envMock.MOTHERSHIP_ADMIN_API_KEY = 'admin-key'
    envMock.MOTHERSHIP_RUNTIME_HEADER_MODE = 'legacy'
    envMock.INTERNAL_API_SECRET = 'internal-secret'
    envMock.COPILOT_API_KEY = undefined
    envMock.SIM_AGENT_API_URL = 'https://copilot.sim.ai'
  })

  it('accepts the callback key on the callback header only', () => {
    expect(checkSimCallbackAuth(new Headers({ 'x-sim-callback-key': 'callback-key' }))).toEqual({
      success: true,
    })
  })

  it('rejects missing callback credentials as unauthenticated', () => {
    expect(checkSimCallbackAuth(new Headers())).toEqual({
      success: false,
      status: 401,
      error: 'Mothership callback key required',
    })
  })

  it('rejects a wrong callback key as forbidden', () => {
    expect(checkSimCallbackAuth(new Headers({ 'x-sim-callback-key': 'wrong-key' }))).toEqual({
      success: false,
      status: 401,
      error: 'Invalid Mothership callback key',
    })
  })

  it('rejects mixed callback and wrong-family credentials', () => {
    expect(
      checkSimCallbackAuth(
        new Headers({
          'x-sim-callback-key': 'callback-key',
          'x-api-key': 'internal-secret',
        })
      )
    ).toEqual({
      success: false,
      status: 403,
      error: 'Wrong Mothership service key family for callback route',
    })
  })

  it('rejects runtime, admin, and legacy key families on callback routes', () => {
    const wrongFamilyCases = [
      { 'x-mothership-runtime-key': 'runtime-key' },
      { 'x-mothership-admin-key': 'admin-key' },
      { 'x-api-key': 'internal-secret' },
      { 'x-api-key': 'public-api-key' },
    ]

    for (const headers of wrongFamilyCases) {
      expect(checkSimCallbackAuth(new Headers(headers))).toEqual({
        success: false,
        status: 403,
        error: 'Wrong Mothership service key family for callback route',
      })
    }
  })

  it('rejects the callback key on the legacy x-api-key header', () => {
    expect(checkSimCallbackAuth(new Headers({ 'x-api-key': 'callback-key' }))).toEqual({
      success: false,
      status: 403,
      error: 'Wrong Mothership service key family for callback route',
    })
  })

  it('rejects default legacy x-api-key before reporting missing callback config', () => {
    envMock.MOTHERSHIP_TO_SIM_CALLBACK_KEY = undefined

    expect(checkSimCallbackAuth(new Headers({ 'x-api-key': 'callback-key' }))).toEqual({
      success: false,
      status: 403,
      error: 'Wrong Mothership service key family for callback route',
    })
  })

  it('rejects the runtime key on legacy x-api-key callbacks', () => {
    expect(checkSimCallbackAuth(new Headers({ 'x-api-key': 'runtime-key' }))).toEqual({
      success: false,
      status: 403,
      error: 'Wrong Mothership service key family for callback route',
    })
  })

  it('rejects invalid legacy x-api-key callbacks', () => {
    expect(checkSimCallbackAuth(new Headers({ 'x-api-key': 'wrong-key' }))).toEqual({
      success: false,
      status: 403,
      error: 'Wrong Mothership service key family for callback route',
    })
  })

  it('fails closed when the callback secret is not configured', () => {
    envMock.MOTHERSHIP_TO_SIM_CALLBACK_KEY = undefined

    expect(checkSimCallbackAuth(new Headers({ 'x-sim-callback-key': 'callback-key' }))).toEqual({
      success: false,
      status: 500,
      error: 'Mothership callback key not configured',
    })
  })
})

describe('assertMothershipServiceSecretTopology', () => {
  beforeEach(() => {
    envMock.SIM_TO_MOTHERSHIP_API_KEY = 'runtime-key'
    envMock.MOTHERSHIP_TO_SIM_CALLBACK_KEY = 'callback-key'
    envMock.MOTHERSHIP_ADMIN_API_KEY = 'admin-key'
    envMock.MOTHERSHIP_RUNTIME_HEADER_MODE = 'legacy'
    envMock.INTERNAL_API_SECRET = 'internal-secret'
    envMock.COPILOT_API_KEY = undefined
    envMock.SIM_AGENT_API_URL = 'https://copilot.sim.ai'
  })

  it('accepts distinct service secrets', () => {
    expect(assertMothershipServiceSecretTopology({ requireCallbackKey: true })).toMatchObject({
      valid: true,
      runtimeKeySource: 'SIM_TO_MOTHERSHIP_API_KEY',
    })
  })

  it('rejects reused callback and internal API secrets', () => {
    envMock.MOTHERSHIP_TO_SIM_CALLBACK_KEY = 'internal-secret'

    expect(() => assertMothershipServiceSecretTopology({ requireCallbackKey: true })).toThrow(
      'MOTHERSHIP_TO_SIM_CALLBACK_KEY must not reuse INTERNAL_API_SECRET'
    )
  })

  it('rejects missing admin key when admin routes are startup-required', () => {
    envMock.MOTHERSHIP_ADMIN_API_KEY = undefined

    expect(() => assertMothershipServiceSecretTopology({ requireAdminKey: true })).toThrow(
      'MOTHERSHIP_ADMIN_API_KEY is required for Mothership admin routes'
    )
  })
})

describe('createMothershipRuntimeAuthHeaders', () => {
  beforeEach(() => {
    envMock.SIM_TO_MOTHERSHIP_API_KEY = 'runtime-key'
    envMock.MOTHERSHIP_RUNTIME_HEADER_MODE = undefined
    envMock.COPILOT_API_KEY = undefined
    envMock.SIM_AGENT_API_URL = 'https://copilot.sim.ai'
  })

  it('defaults hosted Copilot runtime calls to legacy x-api-key compatibility', () => {
    expect(getMothershipRuntimeHeaderMode()).toBe('legacy')
    expect(createMothershipRuntimeAuthHeaders()).toEqual({
      'x-api-key': 'runtime-key',
    })
  })

  it('defaults owned Mothership runtime calls to strict headers', () => {
    envMock.SIM_AGENT_API_URL = 'http://127.0.0.1:6891'

    expect(getMothershipRuntimeHeaderMode()).toBe('strict')
    expect(createMothershipRuntimeAuthHeaders()).toEqual({
      'x-mothership-runtime-key': 'runtime-key',
    })
  })

  it('honors explicit legacy runtime header mode', () => {
    envMock.SIM_AGENT_API_URL = 'http://127.0.0.1:6891'
    envMock.MOTHERSHIP_RUNTIME_HEADER_MODE = 'legacy'

    expect(getMothershipRuntimeHeaderMode()).toBe('legacy')
    expect(createMothershipRuntimeAuthHeaders()).toEqual({
      'x-api-key': 'runtime-key',
    })
  })

  it('uses strict owned Mothership runtime headers when enabled', () => {
    envMock.MOTHERSHIP_RUNTIME_HEADER_MODE = 'strict'

    expect(getMothershipRuntimeHeaderMode()).toBe('strict')
    expect(createMothershipRuntimeAuthHeaders()).toEqual({
      'x-mothership-runtime-key': 'runtime-key',
    })
  })
})

describe('createMothershipAdminAuthHeaders', () => {
  beforeEach(() => {
    envMock.SIM_TO_MOTHERSHIP_API_KEY = 'runtime-key'
    envMock.MOTHERSHIP_ADMIN_API_KEY = 'admin-key'
    envMock.MOTHERSHIP_RUNTIME_HEADER_MODE = undefined
    envMock.COPILOT_API_KEY = undefined
    envMock.SIM_AGENT_API_URL = 'https://copilot.sim.ai'
  })

  it('keeps hosted Copilot admin calls on legacy runtime-key compatibility', () => {
    expect(getMothershipAdminHeaderMode('https://copilot.sim.ai')).toBe('legacy')
    expect(createMothershipAdminAuthHeaders('https://copilot.sim.ai')).toEqual({
      'x-api-key': 'runtime-key',
    })
  })

  it('uses strict admin headers for owned Mothership admin calls', () => {
    expect(getMothershipAdminHeaderMode('http://127.0.0.1:6891')).toBe('strict')
    expect(createMothershipAdminAuthHeaders('http://127.0.0.1:6891')).toEqual({
      'x-mothership-admin-key': 'admin-key',
    })
  })

  it('requires the admin key for owned Mothership admin calls', () => {
    envMock.MOTHERSHIP_ADMIN_API_KEY = undefined

    expect(() => createMothershipAdminAuthHeaders('http://127.0.0.1:6891')).toThrow(
      'MOTHERSHIP_ADMIN_API_KEY is required for owned Mothership admin calls'
    )
  })
})
