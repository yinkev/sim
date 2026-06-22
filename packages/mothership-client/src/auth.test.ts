import { describe, expect, it } from 'vitest'
import {
  createLegacyMothershipAdminHeaders,
  createLegacyMothershipRuntimeHeaders,
  createMothershipAdminHeaders,
  createMothershipRuntimeHeaders,
  createSimCallbackHeaders,
  fingerprintSecret,
  LEGACY_MOTHERSHIP_API_KEY_HEADER,
  MOTHERSHIP_ADMIN_KEY_HEADER,
  MOTHERSHIP_RUNTIME_KEY_HEADER,
  MOTHERSHIP_SOURCE_ENV_HEADER,
  resolveMothershipRuntimeKey,
  SIM_CALLBACK_KEY_HEADER,
  validateMothershipSecretTopology,
} from './auth'

describe('resolveMothershipRuntimeKey', () => {
  it('prefers SIM_TO_MOTHERSHIP_API_KEY over the legacy COPILOT_API_KEY alias', () => {
    expect(
      resolveMothershipRuntimeKey({
        simToMothershipApiKey: 'runtime-key',
        copilotApiKey: 'legacy-key',
      })
    ).toEqual({ key: 'runtime-key', source: 'SIM_TO_MOTHERSHIP_API_KEY' })
  })

  it('uses COPILOT_API_KEY only as a runtime compatibility alias', () => {
    expect(resolveMothershipRuntimeKey({ copilotApiKey: 'legacy-key' })).toEqual({
      key: 'legacy-key',
      source: 'COPILOT_API_KEY',
    })
  })
})

describe('validateMothershipSecretTopology', () => {
  it('rejects missing required keys', () => {
    const result = validateMothershipSecretTopology({
      requireRuntimeKey: true,
      requireCallbackKey: true,
      requireAdminKey: true,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'SIM_TO_MOTHERSHIP_API_KEY is required for Sim to Mothership runtime calls'
    )
    expect(result.errors).toContain(
      'MOTHERSHIP_TO_SIM_CALLBACK_KEY is required for Mothership to Sim callbacks'
    )
    expect(result.errors).toContain(
      'MOTHERSHIP_ADMIN_API_KEY is required for Mothership admin routes'
    )
  })

  it('rejects reused secrets across trust domains', () => {
    const result = validateMothershipSecretTopology({
      simToMothershipApiKey: 'same-secret',
      mothershipToSimCallbackKey: 'same-secret',
      mothershipAdminApiKey: 'same-secret',
      internalApiSecret: 'same-secret',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Mothership runtime key and callback key must be distinct')
    expect(result.errors).toContain('Mothership runtime key and admin key must be distinct')
    expect(result.errors).toContain('Mothership callback key and admin key must be distinct')
    expect(result.errors).toContain(
      'MOTHERSHIP_TO_SIM_CALLBACK_KEY must not reuse INTERNAL_API_SECRET'
    )
  })

  it('warns when the legacy runtime alias is used', () => {
    const result = validateMothershipSecretTopology({
      copilotApiKey: 'legacy-runtime-key',
      mothershipToSimCallbackKey: 'callback-key',
      mothershipAdminApiKey: 'admin-key',
    })

    expect(result.valid).toBe(true)
    expect(result.runtimeKeySource).toBe('COPILOT_API_KEY')
    expect(result.warnings).toContain(
      'COPILOT_API_KEY is being used only as a runtime-key compatibility alias'
    )
  })
})

describe('auth header builders', () => {
  it('creates distinct runtime, callback, and admin headers', () => {
    expect(createMothershipRuntimeHeaders('runtime-key', { sourceEnv: 'dev' })).toEqual({
      [MOTHERSHIP_RUNTIME_KEY_HEADER]: 'runtime-key',
      [MOTHERSHIP_SOURCE_ENV_HEADER]: 'dev',
    })
    expect(createSimCallbackHeaders('callback-key')).toEqual({
      [SIM_CALLBACK_KEY_HEADER]: 'callback-key',
    })
    expect(createMothershipAdminHeaders('admin-key', { sourceEnv: 'prod' })).toEqual({
      [MOTHERSHIP_ADMIN_KEY_HEADER]: 'admin-key',
      [MOTHERSHIP_SOURCE_ENV_HEADER]: 'prod',
    })
  })

  it('converts strict headers to explicit legacy x-api-key headers', () => {
    expect(
      createLegacyMothershipRuntimeHeaders(
        createMothershipRuntimeHeaders('runtime-key', { sourceEnv: 'dev' })
      )
    ).toEqual({
      [LEGACY_MOTHERSHIP_API_KEY_HEADER]: 'runtime-key',
      [MOTHERSHIP_SOURCE_ENV_HEADER]: 'dev',
    })
    expect(createLegacyMothershipAdminHeaders(createMothershipAdminHeaders('admin-key'))).toEqual({
      [LEGACY_MOTHERSHIP_API_KEY_HEADER]: 'admin-key',
    })
  })
})

describe('fingerprintSecret', () => {
  it('creates a stable fingerprint without exposing the raw secret', () => {
    const fingerprint = fingerprintSecret('very-secret-value')

    expect(fingerprint).toHaveLength(12)
    expect(fingerprint).toBe(fingerprintSecret('very-secret-value'))
    expect(fingerprint).not.toContain('secret')
  })
})
