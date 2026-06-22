import type {
  MothershipJsonResponseMode,
  MothershipResponseMode,
  MothershipRouteContract,
  MothershipSchema,
  MothershipStreamResponseMode,
} from '@sim/mothership-contracts'
import type { z } from 'zod'
import {
  LEGACY_MOTHERSHIP_API_KEY_HEADER,
  MOTHERSHIP_ADMIN_KEY_HEADER,
  MOTHERSHIP_RUNTIME_KEY_HEADER,
  MOTHERSHIP_SOURCE_ENV_HEADER,
  SIM_CALLBACK_KEY_HEADER,
} from './auth'

export type MothershipFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

export interface MothershipClientConfig {
  baseUrl: string
  fetch?: MothershipFetch
  headerMode?: MothershipWireHeaderMode
}

export type MothershipWireHeaderMode = 'contract' | 'legacy-runtime' | 'legacy-admin'

export type AnyMothershipRouteContract = MothershipRouteContract<
  MothershipSchema | undefined,
  MothershipSchema | undefined,
  MothershipSchema | undefined,
  MothershipResponseMode
>

export type MothershipContractQuery<C extends AnyMothershipRouteContract> =
  C extends MothershipRouteContract<
    infer TQuery,
    MothershipSchema | undefined,
    MothershipSchema | undefined
  >
    ? TQuery extends MothershipSchema
      ? z.input<TQuery>
      : never
    : never

export type MothershipContractBody<C extends AnyMothershipRouteContract> =
  C extends MothershipRouteContract<
    MothershipSchema | undefined,
    infer TBody,
    MothershipSchema | undefined
  >
    ? TBody extends MothershipSchema
      ? z.input<TBody>
      : never
    : never

export type MothershipContractHeaders<C extends AnyMothershipRouteContract> =
  C extends MothershipRouteContract<
    MothershipSchema | undefined,
    MothershipSchema | undefined,
    infer THeaders
  >
    ? THeaders extends MothershipSchema
      ? z.input<THeaders>
      : never
    : never

export type MothershipContractResponse<C extends AnyMothershipRouteContract> =
  C extends MothershipRouteContract<
    MothershipSchema | undefined,
    MothershipSchema | undefined,
    MothershipSchema | undefined,
    infer TResponse
  >
    ? TResponse extends MothershipJsonResponseMode<infer TSchema>
      ? z.output<TSchema>
      : TResponse extends MothershipStreamResponseMode
        ? Response
        : undefined
    : never

export interface MothershipRequestInput<C extends AnyMothershipRouteContract> {
  query?: MothershipContractQuery<C>
  body?: MothershipContractBody<C>
  headers?: MothershipContractHeaders<C> & Record<string, string>
  signal?: AbortSignal
}

export class MothershipClientError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'MothershipClientError'
    this.status = status
    this.body = body
  }
}

export async function requestMothership<C extends AnyMothershipRouteContract>(
  contract: C,
  config: MothershipClientConfig,
  input: MothershipRequestInput<C> = {}
): Promise<MothershipContractResponse<C>> {
  const fetchImpl = config.fetch ?? fetch
  const query = parseSchema(contract.query, input.query, 'query')
  const body = parseSchema(contract.body, input.body, 'body')
  const headers = toWireHeaders(
    toStringHeaders(parseSchema(contract.headers, input.headers, 'headers')),
    config.headerMode ?? 'contract'
  )
  const url = buildUrl(config.baseUrl, contract.path, query)
  const init: RequestInit = {
    method: contract.method,
    headers: buildHeaders(headers, body !== undefined),
    signal: input.signal,
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  const response = await fetchImpl(url, init)

  if (!response.ok) {
    throw new MothershipClientError(
      `Mothership request failed with status ${response.status}`,
      response.status,
      await readResponseBody(response)
    )
  }

  if (contract.response.mode === 'stream') {
    return response as MothershipContractResponse<C>
  }

  if (contract.response.mode === 'empty') {
    return undefined as MothershipContractResponse<C>
  }

  const raw = await response.json()
  const parsed = contract.response.schema.safeParse(raw)
  if (!parsed.success) {
    throw new MothershipClientError(
      'Mothership response failed contract validation',
      response.status,
      {
        issues: parsed.error.issues,
      }
    )
  }

  return parsed.data as MothershipContractResponse<C>
}

function parseSchema<S extends MothershipSchema>(
  schema: S | undefined,
  value: unknown,
  label: string
): z.output<S> | undefined {
  if (!schema) return undefined
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new MothershipClientError(`Invalid Mothership request ${label}`, 0, {
      issues: parsed.error.issues,
    })
  }
  return parsed.data as z.output<S>
}

function buildUrl(baseUrl: string, path: string, query: unknown): URL {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const url = new URL(path.replace(/^\//, ''), base)

  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item))
      } else {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url
}

function buildHeaders(headers: Record<string, string>, hasJsonBody: boolean): Headers {
  const result = new Headers(headers)
  if (hasJsonBody && !result.has('content-type')) {
    result.set('content-type', 'application/json')
  }
  return result
}

function toStringHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}

  const headers: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') headers[key] = item
  }
  return headers
}

function toWireHeaders(
  headers: Record<string, string>,
  mode: MothershipWireHeaderMode
): Record<string, string> {
  if (mode === 'contract') {
    if (hasHeader(headers, LEGACY_MOTHERSHIP_API_KEY_HEADER)) {
      throw new MothershipClientError(
        'Contract header mode does not allow legacy x-api-key',
        0,
        null
      )
    }
    return headers
  }

  const wireHeaders = { ...headers }
  const sourceEnv = wireHeaders[MOTHERSHIP_SOURCE_ENV_HEADER]
  const runtimeKey = wireHeaders[MOTHERSHIP_RUNTIME_KEY_HEADER]
  const adminKey = wireHeaders[MOTHERSHIP_ADMIN_KEY_HEADER]

  if (mode === 'legacy-runtime') {
    if (!runtimeKey)
      throw new MothershipClientError('Legacy runtime mode requires runtime headers', 0, null)
    wireHeaders[LEGACY_MOTHERSHIP_API_KEY_HEADER] = runtimeKey
  } else {
    if (!adminKey)
      throw new MothershipClientError('Legacy admin mode requires admin headers', 0, null)
    wireHeaders[LEGACY_MOTHERSHIP_API_KEY_HEADER] = adminKey
  }

  delete wireHeaders[MOTHERSHIP_RUNTIME_KEY_HEADER]
  delete wireHeaders[SIM_CALLBACK_KEY_HEADER]
  delete wireHeaders[MOTHERSHIP_ADMIN_KEY_HEADER]
  if (sourceEnv) wireHeaders[MOTHERSHIP_SOURCE_ENV_HEADER] = sourceEnv
  return wireHeaders
}

function hasHeader(headers: Record<string, string>, headerName: string): boolean {
  const normalized = headerName.toLowerCase()
  return Object.keys(headers).some((key) => key.toLowerCase() === normalized)
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
