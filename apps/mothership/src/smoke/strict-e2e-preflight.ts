import {
  MOTHERSHIP_RUNTIME_KEY_HEADER,
  validateMothershipSecretTopology,
} from '@sim/mothership-contracts'
import postgres from 'postgres'

const BASE_REQUIRED_ENV_KEYS = [
  'DATABASE_URL',
  'SIM_AGENT_API_URL',
  'SIM_BASE_URL',
  'SIM_TO_MOTHERSHIP_API_KEY',
  'MOTHERSHIP_ADMIN_API_KEY',
  'MOTHERSHIP_TO_SIM_CALLBACK_KEY',
] as const

const ANTHROPIC_OPENAI_PROVIDER_ENV_KEYS = [
  'MOTHERSHIP_ANTHROPIC_API_KEY',
  'MOTHERSHIP_OPENAI_API_KEY',
] as const

const CLIPROXY_PROVIDER_ENV_KEYS = ['MOTHERSHIP_CLIPROXY_API_KEY'] as const

const URL_ENV_KEYS = ['SIM_AGENT_API_URL', 'SIM_BASE_URL', 'MOTHERSHIP_CLIPROXY_BASE_URL'] as const
const DEFAULT_CLIPROXYAPI_BASE_URL = 'http://localhost:8317'
const DEFAULT_CLIPROXYAPI_MODEL = 'gpt-5.5'

type BaseRequiredEnvKey = (typeof BASE_REQUIRED_ENV_KEYS)[number]
type ProviderRequiredEnvKey =
  | (typeof ANTHROPIC_OPENAI_PROVIDER_ENV_KEYS)[number]
  | (typeof CLIPROXY_PROVIDER_ENV_KEYS)[number]
type RequiredEnvKey = BaseRequiredEnvKey | ProviderRequiredEnvKey
type UrlEnvKey = (typeof URL_ENV_KEYS)[number]

export type StrictE2EPreflightIssueCode =
  | 'hosted_mothership_target'
  | 'invalid_database_schema'
  | 'invalid_secret_topology'
  | 'invalid_url'
  | 'missing_database_table'
  | 'missing_env'
  | 'network_failed'
  | 'not_ready'

export interface StrictE2EPreflightIssue {
  code: StrictE2EPreflightIssueCode
  key?: string
  message: string
}

export interface StrictE2EPreflightResult {
  status: 'blocked' | 'ready'
  issues: StrictE2EPreflightIssue[]
}

export interface StrictE2EPreflightOptions {
  checkDatabase?: boolean
  checkNetwork?: boolean
  databaseSchemaCheck?: (databaseUrl: string) => Promise<StrictE2EPreflightIssue[]>
  fetch?: typeof fetch
}

function nonBlankEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function safeUrl(env: NodeJS.ProcessEnv, key: UrlEnvKey): URL | StrictE2EPreflightIssue | null {
  const value = nonBlankEnv(env, key)
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        code: 'invalid_url',
        key,
        message: `${key} must be an http(s) URL.`,
      }
    }
    if (url.username || url.password) {
      return {
        code: 'invalid_url',
        key,
        message: `${key} must not include URL credentials.`,
      }
    }
    return url
  } catch {
    return {
      code: 'invalid_url',
      key,
      message: `${key} must be a valid URL.`,
    }
  }
}

function isHostedCopilotUrl(url: URL): boolean {
  return url.hostname === 'copilot.sim.ai' || url.hostname === 'www.copilot.sim.ai'
}

function normalizeProvider(value: string | undefined): string | undefined {
  const provider = value?.toLowerCase()
  return provider === 'cliproxy' ? 'cliproxyapi' : provider
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function selectedCliproxyModel(env: NodeJS.ProcessEnv): string {
  return (
    nonBlankEnv(env, 'MOTHERSHIP_CLIPROXY_MODEL') ??
    nonBlankEnv(env, 'MOTHERSHIP_DEFAULT_MODEL') ??
    DEFAULT_CLIPROXYAPI_MODEL
  )
}

function selectedE2EProvider(env: NodeJS.ProcessEnv): 'anthropic-openai' | 'cliproxyapi' {
  return normalizeProvider(env.MOTHERSHIP_E2E_PROVIDER ?? env.MOTHERSHIP_DEFAULT_PROVIDER) ===
    'cliproxyapi'
    ? 'cliproxyapi'
    : 'anthropic-openai'
}

function requiredEnvKeys(env: NodeJS.ProcessEnv): readonly RequiredEnvKey[] {
  return [
    ...BASE_REQUIRED_ENV_KEYS,
    ...(selectedE2EProvider(env) === 'cliproxyapi'
      ? CLIPROXY_PROVIDER_ENV_KEYS
      : ANTHROPIC_OPENAI_PROVIDER_ENV_KEYS),
  ]
}

function missingEnvIssues(env: NodeJS.ProcessEnv): StrictE2EPreflightIssue[] {
  return requiredEnvKeys(env).flatMap((key): StrictE2EPreflightIssue[] =>
    nonBlankEnv(env, key)
      ? []
      : [
          {
            code: 'missing_env',
            key,
            message: `${key} is required for strict-mode real-key E2E.`,
          },
        ]
  )
}

function topologyIssues(env: NodeJS.ProcessEnv): StrictE2EPreflightIssue[] {
  const topologyKeys = [
    'SIM_TO_MOTHERSHIP_API_KEY',
    'MOTHERSHIP_ADMIN_API_KEY',
    'MOTHERSHIP_TO_SIM_CALLBACK_KEY',
  ] as const satisfies readonly BaseRequiredEnvKey[]

  if (topologyKeys.some((key) => !nonBlankEnv(env, key))) return []

  const result = validateMothershipSecretTopology({
    simToMothershipApiKey: env.SIM_TO_MOTHERSHIP_API_KEY,
    copilotApiKey: env.COPILOT_API_KEY,
    mothershipToSimCallbackKey: env.MOTHERSHIP_TO_SIM_CALLBACK_KEY,
    mothershipAdminApiKey: env.MOTHERSHIP_ADMIN_API_KEY,
    internalApiSecret: env.INTERNAL_API_SECRET,
    requireRuntimeKey: true,
    requireCallbackKey: true,
    requireAdminKey: true,
  })

  if (result.valid) return []

  return result.errors.map((message) => ({
    code: 'invalid_secret_topology',
    message,
  }))
}

function cliproxyApiModelsUrl(env: NodeJS.ProcessEnv): URL | StrictE2EPreflightIssue {
  const configured = safeUrl(env, 'MOTHERSHIP_CLIPROXY_BASE_URL')
  if (configured && !(configured instanceof URL)) return configured

  const baseUrl = (configured ?? new URL(DEFAULT_CLIPROXYAPI_BASE_URL))
    .toString()
    .replace(/\/+$/, '')
  return new URL(baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`)
}

async function checkCliProxyReadiness(
  env: NodeJS.ProcessEnv,
  requestFetch: typeof fetch
): Promise<StrictE2EPreflightIssue[]> {
  const apiKey = nonBlankEnv(env, 'MOTHERSHIP_CLIPROXY_API_KEY')
  if (!apiKey) return []

  const modelsUrl = cliproxyApiModelsUrl(env)
  if (!(modelsUrl instanceof URL)) return [modelsUrl]

  try {
    const response = await requestFetch(modelsUrl, {
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    })
    if (!response.ok) {
      return [
        {
          code: 'not_ready',
          key: 'MOTHERSHIP_CLIPROXY_BASE_URL',
          message: `CliProxyAPI /v1/models returned HTTP ${response.status}.`,
        },
      ]
    }

    const payload = asRecord(await response.json().catch(() => undefined))
    const model = selectedCliproxyModel(env)
    const models = Array.isArray(payload?.data) ? payload.data : []
    const hasModel = models.some((entry) => asRecord(entry)?.id === model)
    if (!hasModel) {
      return [
        {
          code: 'not_ready',
          key: 'MOTHERSHIP_CLIPROXY_MODEL',
          message: `CliProxyAPI /v1/models did not include selected model ${model}.`,
        },
      ]
    }
    return []
  } catch (error) {
    return [
      {
        code: 'network_failed',
        key: 'MOTHERSHIP_CLIPROXY_BASE_URL',
        message: `CliProxyAPI readiness check failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      },
    ]
  }
}

async function checkMothershipReadiness(
  baseUrl: URL,
  runtimeKey: string,
  requestFetch: typeof fetch
): Promise<StrictE2EPreflightIssue[]> {
  const healthUrl = new URL('/health', baseUrl)
  const readyUrl = new URL('/ready', baseUrl)

  try {
    const health = await requestFetch(healthUrl)
    if (!health.ok) {
      return [
        {
          code: 'not_ready',
          key: 'SIM_AGENT_API_URL',
          message: `Mothership /health returned HTTP ${health.status}.`,
        },
      ]
    }

    const ready = await requestFetch(readyUrl, {
      headers: {
        [MOTHERSHIP_RUNTIME_KEY_HEADER]: runtimeKey,
      },
    })
    if (!ready.ok) {
      return [
        {
          code: 'not_ready',
          key: 'SIM_AGENT_API_URL',
          message: `Mothership /ready returned HTTP ${ready.status}.`,
        },
      ]
    }

    return []
  } catch (error) {
    return [
      {
        code: 'network_failed',
        key: 'SIM_AGENT_API_URL',
        message: `Mothership readiness check failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      },
    ]
  }
}

async function checkDatabaseSchema(databaseUrl: string): Promise<StrictE2EPreflightIssue[]> {
  const client = postgres(databaseUrl, { max: 1, connect_timeout: 5, max_lifetime: null })
  try {
    const [row] = await client<
      [
        {
          checkpoints_table: string | null
          events_cursor_text: boolean
          events_envelope_jsonb: boolean
          events_event_type_text: boolean
          events_run_fk: boolean
          events_run_id_uuid: boolean
          events_stream_id_text: boolean
          events_stream_seq_unique: string | null
          events_table: string | null
          events_seq_int: boolean
          checkpoints_resume_seq_int: boolean
          runs_table: string | null
        },
      ]
    >`
      select
        to_regclass('public.copilot_runs')::text as runs_table,
        to_regclass('public.copilot_run_events')::text as events_table,
        to_regclass('public.copilot_run_checkpoints')::text as checkpoints_table,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'copilot_run_events'
            and column_name = 'run_id'
            and udt_name = 'uuid'
        ) as events_run_id_uuid,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'copilot_run_events'
            and column_name = 'stream_id'
            and data_type = 'text'
        ) as events_stream_id_text,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'copilot_run_events'
            and column_name = 'seq'
            and udt_name = 'int4'
        ) as events_seq_int,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'copilot_run_events'
            and column_name = 'cursor'
            and data_type = 'text'
        ) as events_cursor_text,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'copilot_run_events'
            and column_name = 'event_type'
            and data_type = 'text'
        ) as events_event_type_text,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'copilot_run_events'
            and column_name = 'envelope'
            and udt_name = 'jsonb'
        ) as events_envelope_jsonb,
        to_regclass('public.copilot_run_events_stream_seq_unique')::text
          as events_stream_seq_unique,
        exists (
          select 1 from pg_constraint
          where conname = 'copilot_run_events_run_id_copilot_runs_id_fk'
            and contype = 'f'
        ) as events_run_fk,
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'copilot_run_checkpoints'
            and column_name = 'resume_event_start_seq'
            and udt_name = 'int4'
        ) as checkpoints_resume_seq_int
    `
    const missing = [
      ['copilot_runs', row?.runs_table],
      ['copilot_run_events', row?.events_table],
      ['copilot_run_checkpoints', row?.checkpoints_table],
    ]
      .filter(([, table]) => !table)
      .map(([table]) => table)

    if (missing.length > 0) {
      return [
        {
          code: 'missing_database_table',
          key: 'DATABASE_URL',
          message: `Mothership database schema is missing required table(s): ${missing.join(', ')}. Run packages/db migrations against this DATABASE_URL first.`,
        },
      ]
    }

    const invalid = [
      ['copilot_run_events.run_id uuid', row?.events_run_id_uuid],
      ['copilot_run_events.stream_id text', row?.events_stream_id_text],
      ['copilot_run_events.seq integer', row?.events_seq_int],
      ['copilot_run_events.cursor text', row?.events_cursor_text],
      ['copilot_run_events.event_type text', row?.events_event_type_text],
      ['copilot_run_events.envelope jsonb', row?.events_envelope_jsonb],
      ['copilot_run_events_stream_seq_unique', row?.events_stream_seq_unique],
      ['copilot_run_events run_id foreign key', row?.events_run_fk],
      ['copilot_run_checkpoints.resume_event_start_seq integer', row?.checkpoints_resume_seq_int],
    ]
      .filter(([, present]) => !present)
      .map(([name]) => name)

    if (invalid.length === 0) return []

    return [
      {
        code: 'invalid_database_schema',
        key: 'DATABASE_URL',
        message: `Mothership database schema is missing required object(s): ${invalid.join(', ')}. Run packages/db migrations against this DATABASE_URL first.`,
      },
    ]
  } catch (error) {
    return [
      {
        code: 'network_failed',
        key: 'DATABASE_URL',
        message: `Mothership database schema check failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      },
    ]
  } finally {
    await client.end()
  }
}

export async function evaluateStrictE2EPreflight(
  env: NodeJS.ProcessEnv = process.env,
  options: StrictE2EPreflightOptions = {}
): Promise<StrictE2EPreflightResult> {
  const issues: StrictE2EPreflightIssue[] = [...missingEnvIssues(env), ...topologyIssues(env)]

  const simAgentUrl = safeUrl(env, 'SIM_AGENT_API_URL')
  const simBaseUrl = safeUrl(env, 'SIM_BASE_URL')
  const cliproxyBaseUrl = safeUrl(env, 'MOTHERSHIP_CLIPROXY_BASE_URL')

  if (simAgentUrl instanceof URL && isHostedCopilotUrl(simAgentUrl)) {
    issues.push({
      code: 'hosted_mothership_target',
      key: 'SIM_AGENT_API_URL',
      message: 'SIM_AGENT_API_URL must point at the owned Mothership service, not copilot.sim.ai.',
    })
  } else if (simAgentUrl && !(simAgentUrl instanceof URL)) {
    issues.push(simAgentUrl)
  }

  if (simBaseUrl && !(simBaseUrl instanceof URL)) {
    issues.push(simBaseUrl)
  }
  if (cliproxyBaseUrl && !(cliproxyBaseUrl instanceof URL)) {
    issues.push(cliproxyBaseUrl)
  }

  const databaseUrl = nonBlankEnv(env, 'DATABASE_URL')
  if (options.checkDatabase && databaseUrl && issues.length === 0) {
    issues.push(...(await (options.databaseSchemaCheck ?? checkDatabaseSchema)(databaseUrl)))
  }

  const runtimeKey = nonBlankEnv(env, 'SIM_TO_MOTHERSHIP_API_KEY')
  if (options.checkNetwork && simAgentUrl instanceof URL && runtimeKey && issues.length === 0) {
    issues.push(
      ...(await checkMothershipReadiness(simAgentUrl, runtimeKey, options.fetch ?? fetch))
    )
    if (selectedE2EProvider(env) === 'cliproxyapi' && issues.length === 0) {
      issues.push(...(await checkCliProxyReadiness(env, options.fetch ?? fetch)))
    }
  }

  return {
    status: issues.length === 0 ? 'ready' : 'blocked',
    issues,
  }
}

export function formatStrictE2EPreflight(result: StrictE2EPreflightResult): string {
  if (result.status === 'ready') {
    return 'Strict-mode real-key E2E preflight ready.'
  }

  return [
    'Strict-mode real-key E2E preflight blocked:',
    ...result.issues.map((issue) => `- ${issue.key ? `${issue.key}: ` : ''}${issue.message}`),
  ].join('\n')
}

async function main(): Promise<void> {
  const result = await evaluateStrictE2EPreflight(process.env, {
    checkDatabase: true,
    checkNetwork: true,
  })
  const message = formatStrictE2EPreflight(result)

  if (result.status === 'ready') {
    console.log(message)
    return
  }

  console.error(message)
  process.exit(1)
}

if (import.meta.main) {
  await main()
}
