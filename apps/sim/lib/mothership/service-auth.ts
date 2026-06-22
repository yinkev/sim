import {
  LEGACY_MOTHERSHIP_API_KEY_HEADER,
  MOTHERSHIP_ADMIN_KEY_HEADER,
  MOTHERSHIP_RUNTIME_KEY_HEADER,
  type MothershipSecretTopologyResult,
  resolveMothershipRuntimeKey,
  SIM_CALLBACK_KEY_HEADER,
  validateMothershipSecretTopology,
} from '@sim/mothership-client'
import { safeCompare } from '@sim/security/compare'
import { env } from '@/lib/core/config/env'

export interface MothershipServiceAuthSuccess {
  success: true
}

export interface MothershipServiceAuthFailure {
  success: false
  status: 401 | 403 | 500
  error: string
}

export type MothershipServiceAuthResult =
  | MothershipServiceAuthSuccess
  | MothershipServiceAuthFailure

export function getMothershipRuntimeApiKey(): string | null {
  return resolveMothershipRuntimeKey({
    simToMothershipApiKey: env.SIM_TO_MOTHERSHIP_API_KEY,
    copilotApiKey: env.COPILOT_API_KEY,
  }).key
}

export function getMothershipAdminApiKey(): string | null {
  return env.MOTHERSHIP_ADMIN_API_KEY?.trim() || null
}

export function requireMothershipRuntimeApiKey(): string {
  const key = getMothershipRuntimeApiKey()
  if (!key) {
    throw new Error(
      'SIM_TO_MOTHERSHIP_API_KEY or legacy COPILOT_API_KEY is required for Mothership runtime calls'
    )
  }
  return key
}

export function requireMothershipAdminApiKey(): string {
  const key = getMothershipAdminApiKey()
  if (!key) {
    throw new Error('MOTHERSHIP_ADMIN_API_KEY is required for owned Mothership admin calls')
  }
  return key
}

function isHostedCopilotUrl(url: string | undefined): boolean {
  if (!url?.trim()) return false
  try {
    const hostname = new URL(url).hostname
    return hostname === 'copilot.sim.ai' || hostname === 'www.copilot.sim.ai'
  } catch {
    return false
  }
}

export function getMothershipRuntimeHeaderMode(
  targetUrl = env.SIM_AGENT_API_URL
): 'legacy' | 'strict' {
  if (env.MOTHERSHIP_RUNTIME_HEADER_MODE) {
    return env.MOTHERSHIP_RUNTIME_HEADER_MODE === 'strict' ? 'strict' : 'legacy'
  }

  return isHostedCopilotUrl(targetUrl) ? 'legacy' : 'strict'
}

export function getMothershipAdminHeaderMode(
  targetUrl = env.SIM_AGENT_API_URL
): 'legacy' | 'strict' {
  return isHostedCopilotUrl(targetUrl) ? 'legacy' : 'strict'
}

export function createMothershipRuntimeAuthHeaders(
  targetUrl = env.SIM_AGENT_API_URL
): Record<string, string> {
  const key = requireMothershipRuntimeApiKey()
  if (getMothershipRuntimeHeaderMode(targetUrl) === 'strict') {
    return { [MOTHERSHIP_RUNTIME_KEY_HEADER]: key }
  }
  return { [LEGACY_MOTHERSHIP_API_KEY_HEADER]: key }
}

export function createMothershipAdminAuthHeaders(
  targetUrl = env.SIM_AGENT_API_URL
): Record<string, string> {
  if (getMothershipAdminHeaderMode(targetUrl) === 'legacy') {
    return { [LEGACY_MOTHERSHIP_API_KEY_HEADER]: requireMothershipRuntimeApiKey() }
  }
  return { [MOTHERSHIP_ADMIN_KEY_HEADER]: requireMothershipAdminApiKey() }
}

export function assertMothershipServiceSecretTopology(
  options: {
    requireRuntimeKey?: boolean
    requireCallbackKey?: boolean
    requireAdminKey?: boolean
  } = {}
): MothershipSecretTopologyResult {
  const result = validateMothershipSecretTopology({
    simToMothershipApiKey: env.SIM_TO_MOTHERSHIP_API_KEY,
    copilotApiKey: env.COPILOT_API_KEY,
    mothershipToSimCallbackKey: env.MOTHERSHIP_TO_SIM_CALLBACK_KEY,
    mothershipAdminApiKey: env.MOTHERSHIP_ADMIN_API_KEY,
    internalApiSecret: env.INTERNAL_API_SECRET,
    ...options,
  })

  if (!result.valid) {
    throw new Error(`Invalid Mothership service secret topology: ${result.errors.join('; ')}`)
  }

  return result
}

export function checkSimCallbackAuth(headers: Headers): MothershipServiceAuthResult {
  if (
    hasStrictWrongServiceKeyFamily(headers) ||
    (headers.has(SIM_CALLBACK_KEY_HEADER) && headers.has(LEGACY_MOTHERSHIP_API_KEY_HEADER))
  ) {
    return {
      success: false,
      status: 403,
      error: 'Wrong Mothership service key family for callback route',
    }
  }

  if (headers.has(LEGACY_MOTHERSHIP_API_KEY_HEADER)) {
    return {
      success: false,
      status: 403,
      error: 'Wrong Mothership service key family for callback route',
    }
  }

  const expectedCallbackKey = env.MOTHERSHIP_TO_SIM_CALLBACK_KEY?.trim()
  if (!expectedCallbackKey) {
    return { success: false, status: 500, error: 'Mothership callback key not configured' }
  }

  const callbackKey = headers.get(SIM_CALLBACK_KEY_HEADER)
  if (callbackKey) {
    if (safeCompare(callbackKey, expectedCallbackKey)) return { success: true }
    return { success: false, status: 401, error: 'Invalid Mothership callback key' }
  }

  return { success: false, status: 401, error: 'Mothership callback key required' }
}

function hasStrictWrongServiceKeyFamily(headers: Headers): boolean {
  return headers.has(MOTHERSHIP_RUNTIME_KEY_HEADER) || headers.has(MOTHERSHIP_ADMIN_KEY_HEADER)
}
