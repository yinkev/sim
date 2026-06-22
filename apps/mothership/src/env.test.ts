import { describe, expect, it } from 'vitest'
import { loadEnv } from '@/env'

const BASE_ENV = {
  NODE_ENV: 'test',
  SIM_TO_MOTHERSHIP_API_KEY: 'runtime-secret-at-least-16',
}

describe('loadEnv', () => {
  it('loads required runtime secret and defaults host/port', () => {
    expect(loadEnv(BASE_ENV)).toMatchObject({
      NODE_ENV: 'test',
      HOST: '0.0.0.0',
      PORT: 6891,
      SIM_TO_MOTHERSHIP_API_KEY: 'runtime-secret-at-least-16',
    })
  })

  it('loads the owned OpenAI provider key when configured', () => {
    expect(
      loadEnv({
        ...BASE_ENV,
        MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
      })
    ).toMatchObject({
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })
  })

  it('loads the owned CliProxyAPI provider configuration when configured', () => {
    expect(
      loadEnv({
        ...BASE_ENV,
        MOTHERSHIP_DEFAULT_PROVIDER: 'cliproxy',
        MOTHERSHIP_CLIPROXY_API_KEY: '  proxy-secret  ',
        MOTHERSHIP_CLIPROXY_BASE_URL: 'http://localhost:8317/v1',
        MOTHERSHIP_CLIPROXY_MODEL: 'gpt-5.5',
        MOTHERSHIP_CLIPROXY_MAX_COMPLETION_TOKENS: '1234',
        MOTHERSHIP_CLIPROXY_REASONING_EFFORT: 'high',
        MOTHERSHIP_PROVIDER_REQUEST_TIMEOUT_MS: '300000',
      })
    ).toMatchObject({
      MOTHERSHIP_DEFAULT_PROVIDER: 'cliproxyapi',
      MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
      MOTHERSHIP_CLIPROXY_BASE_URL: 'http://localhost:8317/v1',
      MOTHERSHIP_CLIPROXY_MODEL: 'gpt-5.5',
      MOTHERSHIP_CLIPROXY_MAX_COMPLETION_TOKENS: 1234,
      MOTHERSHIP_CLIPROXY_REASONING_EFFORT: 'high',
      MOTHERSHIP_PROVIDER_REQUEST_TIMEOUT_MS: 300000,
    })
  })

  it('rejects unsafe CliProxyAPI provider configuration', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        MOTHERSHIP_CLIPROXY_API_KEY: '   ',
      })
    ).toThrow()
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        MOTHERSHIP_CLIPROXY_BASE_URL: 'http://user:pass@localhost:8317',
      })
    ).toThrow('MOTHERSHIP_CLIPROXY_BASE_URL must be an http(s) URL without credentials')
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        MOTHERSHIP_CLIPROXY_MAX_COMPLETION_TOKENS: '0',
      })
    ).toThrow()
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        MOTHERSHIP_PROVIDER_REQUEST_TIMEOUT_MS: '0',
      })
    ).toThrow()
  })

  it('rejects reused runtime and admin secrets', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        MOTHERSHIP_ADMIN_API_KEY: 'runtime-secret-at-least-16',
      })
    ).toThrow('Mothership runtime key and admin key must be distinct')
  })

  it('requires the admin secret in production', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        NODE_ENV: 'production',
      })
    ).toThrow('MOTHERSHIP_ADMIN_API_KEY is required for Mothership admin routes')
  })

  it('loads production when admin auth is configured', () => {
    expect(
      loadEnv({
        ...BASE_ENV,
        NODE_ENV: 'production',
        MOTHERSHIP_ADMIN_API_KEY: 'admin-secret-at-least-16',
        MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
        SIM_BASE_URL: 'http://sim.local',
        API_ENCRYPTION_KEY: 'b'.repeat(64),
        ENCRYPTION_KEY: 'a'.repeat(64),
      })
    ).toMatchObject({
      NODE_ENV: 'production',
      SIM_TO_MOTHERSHIP_API_KEY: 'runtime-secret-at-least-16',
      MOTHERSHIP_ADMIN_API_KEY: 'admin-secret-at-least-16',
      MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
      SIM_BASE_URL: 'http://sim.local',
      API_ENCRYPTION_KEY: 'b'.repeat(64),
      ENCRYPTION_KEY: 'a'.repeat(64),
    })
  })

  it('requires the callback secret in production', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        NODE_ENV: 'production',
        MOTHERSHIP_ADMIN_API_KEY: 'admin-secret-at-least-16',
        SIM_BASE_URL: 'http://sim.local',
        API_ENCRYPTION_KEY: 'b'.repeat(64),
        ENCRYPTION_KEY: 'a'.repeat(64),
      })
    ).toThrow('MOTHERSHIP_TO_SIM_CALLBACK_KEY is required for Mothership to Sim callbacks')
  })

  it('requires the Sim base URL in production', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        NODE_ENV: 'production',
        MOTHERSHIP_ADMIN_API_KEY: 'admin-secret-at-least-16',
        MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
        API_ENCRYPTION_KEY: 'b'.repeat(64),
        ENCRYPTION_KEY: 'a'.repeat(64),
      })
    ).toThrow('SIM_BASE_URL is required for Mothership to Sim callbacks')
  })

  it('requires the encryption key in production', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        NODE_ENV: 'production',
        MOTHERSHIP_ADMIN_API_KEY: 'admin-secret-at-least-16',
        MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
        SIM_BASE_URL: 'http://sim.local',
        API_ENCRYPTION_KEY: 'b'.repeat(64),
      })
    ).toThrow('ENCRYPTION_KEY is required for Mothership BYOK admin storage')
  })

  it('requires the API encryption key in production', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        NODE_ENV: 'production',
        MOTHERSHIP_ADMIN_API_KEY: 'admin-secret-at-least-16',
        MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
        SIM_BASE_URL: 'http://sim.local',
        ENCRYPTION_KEY: 'a'.repeat(64),
      })
    ).toThrow('API_ENCRYPTION_KEY is required for Mothership API key storage')
  })

  it('rejects malformed encryption keys', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        ENCRYPTION_KEY: 'not-hex',
      })
    ).toThrow('ENCRYPTION_KEY must be a 64-character hex string')
  })

  it('rejects malformed API encryption keys', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        API_ENCRYPTION_KEY: 'not-hex',
      })
    ).toThrow('API_ENCRYPTION_KEY must be a 64-character hex string')
  })

  it('rejects invalid model catalog JSON', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        MOTHERSHIP_AVAILABLE_MODELS_JSON: '{',
      })
    ).toThrow('MOTHERSHIP_AVAILABLE_MODELS_JSON must be valid JSON')
  })

  it('rejects invalid model catalog shape', () => {
    expect(() =>
      loadEnv({
        ...BASE_ENV,
        MOTHERSHIP_AVAILABLE_MODELS_JSON: JSON.stringify([{ name: 'Missing id' }]),
      })
    ).toThrow('MOTHERSHIP_AVAILABLE_MODELS_JSON must be an array of model descriptors')
  })
})
