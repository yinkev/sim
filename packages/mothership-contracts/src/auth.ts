export const MOTHERSHIP_RUNTIME_KEY_HEADER = 'x-mothership-runtime-key'
export const SIM_CALLBACK_KEY_HEADER = 'x-sim-callback-key'
export const MOTHERSHIP_ADMIN_KEY_HEADER = 'x-mothership-admin-key'
export const MOTHERSHIP_SOURCE_ENV_HEADER = 'x-sim-source-env'
export const LEGACY_MOTHERSHIP_API_KEY_HEADER = 'x-api-key'

export type MothershipRuntimeKeySource = 'SIM_TO_MOTHERSHIP_API_KEY' | 'COPILOT_API_KEY'
export type MothershipSourceEnv = 'dev' | 'staging' | 'prod'
export type MothershipRuntimeHeaders = {
  [MOTHERSHIP_RUNTIME_KEY_HEADER]: string
  [MOTHERSHIP_SOURCE_ENV_HEADER]?: MothershipSourceEnv
}
export type SimCallbackHeaders = {
  [SIM_CALLBACK_KEY_HEADER]: string
}
export type MothershipAdminHeaders = {
  [MOTHERSHIP_ADMIN_KEY_HEADER]: string
  [MOTHERSHIP_SOURCE_ENV_HEADER]?: MothershipSourceEnv
}
export type LegacyMothershipApiKeyHeaders = {
  [LEGACY_MOTHERSHIP_API_KEY_HEADER]: string
  [MOTHERSHIP_SOURCE_ENV_HEADER]?: MothershipSourceEnv
}

export interface ResolveMothershipRuntimeKeyInput {
  simToMothershipApiKey?: string | null
  copilotApiKey?: string | null
}

export interface ResolvedMothershipRuntimeKey {
  key: string | null
  source: MothershipRuntimeKeySource | null
}

export interface MothershipSecretTopologyInput extends ResolveMothershipRuntimeKeyInput {
  mothershipToSimCallbackKey?: string | null
  mothershipAdminApiKey?: string | null
  internalApiSecret?: string | null
  requireRuntimeKey?: boolean
  requireCallbackKey?: boolean
  requireAdminKey?: boolean
}

export interface MothershipSecretTopologyResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  runtimeKeySource: MothershipRuntimeKeySource | null
}

export function resolveMothershipRuntimeKey(
  input: ResolveMothershipRuntimeKeyInput
): ResolvedMothershipRuntimeKey {
  const preferred = normalizeSecret(input.simToMothershipApiKey)
  if (preferred) return { key: preferred, source: 'SIM_TO_MOTHERSHIP_API_KEY' }

  const legacy = normalizeSecret(input.copilotApiKey)
  if (legacy) return { key: legacy, source: 'COPILOT_API_KEY' }

  return { key: null, source: null }
}

export function validateMothershipSecretTopology(
  input: MothershipSecretTopologyInput
): MothershipSecretTopologyResult {
  const errors: string[] = []
  const warnings: string[] = []
  const runtime = resolveMothershipRuntimeKey(input)
  const callbackKey = normalizeSecret(input.mothershipToSimCallbackKey)
  const adminKey = normalizeSecret(input.mothershipAdminApiKey)
  const internalApiSecret = normalizeSecret(input.internalApiSecret)

  if (input.requireRuntimeKey && !runtime.key) {
    errors.push('SIM_TO_MOTHERSHIP_API_KEY is required for Sim to Mothership runtime calls')
  }
  if (input.requireCallbackKey && !callbackKey) {
    errors.push('MOTHERSHIP_TO_SIM_CALLBACK_KEY is required for Mothership to Sim callbacks')
  }
  if (input.requireAdminKey && !adminKey) {
    errors.push('MOTHERSHIP_ADMIN_API_KEY is required for Mothership admin routes')
  }

  if (runtime.source === 'COPILOT_API_KEY') {
    warnings.push('COPILOT_API_KEY is being used only as a runtime-key compatibility alias')
  }

  addDistinctSecretError(errors, runtime.key, callbackKey, 'runtime key', 'callback key')
  addDistinctSecretError(errors, runtime.key, adminKey, 'runtime key', 'admin key')
  addDistinctSecretError(errors, callbackKey, adminKey, 'callback key', 'admin key')

  if (callbackKey && internalApiSecret && callbackKey === internalApiSecret) {
    errors.push('MOTHERSHIP_TO_SIM_CALLBACK_KEY must not reuse INTERNAL_API_SECRET')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    runtimeKeySource: runtime.source,
  }
}

export function createMothershipRuntimeHeaders(
  runtimeKey: string,
  options: { sourceEnv?: MothershipSourceEnv } = {}
): MothershipRuntimeHeaders {
  const headers: MothershipRuntimeHeaders = { [MOTHERSHIP_RUNTIME_KEY_HEADER]: runtimeKey }
  if (options.sourceEnv) headers[MOTHERSHIP_SOURCE_ENV_HEADER] = options.sourceEnv
  return headers
}

export function createSimCallbackHeaders(callbackKey: string): SimCallbackHeaders {
  return { [SIM_CALLBACK_KEY_HEADER]: callbackKey }
}

export function createMothershipAdminHeaders(
  adminKey: string,
  options: { sourceEnv?: MothershipSourceEnv } = {}
): MothershipAdminHeaders {
  const headers: MothershipAdminHeaders = { [MOTHERSHIP_ADMIN_KEY_HEADER]: adminKey }
  if (options.sourceEnv) headers[MOTHERSHIP_SOURCE_ENV_HEADER] = options.sourceEnv
  return headers
}

export function createLegacyMothershipRuntimeHeaders(
  runtimeHeaders: MothershipRuntimeHeaders
): LegacyMothershipApiKeyHeaders {
  return createLegacyMothershipApiKeyHeaders(
    runtimeHeaders[MOTHERSHIP_RUNTIME_KEY_HEADER],
    runtimeHeaders[MOTHERSHIP_SOURCE_ENV_HEADER]
  )
}

export function createLegacyMothershipAdminHeaders(
  adminHeaders: MothershipAdminHeaders
): LegacyMothershipApiKeyHeaders {
  return createLegacyMothershipApiKeyHeaders(
    adminHeaders[MOTHERSHIP_ADMIN_KEY_HEADER],
    adminHeaders[MOTHERSHIP_SOURCE_ENV_HEADER]
  )
}

function normalizeSecret(secret: string | null | undefined): string | null {
  const normalized = secret?.trim()
  return normalized ? normalized : null
}

function createLegacyMothershipApiKeyHeaders(
  apiKey: string,
  sourceEnv?: MothershipSourceEnv
): LegacyMothershipApiKeyHeaders {
  const headers: LegacyMothershipApiKeyHeaders = { [LEGACY_MOTHERSHIP_API_KEY_HEADER]: apiKey }
  if (sourceEnv) headers[MOTHERSHIP_SOURCE_ENV_HEADER] = sourceEnv
  return headers
}

function addDistinctSecretError(
  errors: string[],
  left: string | null,
  right: string | null,
  leftName: string,
  rightName: string
): void {
  if (left && right && left === right) {
    errors.push(`Mothership ${leftName} and ${rightName} must be distinct`)
  }
}
