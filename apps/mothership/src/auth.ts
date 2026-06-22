import {
  MOTHERSHIP_ADMIN_KEY_HEADER,
  MOTHERSHIP_RUNTIME_KEY_HEADER,
  MOTHERSHIP_SOURCE_ENV_HEADER,
  type MothershipSourceEnv,
} from '@sim/mothership-contracts'
import { adminHeadersSchema, runtimeHeadersSchema } from '@sim/mothership-contracts/routes'
import { safeCompare } from '@sim/security/compare'
import { sha256Hex } from '@sim/security/hash'
import type { MothershipEnv } from '@/env'
import { jsonResponse } from '@/response'

export type ServiceAuthFamily = 'runtime' | 'admin'

export interface ServiceAuthContext {
  family: ServiceAuthFamily
  fingerprint: string
  sourceEnv?: MothershipSourceEnv
}

export type ServiceAuthResult =
  | { ok: true; context: ServiceAuthContext }
  | { ok: false; response: Response }

function fingerprintSecret(secret: string): string {
  return sha256Hex(secret).slice(0, 12)
}

function getExpectedSecret(env: MothershipEnv, family: ServiceAuthFamily): string | undefined {
  return family === 'runtime' ? env.SIM_TO_MOTHERSHIP_API_KEY : env.MOTHERSHIP_ADMIN_API_KEY
}

function getExpectedHeader(family: ServiceAuthFamily): string {
  return family === 'runtime' ? MOTHERSHIP_RUNTIME_KEY_HEADER : MOTHERSHIP_ADMIN_KEY_HEADER
}

function getHeaderRecord(request: Request): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [key, value] of request.headers.entries()) {
    headers[key.toLowerCase()] = value
  }
  return headers
}

function parseSourceEnv(
  request: Request,
  family: ServiceAuthFamily,
  requestId: string
): MothershipSourceEnv | undefined | Response {
  const headers = getHeaderRecord(request)
  const parsed =
    family === 'runtime'
      ? runtimeHeadersSchema.safeParse(headers)
      : adminHeadersSchema.safeParse(headers)

  if (!parsed.success) {
    return jsonResponse(
      {
        success: false,
        error: 'Invalid Mothership auth headers',
        code: 'invalid_auth_headers',
      },
      { status: 400, requestId }
    )
  }

  return parsed.data[MOTHERSHIP_SOURCE_ENV_HEADER]
}

export function authenticateServiceRequest(
  request: Request,
  family: ServiceAuthFamily,
  env: MothershipEnv,
  requestId: string
): ServiceAuthResult {
  const expectedSecret = getExpectedSecret(env, family)
  if (!expectedSecret) {
    return {
      ok: false,
      response: jsonResponse(
        {
          success: false,
          error: 'Mothership service auth is not configured',
          code: 'service_auth_not_configured',
        },
        { status: 503, requestId }
      ),
    }
  }

  const expectedHeader = getExpectedHeader(family)
  const provided = request.headers.get(expectedHeader)

  if (!provided) {
    return {
      ok: false,
      response: jsonResponse(
        {
          success: false,
          error: `Missing ${expectedHeader}`,
          code: 'missing_service_key',
        },
        { status: 401, requestId }
      ),
    }
  }

  if (!safeCompare(provided, expectedSecret)) {
    return {
      ok: false,
      response: jsonResponse(
        {
          success: false,
          error: 'Unknown Mothership service key',
          code: 'unknown_service_key',
        },
        { status: 401, requestId }
      ),
    }
  }

  const sourceEnv = parseSourceEnv(request, family, requestId)
  if (sourceEnv instanceof Response) {
    return { ok: false, response: sourceEnv }
  }

  return {
    ok: true,
    context: {
      family,
      fingerprint: fingerprintSecret(expectedSecret),
      ...(sourceEnv ? { sourceEnv } : {}),
    },
  }
}
