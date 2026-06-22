import type { Context } from '@opentelemetry/api'
import {
  createMothershipAdminHeaders,
  createMothershipRuntimeHeaders,
  type MothershipContractResponse,
  type MothershipRequestInput,
  requestMothership,
  resolveMothershipRuntimeKey,
} from '@sim/mothership-client'
import type {
  MothershipResponseMode,
  MothershipRouteContract,
  MothershipSchema,
} from '@sim/mothership-contracts'
import type { adminHeadersSchema, runtimeHeadersSchema } from '@sim/mothership-contracts/routes'
import { TraceAttr } from '@/lib/copilot/generated/trace-attributes-v1'
import { fetchGo } from '@/lib/copilot/request/go/fetch'
import { env } from '@/lib/core/config/env'
import { getMothershipRuntimeHeaderMode } from '@/lib/mothership/service-auth'

type RuntimeMothershipRouteContract = MothershipRouteContract<
  MothershipSchema | undefined,
  MothershipSchema | undefined,
  typeof runtimeHeadersSchema,
  MothershipResponseMode
>

type AdminMothershipRouteContract = MothershipRouteContract<
  MothershipSchema | undefined,
  MothershipSchema | undefined,
  typeof adminHeadersSchema,
  MothershipResponseMode
>

export interface RequestMothershipRuntimeOptions<C extends RuntimeMothershipRouteContract> {
  contract: C
  baseUrl: string
  input?: Omit<MothershipRequestInput<C>, 'headers'>
  spanName: string
  operation: string
  userId?: string
  otelContext?: Context
  attributes?: Record<string, string | number | boolean>
}

export interface RequestMothershipAdminOptions<C extends AdminMothershipRouteContract> {
  contract: C
  baseUrl: string
  input?: Omit<MothershipRequestInput<C>, 'headers'>
  spanName: string
  operation: string
  otelContext?: Context
  attributes?: Record<string, string | number | boolean>
}

export async function requestMothershipRuntime<C extends RuntimeMothershipRouteContract>({
  contract,
  baseUrl,
  input,
  spanName,
  operation,
  userId,
  otelContext,
  attributes,
}: RequestMothershipRuntimeOptions<C>): Promise<MothershipContractResponse<C>> {
  const runtime = resolveMothershipRuntimeKey({
    simToMothershipApiKey: env.SIM_TO_MOTHERSHIP_API_KEY,
    copilotApiKey: env.COPILOT_API_KEY,
  })
  if (!runtime.key) {
    throw new Error(
      'SIM_TO_MOTHERSHIP_API_KEY or legacy COPILOT_API_KEY is required for Mothership runtime calls'
    )
  }

  const headers = createMothershipRuntimeHeaders(runtime.key, {
    sourceEnv: env.COPILOT_SOURCE_ENV,
  })
  const headerMode =
    getMothershipRuntimeHeaderMode(baseUrl) === 'strict' ? 'contract' : 'legacy-runtime'

  return requestMothership(
    contract,
    {
      baseUrl,
      headerMode,
      fetch: (url, init) =>
        fetchGo(url.toString(), {
          ...init,
          headers: toHeaderRecord(init?.headers),
          cache: 'no-store',
          otelContext,
          spanName,
          operation,
          attributes: {
            ...(userId ? { [TraceAttr.UserId]: userId } : {}),
            ...(attributes ?? {}),
          },
        }),
    },
    {
      ...input,
      headers: headers as MothershipRequestInput<C>['headers'],
    }
  )
}

export async function requestMothershipAdmin<C extends AdminMothershipRouteContract>({
  contract,
  baseUrl,
  input,
  spanName,
  operation,
  otelContext,
  attributes,
}: RequestMothershipAdminOptions<C>): Promise<MothershipContractResponse<C>> {
  if (!env.MOTHERSHIP_ADMIN_API_KEY) {
    throw new Error('MOTHERSHIP_ADMIN_API_KEY is required for Mothership admin calls')
  }

  const headers = createMothershipAdminHeaders(env.MOTHERSHIP_ADMIN_API_KEY, {
    sourceEnv: env.COPILOT_SOURCE_ENV,
  })

  return requestMothership(
    contract,
    {
      baseUrl,
      headerMode: 'legacy-admin',
      fetch: (url, init) =>
        fetchGo(url.toString(), {
          ...init,
          headers: toHeaderRecord(init?.headers),
          cache: 'no-store',
          otelContext,
          spanName,
          operation,
          attributes: attributes ?? {},
        }),
    },
    {
      ...input,
      headers: headers as MothershipRequestInput<C>['headers'],
    }
  )
}

function toHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  new Headers(headers).forEach((value, key) => {
    result[key] = value
  })
  return result
}
