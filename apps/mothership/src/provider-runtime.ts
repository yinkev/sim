import { createLogger } from '@sim/logger'
import { getMothershipToolCatalogEntry, type MothershipToolMode } from '@sim/mothership-contracts'
import type {
  GenerateChatTitleBody,
  MothershipChatBody,
  ResumeToolsBody,
  WorkflowSubagentExecuteBody,
  WorkflowSubagentExecuteResponse,
} from '@sim/mothership-contracts/routes'
import { getErrorMessage } from '@sim/utils/errors'
import { truncate } from '@sim/utils/string'
import {
  executeWorkflowSubagentCallback,
  reportMothershipBillingUsage,
  validateMothershipByokEntitlement,
} from '@/callbacks'
import type { MothershipEnv } from '@/env'
import {
  calculateAnthropicCost,
  calculateOpenAICost,
  normalizeOpenAIModel,
  type ProviderTokenCost,
  type ProviderTokenUsage,
  resolveOpenAIPricing,
} from '@/pricing-policy'
import { getMothershipByokProviderKey } from '@/state/byok-store'
import {
  createMothershipToolCheckpoint,
  type MothershipResumeCheckpointRecord,
  type MothershipResumeToolCallRecord,
  markMothershipResumeToolResultDelivered,
} from '@/state/resume-store'
import {
  markMothershipRunComplete,
  markMothershipRunFailed,
  markMothershipRunPausedForTool,
} from '@/state/run-store'
import {
  type MothershipStreamEventInput,
  MothershipStreamPersistenceError,
  type MothershipStreamWriter,
} from '@/stream'
import { getOwnedSubagentSpec } from '@/subagents/catalog'

const logger = createLogger('MothershipProviderRuntime')
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8'
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_OPENAI_MODEL = 'gpt-4.1'
const DEFAULT_CLIPROXYAPI_BASE_URL = 'http://localhost:8317'
const DEFAULT_CLIPROXYAPI_MODEL = 'gpt-5.5'
const DEFAULT_CLIPROXYAPI_REASONING_EFFORT = 'high'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TITLE_MAX_COMPLETION_TOKENS = 64
const DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS = 10 * 60 * 1000

type ProviderRuntimeStatus = 'handled' | 'unsupported'
type AnthropicBillingSource = 'copilot' | 'workspace-chat' | 'mothership_block'
type AnthropicCredentialSource = 'hosted' | 'byok'
type ByokProvider = 'anthropic' | 'openai'
type OwnedProvider = 'anthropic' | 'openai' | 'cliproxyapi'

export type OwnedChatTitleResult =
  | { status: 'ok'; title: string }
  | { status: 'missing_credentials'; model: string; provider: OwnedProvider }
  | { status: 'unsupported_provider'; model: string }
  | { status: 'provider_error'; model: string; message: string }

interface RunOwnedProviderContinuationOptions {
  body: MothershipChatBody
  env: MothershipEnv
  model?: string
  provider?: string
  route: string
  runId: string
  signal?: AbortSignal
  writer: MothershipStreamWriter
}

export interface OwnedProviderSelection {
  model: string
  provider?: string
}

type AnthropicMessageContent = string | AnthropicContentBlock[]

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: AnthropicMessageContent
}

interface AnthropicTextBlock {
  type: 'text'
  text: string
}

interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface AnthropicToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock

interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
  eager_input_streaming?: boolean
}

interface AnthropicRequestPayload {
  max_tokens: number
  messages: AnthropicMessage[]
  model: string
  stream: true
  tools?: AnthropicTool[]
}

interface StoredAnthropicProviderRequest {
  assistantContent: AnthropicContentBlock[]
  billing?: AnthropicBillingState
  executionId: string
  model: string
  provider: 'anthropic'
  request: AnthropicRequestPayload
  workflowSubagentContext?: WorkflowSubagentContextBody
}

type AnthropicUsage = ProviderTokenUsage
type AnthropicCost = ProviderTokenCost

interface AnthropicBillingState {
  credentialSource?: AnthropicCredentialSource
  cumulativeUsage: AnthropicUsage
  source: AnthropicBillingSource
  userId: string
  workspaceId: string
}

interface AnthropicStreamState {
  contentBlocks: Map<number, AnthropicContentBlock>
  sawMessageStop: boolean
  stopReason?: string
  toolInputJson: Map<number, string>
  usage: AnthropicUsage
}

interface RunOwnedProviderResumeOptions {
  body: ResumeToolsBody
  checkpoint: MothershipResumeCheckpointRecord
  env: MothershipEnv
  recordedResults: MothershipResumeToolCallRecord[]
  requestResults: ResumeToolsBody['results']
  route: string
  signal?: AbortSignal
  writer: MothershipStreamWriter
}

interface AnthropicRuntimeOptions {
  beforeTerminalStatusUpdate?: () => Promise<void>
  billing: AnthropicBillingState
  chatBody?: WorkflowSubagentContextBody
  env: MothershipEnv
  executionId: string
  route: string
  runId: string
  signal?: AbortSignal
  subagentContinuationDepth?: number
  writer: MothershipStreamWriter
}

interface AnthropicCredentialResolution {
  apiKey: string
  source: AnthropicCredentialSource
}

class MothershipByokCredentialsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MothershipByokCredentialsError'
  }
}

class MothershipProviderRequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Owned Mothership provider request timed out after ${timeoutMs}ms`)
    this.name = 'MothershipProviderRequestTimeoutError'
  }
}

class MothershipProviderRequestAbortedError extends Error {
  constructor() {
    super('Owned Mothership provider request was aborted')
    this.name = 'MothershipProviderRequestAbortedError'
  }
}

type OpenAIOutputItem = Record<string, unknown>
type OpenAIInputItem =
  | OpenAIMessage
  | OpenAIFunctionCallItem
  | OpenAIFunctionCallOutputItem
  | OpenAIOutputItem

interface OpenAIRequestPayload {
  input: OpenAIInputItem[]
  model: string
  stream: true
  tools?: OpenAITool[]
}

interface CliProxyApiRequestPayload {
  max_completion_tokens: number
  messages: OpenAIMessage[]
  model: string
  reasoning_effort: string
  stream: true
  stream_options: {
    include_usage: true
  }
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIFunctionCallItem {
  type: 'function_call'
  call_id: string
  name: string
  arguments: string
}

interface OpenAIFunctionCallOutputItem {
  type: 'function_call_output'
  call_id: string
  output: string
}

interface OpenAITool {
  type: 'function'
  name: string
  description?: string
  parameters: Record<string, unknown>
}

interface StoredOpenAIProviderRequest {
  billing?: OpenAIBillingState
  executionId: string
  model: string
  outputItems: OpenAIOutputItem[]
  provider: 'openai'
  request: OpenAIRequestPayload
  workflowSubagentContext?: WorkflowSubagentContextBody
}

interface OpenAIBillingState {
  credentialSource?: AnthropicCredentialSource
  cumulativeUsage: AnthropicUsage
  source: AnthropicBillingSource
  userId: string
  workspaceId: string
}

interface OpenAIStreamState {
  functionCallArgumentJson: Map<string, string>
  outputIndexKeys: Map<number, string>
  outputItems: OpenAIOutputItem[]
  sawCompleted: boolean
  usage: AnthropicUsage
}

interface CliProxyApiStreamState {
  sawDone: boolean
  sawFinished: boolean
  sawUsage: boolean
  usage: AnthropicUsage
}

interface OpenAIRuntimeOptions {
  beforeTerminalStatusUpdate?: () => Promise<void>
  billing: OpenAIBillingState
  chatBody?: WorkflowSubagentContextBody
  env: MothershipEnv
  executionId: string
  route: string
  runId: string
  signal?: AbortSignal
  subagentContinuationDepth?: number
  writer: MothershipStreamWriter
}

interface ProviderTerminalOptions {
  beforeTerminalStatusUpdate?: () => Promise<void>
  route: string
  runId: string
  writer: MothershipStreamWriter
}

interface PendingProviderToolCall {
  args: Record<string, unknown>
  internal?: boolean
  mode: MothershipToolMode
  route: 'sim' | 'go' | 'client' | 'subagent'
  subagentId?: string
  toolCallId: string
  toolName: string
}

interface SubagentToolResult {
  success: boolean
  status: 'success' | 'error' | 'cancelled'
  output: unknown
  error?: string
  toolCall: PendingProviderToolCall
}

type WorkflowSubagentMessage = WorkflowSubagentExecuteBody['context']['messages'][number]

interface WorkflowSubagentContextBody {
  chatId: string
  message?: string
  messageId: string
  messages?: WorkflowSubagentMessage[]
  userId: string
  workflowId?: string
  workflowName?: string
  workspaceId: string
}

function selectedAnthropicProvider(provider?: string, model?: string): boolean {
  return (
    provider?.toLowerCase() === 'anthropic' || model?.toLowerCase().startsWith('claude') === true
  )
}

function selectedOpenAIProvider(provider?: string, model?: string): boolean {
  const normalizedModel = model ? normalizeOpenAIModel(model).toLowerCase() : undefined
  return (
    provider?.toLowerCase() === 'openai' ||
    normalizedModel?.startsWith('gpt') === true ||
    /^o\d/.test(normalizedModel ?? '')
  )
}

function normalizeProvider(provider?: string): string | undefined {
  const normalized = provider?.toLowerCase()
  return normalized === 'cliproxy' ? 'cliproxyapi' : normalized
}

function selectedCliProxyApiProvider(provider?: string): boolean {
  return normalizeProvider(provider) === 'cliproxyapi'
}

function defaultProvider(env: MothershipEnv): string | undefined {
  return normalizeProvider(env.MOTHERSHIP_DEFAULT_PROVIDER)
}

function cliproxyApiModel(env: MothershipEnv): string {
  return env.MOTHERSHIP_CLIPROXY_MODEL ?? DEFAULT_CLIPROXYAPI_MODEL
}

export function resolveOwnedProviderSelection(options: {
  env: MothershipEnv
  model?: string
  provider?: string
}): OwnedProviderSelection {
  const provider = normalizeProvider(options.provider) ?? defaultProvider(options.env)
  const requestedModel =
    options.model ??
    options.env.MOTHERSHIP_DEFAULT_MODEL ??
    (provider === 'cliproxyapi'
      ? cliproxyApiModel(options.env)
      : provider === 'openai'
        ? DEFAULT_OPENAI_MODEL
        : DEFAULT_ANTHROPIC_MODEL)

  if (selectedCliProxyApiProvider(provider)) {
    return { model: requestedModel, provider: 'cliproxyapi' }
  }

  const openAIModel = normalizeOpenAIModel(requestedModel)
  if (
    provider === 'openai' ||
    (selectedOpenAIProvider(undefined, requestedModel) &&
      Boolean(resolveOpenAIPricing(openAIModel)))
  ) {
    return { model: openAIModel, provider: 'openai' }
  }

  if (selectedAnthropicProvider(provider, requestedModel)) {
    return { model: requestedModel, provider: 'anthropic' }
  }

  return { model: requestedModel, ...(provider ? { provider } : {}) }
}

function cliproxyApiReasoningEffort(env: MothershipEnv): string {
  return env.MOTHERSHIP_CLIPROXY_REASONING_EFFORT ?? DEFAULT_CLIPROXYAPI_REASONING_EFFORT
}

function cliproxyApiMaxCompletionTokens(env: MothershipEnv): number {
  return env.MOTHERSHIP_CLIPROXY_MAX_COMPLETION_TOKENS ?? DEFAULT_MAX_TOKENS
}

function cliproxyApiChatCompletionsUrl(env: MothershipEnv): string {
  const baseUrl = (env.MOTHERSHIP_CLIPROXY_BASE_URL ?? DEFAULT_CLIPROXYAPI_BASE_URL).replace(
    /\/+$/,
    ''
  )
  return baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`
}

function nonBlankString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function toAnthropicRole(role: unknown): AnthropicMessage['role'] | undefined {
  if (role === 'user' || role === 'assistant') return role
  return undefined
}

function textFromContent(content: unknown): string | undefined {
  const direct = nonBlankString(content)
  if (direct) return direct

  if (!Array.isArray(content)) return undefined

  const parts = content
    .map((part) => {
      const record = asRecord(part)
      return record ? nonBlankString(record.text) : undefined
    })
    .filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join('\n') : undefined
}

function buildAnthropicMessages(body: MothershipChatBody): AnthropicMessage[] {
  const fromMessages = Array.isArray(body.messages)
    ? body.messages.flatMap((message) => {
        const role = toAnthropicRole(message.role)
        const content = textFromContent(message.content)
        return role && content ? [{ role, content }] : []
      })
    : []

  if (fromMessages.length > 0) return fromMessages

  const message = nonBlankString(body.message)
  return message ? [{ role: 'user', content: message }] : []
}

function toAnthropicTool(value: unknown): AnthropicTool | undefined {
  const record = asRecord(value)
  const name = nonBlankString(record?.name)
  const inputSchema = asRecord(record?.input_schema)
  if (!name || !inputSchema) return undefined

  const description = nonBlankString(record?.description)
  return {
    name,
    ...(description ? { description } : {}),
    input_schema: inputSchema,
    ...(record?.eager_input_streaming === true ? { eager_input_streaming: true } : {}),
  }
}

function buildAnthropicTools(body: MothershipChatBody): AnthropicTool[] {
  return [...(body.integrationTools ?? []), ...(body.mothershipTools ?? [])].flatMap((tool) => {
    const parsed = toAnthropicTool(tool)
    return parsed ? [parsed] : []
  })
}

function buildAnthropicRequest(body: MothershipChatBody, model: string): AnthropicRequestPayload {
  const messages = buildAnthropicMessages(body)
  if (messages.length === 0) {
    throw new Error('Mothership provider request requires message or messages')
  }

  const tools = buildAnthropicTools(body)
  return {
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    stream: true,
    messages,
    ...(tools.length > 0 ? { tools } : {}),
  }
}

function toOpenAIRole(role: unknown): OpenAIMessage['role'] | undefined {
  if (role === 'system' || role === 'user' || role === 'assistant') return role
  return undefined
}

function buildOpenAIMessages(body: MothershipChatBody): OpenAIMessage[] {
  const fromMessages = Array.isArray(body.messages)
    ? body.messages.flatMap((message) => {
        const role = toOpenAIRole(message.role)
        const content = textFromContent(message.content)
        return role && content ? [{ role, content }] : []
      })
    : []

  if (fromMessages.length > 0) return fromMessages

  const message = nonBlankString(body.message)
  return message ? [{ role: 'user', content: message }] : []
}

function toOpenAITool(value: unknown): OpenAITool | undefined {
  const record = asRecord(value)
  const name = nonBlankString(record?.name)
  const parameters = asRecord(record?.input_schema) ?? asRecord(record?.parameters)
  if (!name || !parameters) return undefined

  const description = nonBlankString(record?.description)
  return {
    type: 'function',
    name,
    ...(description ? { description } : {}),
    parameters,
  }
}

function buildOpenAITools(body: MothershipChatBody): OpenAITool[] {
  return [...(body.integrationTools ?? []), ...(body.mothershipTools ?? [])].flatMap((tool) => {
    const parsed = toOpenAITool(tool)
    return parsed ? [parsed] : []
  })
}

function buildOpenAIRequest(body: MothershipChatBody, model: string): OpenAIRequestPayload {
  const input = buildOpenAIMessages(body)
  if (input.length === 0) {
    throw new Error('Mothership OpenAI request requires message or messages')
  }

  const tools = buildOpenAITools(body)
  return {
    model,
    stream: true,
    input,
    ...(tools.length > 0 ? { tools } : {}),
  }
}

function buildCliProxyApiRequest(
  body: MothershipChatBody,
  env: MothershipEnv,
  model: string
): CliProxyApiRequestPayload {
  const messages = buildOpenAIMessages(body)
  if (messages.length === 0) {
    throw new Error('Mothership CliProxyAPI request requires message or messages')
  }

  if (hasRequestedProviderTools(body)) {
    throw new Error('Mothership CliProxyAPI tool calls are not implemented yet')
  }

  return {
    max_completion_tokens: cliproxyApiMaxCompletionTokens(env),
    model,
    stream: true,
    messages,
    reasoning_effort: cliproxyApiReasoningEffort(env),
    stream_options: {
      include_usage: true,
    },
  }
}

function parseUsage(value: unknown): AnthropicUsage {
  const record = asRecord(value)
  if (!record) return {}

  return {
    ...(typeof record.cached_input_tokens === 'number'
      ? { cached_input_tokens: record.cached_input_tokens }
      : {}),
    ...(typeof record.cache_creation_input_tokens === 'number'
      ? { cache_creation_input_tokens: record.cache_creation_input_tokens }
      : {}),
    ...(typeof record.cache_read_input_tokens === 'number'
      ? { cache_read_input_tokens: record.cache_read_input_tokens }
      : {}),
    ...(typeof record.input_tokens === 'number' ? { input_tokens: record.input_tokens } : {}),
    ...(typeof record.output_tokens === 'number' ? { output_tokens: record.output_tokens } : {}),
  }
}

function hasRequestedProviderTools(body: MothershipChatBody): boolean {
  return (body.integrationTools?.length ?? 0) > 0 || (body.mothershipTools?.length ?? 0) > 0
}

function addUsage(left: AnthropicUsage, right: AnthropicUsage): AnthropicUsage {
  const cachedInputTokens = (left.cached_input_tokens ?? 0) + (right.cached_input_tokens ?? 0)
  const cacheCreationInputTokens =
    (left.cache_creation_input_tokens ?? 0) + (right.cache_creation_input_tokens ?? 0)
  const cacheReadInputTokens =
    (left.cache_read_input_tokens ?? 0) + (right.cache_read_input_tokens ?? 0)
  return {
    ...(left.cached_input_tokens !== undefined || right.cached_input_tokens !== undefined
      ? { cached_input_tokens: cachedInputTokens }
      : {}),
    ...(left.cache_creation_input_tokens !== undefined ||
    right.cache_creation_input_tokens !== undefined
      ? { cache_creation_input_tokens: cacheCreationInputTokens }
      : {}),
    ...(left.cache_read_input_tokens !== undefined || right.cache_read_input_tokens !== undefined
      ? { cache_read_input_tokens: cacheReadInputTokens }
      : {}),
    input_tokens: (left.input_tokens ?? 0) + (right.input_tokens ?? 0),
    output_tokens: (left.output_tokens ?? 0) + (right.output_tokens ?? 0),
  }
}

function billingSourceForRoute(route: string): AnthropicBillingSource {
  if (route === '/api/mothership/execute') return 'mothership_block'
  if (route === '/api/mothership') return 'workspace-chat'
  return 'copilot'
}

function initialBillingState(body: MothershipChatBody, route: string): AnthropicBillingState {
  return {
    userId: body.userId,
    workspaceId: body.workspaceId,
    source: billingSourceForRoute(route),
    cumulativeUsage: {},
  }
}

function fallbackResumeBillingState(body: ResumeToolsBody, route: string): AnthropicBillingState {
  return {
    userId: body.userId,
    workspaceId: nonBlankString(body.workspaceId) ?? '',
    source: billingSourceForRoute(route),
    cumulativeUsage: {},
  }
}

function storedBillingState(value: unknown): AnthropicBillingState | undefined {
  const billing = asRecord(value)
  if (!billing) return undefined

  const source = billing?.source
  const userId = nonBlankString(billing?.userId)
  const workspaceId = nonBlankString(billing?.workspaceId)
  const credentialSource =
    billing?.credentialSource === 'byok' || billing?.credentialSource === 'hosted'
      ? billing.credentialSource
      : undefined
  if (
    (source !== 'copilot' && source !== 'workspace-chat' && source !== 'mothership_block') ||
    !userId ||
    !workspaceId
  ) {
    return undefined
  }

  return {
    source,
    userId,
    workspaceId,
    ...(credentialSource ? { credentialSource } : {}),
    cumulativeUsage: parseUsage(asRecord(billing.cumulativeUsage)),
  }
}

function shouldAttemptInitialAnthropicByok(body: MothershipChatBody, route: string): boolean {
  return body.enterpriseByokEligible === true && route.startsWith('/api/mothership')
}

function shouldAttemptInitialOpenAIByok(body: MothershipChatBody, route: string): boolean {
  return body.enterpriseByokEligible === true && route.startsWith('/api/mothership')
}

function zeroProviderCost(): AnthropicCost {
  return { input: 0, output: 0, total: 0 }
}

function providerRequestTimeoutMs(env: MothershipEnv): number {
  return env.MOTHERSHIP_PROVIDER_REQUEST_TIMEOUT_MS ?? DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS
}

async function withProviderRequestSignal<T>(
  env: MothershipEnv,
  parentSignal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const timeoutMs = providerRequestTimeoutMs(env)
  const controller = new AbortController()
  const abortFromParent = () => {
    controller.abort(new MothershipProviderRequestAbortedError())
  }
  const timeout = setTimeout(() => {
    controller.abort(new MothershipProviderRequestTimeoutError(timeoutMs))
  }, timeoutMs)

  if (parentSignal?.aborted) {
    abortFromParent()
  } else {
    parentSignal?.addEventListener('abort', abortFromParent, { once: true })
  }

  try {
    return await run(controller.signal)
  } catch (error) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason
      if (reason instanceof Error) throw reason
    }
    throw error
  } finally {
    clearTimeout(timeout)
    parentSignal?.removeEventListener('abort', abortFromParent)
  }
}

async function resolveByokCredentials(options: {
  billing: AnthropicBillingState
  env: MothershipEnv
  provider: ByokProvider
  providerLabel: string
  requireByok: boolean
  signal?: AbortSignal
}): Promise<AnthropicCredentialResolution | null> {
  const entitlement = await validateMothershipByokEntitlement({
    env: options.env,
    userId: options.billing.userId,
    workspaceId: options.billing.workspaceId,
    signal: options.signal,
  })

  if (entitlement.status !== 'ok') {
    if (options.requireByok) {
      if (entitlement.status === 'misconfigured') {
        throw new MothershipByokCredentialsError(
          `Mothership BYOK callback is not configured: ${entitlement.missing}`
        )
      }
      if (entitlement.status === 'rejected') {
        throw new MothershipByokCredentialsError(
          `Mothership BYOK callback failed with status ${entitlement.statusCode}`
        )
      }
      throw new MothershipByokCredentialsError('Mothership BYOK callback failed')
    }

    logger.warn('BYOK entitlement callback did not approve; falling back to hosted key', {
      provider: options.provider,
      workspaceId: options.billing.workspaceId,
      userId: options.billing.userId,
      status: entitlement.status,
      ...(entitlement.status === 'rejected' ? { statusCode: entitlement.statusCode } : {}),
    })
    return null
  }

  if (!options.env.ENCRYPTION_KEY) {
    if (options.requireByok) {
      throw new MothershipByokCredentialsError('Mothership BYOK encryption key is not configured')
    }
    logger.warn(
      'BYOK entitlement approved but encryption key is missing; falling back to hosted key',
      {
        provider: options.provider,
        workspaceId: options.billing.workspaceId,
      }
    )
    return null
  }

  let byokKey: Awaited<ReturnType<typeof getMothershipByokProviderKey>>
  try {
    byokKey = await getMothershipByokProviderKey({
      workspaceId: options.billing.workspaceId,
      provider: options.provider,
      encryptionKey: options.env.ENCRYPTION_KEY,
    })
  } catch (error) {
    const message = getErrorMessage(error, 'BYOK key lookup failed')
    if (options.requireByok) {
      throw new MothershipByokCredentialsError(
        `Mothership BYOK ${options.providerLabel} key could not be loaded: ${message}`
      )
    }
    logger.warn(
      'BYOK entitlement approved but provider key could not be loaded; falling back to hosted key',
      {
        provider: options.provider,
        workspaceId: options.billing.workspaceId,
        error: message,
      }
    )
    return null
  }

  if (!byokKey) {
    if (options.requireByok) {
      throw new MothershipByokCredentialsError(
        `Mothership BYOK ${options.providerLabel} key is no longer available`
      )
    }
    return null
  }

  return { source: 'byok', apiKey: byokKey.apiKey }
}

async function resolveAnthropicCredentials(options: {
  billing: AnthropicBillingState
  env: MothershipEnv
  initialByokEligible: boolean
  signal?: AbortSignal
}): Promise<AnthropicCredentialResolution | null> {
  const requireByok = options.billing.credentialSource === 'byok'
  if (options.initialByokEligible || requireByok) {
    const byok = await resolveByokCredentials({
      billing: options.billing,
      env: options.env,
      provider: 'anthropic',
      providerLabel: 'Anthropic',
      requireByok,
      signal: options.signal,
    })
    if (byok) return byok
  }

  return options.env.MOTHERSHIP_ANTHROPIC_API_KEY
    ? { source: 'hosted', apiKey: options.env.MOTHERSHIP_ANTHROPIC_API_KEY }
    : null
}

async function resolveOpenAICredentials(options: {
  billing: OpenAIBillingState
  env: MothershipEnv
  initialByokEligible: boolean
  signal?: AbortSignal
}): Promise<AnthropicCredentialResolution | null> {
  const requireByok = options.billing.credentialSource === 'byok'
  if (options.initialByokEligible || requireByok) {
    const byok = await resolveByokCredentials({
      billing: options.billing,
      env: options.env,
      provider: 'openai',
      providerLabel: 'OpenAI',
      requireByok,
      signal: options.signal,
    })
    if (byok) return byok
  }

  return options.env.MOTHERSHIP_OPENAI_API_KEY
    ? { source: 'hosted', apiKey: options.env.MOTHERSHIP_OPENAI_API_KEY }
    : null
}

function resolveCliProxyApiCredentials(env: MothershipEnv): AnthropicCredentialResolution | null {
  return env.MOTHERSHIP_CLIPROXY_API_KEY
    ? { source: 'hosted', apiKey: env.MOTHERSHIP_CLIPROXY_API_KEY }
    : null
}

function mergeUsage(state: AnthropicStreamState, usage: AnthropicUsage): void {
  if (usage.cached_input_tokens !== undefined) {
    state.usage.cached_input_tokens = usage.cached_input_tokens
  }
  if (usage.cache_creation_input_tokens !== undefined) {
    state.usage.cache_creation_input_tokens = usage.cache_creation_input_tokens
  }
  if (usage.cache_read_input_tokens !== undefined) {
    state.usage.cache_read_input_tokens = usage.cache_read_input_tokens
  }
  if (usage.input_tokens !== undefined) state.usage.input_tokens = usage.input_tokens
  if (usage.output_tokens !== undefined) state.usage.output_tokens = usage.output_tokens
}

function readAnthropicTextDelta(data: unknown): string | undefined {
  const record = asRecord(data)
  const delta = asRecord(record?.delta)
  return typeof delta?.text === 'string' && delta.text.length > 0 ? delta.text : undefined
}

function readAnthropicInputJsonDelta(data: unknown): string | undefined {
  const record = asRecord(data)
  const delta = asRecord(record?.delta)
  if (delta?.type !== 'input_json_delta') return undefined
  return typeof delta.partial_json === 'string' ? delta.partial_json : undefined
}

function readAnthropicContentBlockIndex(data: unknown): number | undefined {
  const record = asRecord(data)
  return typeof record?.index === 'number' && Number.isInteger(record.index)
    ? record.index
    : undefined
}

function readAnthropicStopReason(data: unknown): string | undefined {
  const record = asRecord(data)
  const delta = asRecord(record?.delta)
  return nonBlankString(delta?.stop_reason)
}

function startAnthropicContentBlock(state: AnthropicStreamState, data: unknown): void {
  const record = asRecord(data)
  if (record?.type !== 'content_block_start') return

  const index = readAnthropicContentBlockIndex(record)
  const contentBlock = asRecord(record.content_block)
  if (index === undefined || !contentBlock) return

  if (contentBlock.type === 'text') {
    state.contentBlocks.set(index, {
      type: 'text',
      text: typeof contentBlock.text === 'string' ? contentBlock.text : '',
    })
    return
  }

  if (contentBlock.type === 'tool_use') {
    const id = nonBlankString(contentBlock.id)
    const name = nonBlankString(contentBlock.name)
    if (!id || !name) {
      throw new Error('Anthropic tool_use block is missing id or name')
    }
    state.contentBlocks.set(index, {
      type: 'tool_use',
      id,
      name,
      input: {},
    })
    state.toolInputJson.set(index, '')
  }
}

function appendAnthropicTextDelta(state: AnthropicStreamState, data: unknown, text: string): void {
  const index = readAnthropicContentBlockIndex(data)
  if (index === undefined) return

  const existing = state.contentBlocks.get(index)
  if (existing?.type === 'text') {
    existing.text += text
    return
  }

  state.contentBlocks.set(index, { type: 'text', text })
}

function appendAnthropicInputJsonDelta(state: AnthropicStreamState, data: unknown): void {
  const partialJson = readAnthropicInputJsonDelta(data)
  if (partialJson === undefined) return

  const index = readAnthropicContentBlockIndex(data)
  if (index === undefined) return

  state.toolInputJson.set(index, `${state.toolInputJson.get(index) ?? ''}${partialJson}`)
}

function completeAnthropicContentBlock(state: AnthropicStreamState, data: unknown): void {
  const record = asRecord(data)
  if (record?.type !== 'content_block_stop') return

  const index = readAnthropicContentBlockIndex(record)
  if (index === undefined) return

  const block = state.contentBlocks.get(index)
  if (block?.type !== 'tool_use') return

  const rawInput = state.toolInputJson.get(index) ?? ''
  const parsedInput = rawInput.trim() ? (JSON.parse(rawInput) as unknown) : {}
  const input = asRecord(parsedInput)
  if (!input) {
    throw new Error('Anthropic tool_use input is not an object')
  }
  block.input = input
}

function readAnthropicUsage(data: unknown): AnthropicUsage {
  const record = asRecord(data)
  if (!record) return {}

  const message = asRecord(record.message)
  const messageUsage = parseUsage(message?.usage)
  const usage = parseUsage(record.usage)

  return {
    ...messageUsage,
    ...usage,
  }
}

function readAnthropicErrorMessage(data: unknown): string | undefined {
  const record = asRecord(data)
  if (!record) return undefined

  const error = asRecord(record.error)
  const message = nonBlankString(error?.message)
  if (message) return message

  return record.type === 'error' ? 'Anthropic stream error' : undefined
}

function createCompletePayload(
  model: string,
  usage: AnthropicUsage,
  cost: AnthropicCost
): Record<string, unknown> {
  const inputTokens = usage.input_tokens
  const outputTokens = usage.output_tokens

  return {
    status: 'complete',
    usage: {
      ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
      ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
      ...(inputTokens !== undefined && outputTokens !== undefined
        ? { total_tokens: inputTokens + outputTokens }
        : {}),
      model,
    },
    cost,
  }
}

function buildTitlePrompt(message: string): string {
  return [
    'Create a concise chat title for this user request.',
    'Return only the title, no quotes, no prefix, no punctuation-only answer.',
    'Keep it under 8 words.',
    '',
    message,
  ].join('\n')
}

function readAnthropicJsonText(data: unknown): string | undefined {
  const record = asRecord(data)
  const content = record?.content
  if (!Array.isArray(content)) return undefined

  const text = content
    .map((part) => {
      const item = asRecord(part)
      return item?.type === 'text' ? nonBlankString(item.text) : undefined
    })
    .filter((part): part is string => Boolean(part))
    .join(' ')

  return nonBlankString(text)
}

function readChatCompletionsMessageText(data: unknown): string | undefined {
  const record = asRecord(data)
  const choices = Array.isArray(record?.choices) ? record.choices : []
  for (const choice of choices) {
    const message = asRecord(asRecord(choice)?.message)
    const content = nonBlankString(message?.content)
    if (content) return content
  }
  return undefined
}

function normalizeTitle(text: string): string | undefined {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const unquoted =
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
      ? normalized.slice(1, -1).trim()
      : normalized
  const title = truncate(unquoted, 80, '').trim()
  return title.length > 0 ? title : undefined
}

function createErrorPayload(input: {
  code: string
  message: string
  model: string
  provider: OwnedProvider
  route: string
}): Record<string, unknown> {
  return {
    code: input.code,
    message: input.message,
    displayMessage: input.message,
    provider: input.provider,
    data: {
      route: input.route,
      model: input.model,
    },
  }
}

function splitSseFrames(buffer: string): { frames: string[]; rest: string } {
  const frames: string[] = []
  const boundary = /\r?\n\r?\n/g
  let start = 0
  let match: RegExpExecArray | null

  while ((match = boundary.exec(buffer))) {
    frames.push(buffer.slice(start, match.index))
    start = boundary.lastIndex
  }

  return { frames, rest: buffer.slice(start) }
}

async function markRunCompleteOrThrow(runId: string): Promise<void> {
  const completedRun = await markMothershipRunComplete({ runId })
  if (!completedRun) {
    throw new Error(`Mothership run ${runId} is not completable`)
  }
}

async function markRunFailedOrThrow(runId: string, error: string): Promise<void> {
  const failedRun = await markMothershipRunFailed({ runId, error })
  if (!failedRun) {
    throw new Error(`Mothership run ${runId} is not fail-able`)
  }
}

async function publishAnthropicError(
  options: Pick<
    AnthropicRuntimeOptions,
    'beforeTerminalStatusUpdate' | 'route' | 'runId' | 'writer'
  >,
  code: string,
  message: string,
  model: string
): Promise<void> {
  await options.writer.publish({
    type: 'error',
    payload: createErrorPayload({
      code,
      message,
      provider: 'anthropic',
      route: options.route,
      model,
    }),
    afterPersist: async () => {
      await options.beforeTerminalStatusUpdate?.()
      await markRunFailedOrThrow(options.runId, code)
    },
  })
}

async function publishOpenAIError(
  options: Pick<OpenAIRuntimeOptions, 'beforeTerminalStatusUpdate' | 'route' | 'runId' | 'writer'>,
  code: string,
  message: string,
  model: string
): Promise<void> {
  await options.writer.publish({
    type: 'error',
    payload: createErrorPayload({
      code,
      message,
      provider: 'openai',
      route: options.route,
      model,
    }),
    afterPersist: async () => {
      await options.beforeTerminalStatusUpdate?.()
      await markRunFailedOrThrow(options.runId, code)
    },
  })
}

async function publishCliProxyApiError(
  options: Pick<OpenAIRuntimeOptions, 'beforeTerminalStatusUpdate' | 'route' | 'runId' | 'writer'>,
  code: string,
  message: string,
  model: string
): Promise<void> {
  await options.writer.publish({
    type: 'error',
    payload: createErrorPayload({
      code,
      message,
      provider: 'cliproxyapi',
      route: options.route,
      model,
    }),
    afterPersist: async () => {
      await options.beforeTerminalStatusUpdate?.()
      await markRunFailedOrThrow(options.runId, code)
    },
  })
}

async function processAnthropicSse(
  response: Response,
  writer: MothershipStreamWriter
): Promise<AnthropicStreamState> {
  if (!response.body) {
    throw new Error('Anthropic response body is missing')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const state: AnthropicStreamState = {
    contentBlocks: new Map(),
    sawMessageStop: false,
    toolInputJson: new Map(),
    usage: {},
  }
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const split = splitSseFrames(buffer)
    buffer = split.rest

    for (const frame of split.frames) {
      await processAnthropicSseFrame(frame, state, writer)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    await processAnthropicSseFrame(buffer, state, writer)
  }

  return state
}

async function processAnthropicSseFrame(
  frame: string,
  state: AnthropicStreamState,
  writer: MothershipStreamWriter
): Promise<void> {
  const dataLines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())

  if (dataLines.length === 0) return

  const dataText = dataLines.join('\n')
  if (dataText === '[DONE]') return

  const data = JSON.parse(dataText) as unknown
  const errorMessage = readAnthropicErrorMessage(data)
  if (errorMessage) {
    throw new Error(errorMessage)
  }

  const record = asRecord(data)
  if (record?.type === 'message_stop') {
    state.sawMessageStop = true
    return
  }

  startAnthropicContentBlock(state, data)

  const text = readAnthropicTextDelta(data)
  if (text) {
    appendAnthropicTextDelta(state, data, text)
    await writer.publish({
      type: 'text',
      payload: {
        channel: 'assistant',
        text,
      },
    })
  }

  appendAnthropicInputJsonDelta(state, data)
  completeAnthropicContentBlock(state, data)

  const stopReason = readAnthropicStopReason(data)
  if (stopReason) state.stopReason = stopReason

  mergeUsage(state, readAnthropicUsage(data))
}

async function processOpenAISse(
  response: Response,
  writer: MothershipStreamWriter
): Promise<OpenAIStreamState> {
  if (!response.body) {
    throw new Error('OpenAI response body is missing')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const state: OpenAIStreamState = {
    functionCallArgumentJson: new Map(),
    outputIndexKeys: new Map(),
    outputItems: [],
    sawCompleted: false,
    usage: {},
  }
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const split = splitSseFrames(buffer)
    buffer = split.rest

    for (const frame of split.frames) {
      await processOpenAISseFrame(frame, state, writer)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    await processOpenAISseFrame(buffer, state, writer)
  }

  return state
}

async function processOpenAISseFrame(
  frame: string,
  state: OpenAIStreamState,
  writer: MothershipStreamWriter
): Promise<void> {
  const dataLines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())

  if (dataLines.length === 0) return

  const dataText = dataLines.join('\n')
  if (dataText === '[DONE]') return

  const data = JSON.parse(dataText) as unknown
  const errorMessage = readOpenAIErrorMessage(data)
  if (errorMessage) {
    throw new Error(errorMessage)
  }

  const record = asRecord(data)
  const eventType = nonBlankString(record?.type)
  captureOpenAIArgumentState(state, record)
  captureOpenAIOutputItems(state, record)
  const text = readOpenAITextDelta(record)
  if (text) {
    await writer.publish({
      type: 'text',
      payload: {
        channel: 'assistant',
        text,
      },
    })
  }

  const usage = readOpenAIUsage(record)
  if (usage.cached_input_tokens !== undefined) {
    state.usage.cached_input_tokens = usage.cached_input_tokens
  }
  if (usage.input_tokens !== undefined) state.usage.input_tokens = usage.input_tokens
  if (usage.output_tokens !== undefined) state.usage.output_tokens = usage.output_tokens
  if (eventType === 'response.completed') state.sawCompleted = true
}

async function processCliProxyApiSse(
  response: Response,
  writer: MothershipStreamWriter
): Promise<CliProxyApiStreamState> {
  if (!response.body) {
    throw new Error('CliProxyAPI response body is missing')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const state: CliProxyApiStreamState = {
    sawDone: false,
    sawFinished: false,
    sawUsage: false,
    usage: {},
  }
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const split = splitSseFrames(buffer)
    buffer = split.rest

    for (const frame of split.frames) {
      await processCliProxyApiSseFrame(frame, state, writer)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    await processCliProxyApiSseFrame(buffer, state, writer)
  }

  return state
}

async function processCliProxyApiSseFrame(
  frame: string,
  state: CliProxyApiStreamState,
  writer: MothershipStreamWriter
): Promise<void> {
  const dataLines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())

  if (dataLines.length === 0) return

  const dataText = dataLines.join('\n')
  if (dataText === '[DONE]') {
    state.sawDone = true
    return
  }

  const data = JSON.parse(dataText) as unknown
  const errorMessage = readCliProxyApiErrorMessage(data)
  if (errorMessage) {
    throw new Error(errorMessage)
  }

  const record = asRecord(data)
  const choices = Array.isArray(record?.choices) ? record.choices : []
  for (const choice of choices) {
    const choiceRecord = asRecord(choice)
    const delta = asRecord(choiceRecord?.delta)
    const text = typeof delta?.content === 'string' && delta.content.length > 0 ? delta.content : ''
    if (text) {
      await writer.publish({
        type: 'text',
        payload: {
          channel: 'assistant',
          text,
        },
      })
    }
    if (nonBlankString(choiceRecord?.finish_reason)) {
      state.sawFinished = true
    }
  }

  const usage = readChatCompletionsUsage(record?.usage)
  if (usage.cached_input_tokens !== undefined) {
    state.usage.cached_input_tokens = usage.cached_input_tokens
  }
  if (usage.input_tokens !== undefined) state.usage.input_tokens = usage.input_tokens
  if (usage.output_tokens !== undefined) state.usage.output_tokens = usage.output_tokens
  if (usage.input_tokens !== undefined && usage.output_tokens !== undefined) {
    state.sawUsage = true
  }
}

function readOpenAITextDelta(data: Record<string, unknown> | undefined): string | undefined {
  const eventType = nonBlankString(data?.type)
  if (eventType !== 'response.output_text.delta' && eventType !== 'response.output_json.delta') {
    return undefined
  }

  const delta = data?.delta
  if (typeof delta === 'string') return delta.length > 0 ? delta : undefined
  const deltaRecord = asRecord(delta)
  if (typeof deltaRecord?.text === 'string' && deltaRecord.text.length > 0) {
    return deltaRecord.text
  }
  if (deltaRecord?.json !== undefined) return JSON.stringify(deltaRecord.json)
  if (data?.json !== undefined) return JSON.stringify(data.json)
  return typeof data?.text === 'string' && data.text.length > 0 ? data.text : undefined
}

function readOpenAIUsage(data: Record<string, unknown> | undefined): AnthropicUsage {
  const response = asRecord(data?.response)
  const usage = asRecord(response?.usage) ?? asRecord(data?.usage)
  if (!usage) return {}

  const outputTokenDetails = asRecord(usage.output_tokens_details)
  const reasoningTokens =
    typeof outputTokenDetails?.reasoning_tokens === 'number'
      ? outputTokenDetails.reasoning_tokens
      : undefined
  const outputTokens =
    typeof usage.output_tokens === 'number' && usage.output_tokens > 0
      ? usage.output_tokens
      : reasoningTokens
  const inputTokenDetails = asRecord(usage.input_tokens_details)
  const cachedInputTokens =
    typeof inputTokenDetails?.cached_tokens === 'number'
      ? inputTokenDetails.cached_tokens
      : undefined

  return {
    ...(cachedInputTokens !== undefined ? { cached_input_tokens: cachedInputTokens } : {}),
    ...(typeof usage.input_tokens === 'number' ? { input_tokens: usage.input_tokens } : {}),
    ...(typeof outputTokens === 'number' ? { output_tokens: outputTokens } : {}),
  }
}

function readChatCompletionsUsage(value: unknown): AnthropicUsage {
  const usage = asRecord(value)
  if (!usage) return {}

  const promptTokenDetails = asRecord(usage.prompt_tokens_details)
  const cachedInputTokens =
    typeof promptTokenDetails?.cached_tokens === 'number'
      ? promptTokenDetails.cached_tokens
      : undefined
  const completionTokenDetails = asRecord(usage.completion_tokens_details)
  const reasoningTokens =
    typeof completionTokenDetails?.reasoning_tokens === 'number'
      ? completionTokenDetails.reasoning_tokens
      : undefined
  const outputTokens =
    typeof usage.completion_tokens === 'number' && usage.completion_tokens > 0
      ? usage.completion_tokens
      : reasoningTokens

  return {
    ...(cachedInputTokens !== undefined ? { cached_input_tokens: cachedInputTokens } : {}),
    ...(typeof usage.prompt_tokens === 'number' ? { input_tokens: usage.prompt_tokens } : {}),
    ...(typeof outputTokens === 'number' ? { output_tokens: outputTokens } : {}),
  }
}

function readOpenAIErrorMessage(data: unknown): string | undefined {
  const record = asRecord(data)
  if (!record) return undefined

  const error = asRecord(record.error)
  const message = nonBlankString(error?.message)
  if (message) return message

  const eventType = nonBlankString(record.type)
  return eventType === 'error' || eventType === 'response.error' || eventType === 'response.failed'
    ? 'OpenAI Responses stream error'
    : undefined
}

function readCliProxyApiErrorMessage(data: unknown): string | undefined {
  const record = asRecord(data)
  if (!record) return undefined

  const error = asRecord(record.error)
  const message = nonBlankString(error?.message)
  if (message) return message

  return record.type === 'error' ? 'CliProxyAPI stream error' : undefined
}

function openAIOutputItemsFromValue(value: unknown): OpenAIOutputItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const record = asRecord(item)
    return record ? [record] : []
  })
}

function openAIItemKey(
  record: Record<string, unknown> | undefined,
  item?: Record<string, unknown>
): string | undefined {
  const itemId = nonBlankString(record?.item_id) ?? nonBlankString(item?.id)
  if (itemId) return itemId

  const callId = nonBlankString(record?.call_id) ?? nonBlankString(item?.call_id)
  if (callId) return callId

  const outputIndex =
    typeof record?.output_index === 'number'
      ? record.output_index
      : typeof record?.index === 'number'
        ? record.index
        : undefined
  return outputIndex !== undefined ? `index:${outputIndex}` : undefined
}

function openAIOutputItemMatchesKey(item: OpenAIOutputItem, key: string, index: number): boolean {
  return (
    nonBlankString(item.id) === key ||
    nonBlankString(item.call_id) === key ||
    `index:${index}` === key
  )
}

function readOpenAIOutputIndex(record: Record<string, unknown> | undefined): number | undefined {
  return typeof record?.output_index === 'number'
    ? record.output_index
    : typeof record?.index === 'number'
      ? record.index
      : undefined
}

function openAIStateItemKey(
  state: OpenAIStreamState,
  record: Record<string, unknown> | undefined,
  item?: Record<string, unknown>
): string | undefined {
  const outputIndex = readOpenAIOutputIndex(record)
  if (outputIndex !== undefined) {
    return state.outputIndexKeys.get(outputIndex) ?? openAIItemKey(record, item)
  }
  return openAIItemKey(record, item)
}

function readOpenAIArgumentsDelta(record: Record<string, unknown> | undefined): string | undefined {
  const delta = record?.delta
  if (typeof delta === 'string') return delta
  const deltaRecord = asRecord(delta)
  if (typeof deltaRecord?.arguments === 'string') return deltaRecord.arguments
  return undefined
}

function readOpenAIFullArguments(record: Record<string, unknown> | undefined): string | undefined {
  if (typeof record?.arguments === 'string') return record.arguments
  const item = asRecord(record?.item) ?? asRecord(record?.output_item)
  if (typeof item?.arguments === 'string') return item.arguments
  return undefined
}

function captureOpenAIArgumentState(
  state: OpenAIStreamState,
  record: Record<string, unknown> | undefined
): void {
  const eventType = nonBlankString(record?.type)
  if (
    eventType !== 'response.function_call_arguments.delta' &&
    eventType !== 'response.function_call_arguments.done'
  ) {
    return
  }

  const item = asRecord(record?.item) ?? asRecord(record?.output_item)
  const key = openAIStateItemKey(state, record, item)
  if (!key) return

  if (eventType === 'response.function_call_arguments.delta') {
    const delta = readOpenAIArgumentsDelta(record)
    if (delta !== undefined) {
      state.functionCallArgumentJson.set(
        key,
        `${state.functionCallArgumentJson.get(key) ?? ''}${delta}`
      )
      patchOpenAIOutputItemArguments(state, key)
    }
    return
  }

  const argumentsJson = readOpenAIFullArguments(record)
  if (argumentsJson !== undefined) {
    state.functionCallArgumentJson.set(key, argumentsJson)
    patchOpenAIOutputItemArguments(state, key)
  }
}

function openAIOutputItemWithArguments(
  state: OpenAIStreamState,
  item: OpenAIOutputItem,
  key?: string,
  options?: { preferBuffered?: boolean }
): OpenAIOutputItem {
  if (item.type !== 'function_call') return item
  const argumentsJson = key ? state.functionCallArgumentJson.get(key) : undefined
  if (options?.preferBuffered && argumentsJson !== undefined) {
    return { ...item, arguments: argumentsJson }
  }
  if (typeof item.arguments === 'string' && item.arguments.length > 0) return item
  return argumentsJson !== undefined ? { ...item, arguments: argumentsJson } : item
}

function patchOpenAIOutputItemArguments(state: OpenAIStreamState, key: string): void {
  const existingIndex = state.outputItems.findIndex((existing, index) =>
    openAIOutputItemMatchesKey(existing, key, index)
  )
  if (existingIndex >= 0) {
    state.outputItems[existingIndex] = openAIOutputItemWithArguments(
      state,
      state.outputItems[existingIndex],
      key,
      { preferBuffered: true }
    )
  }
}

function upsertOpenAIOutputItem(
  state: OpenAIStreamState,
  item: OpenAIOutputItem,
  key?: string,
  outputIndex?: number
): void {
  if (key && outputIndex !== undefined) state.outputIndexKeys.set(outputIndex, key)

  const normalizedItem = openAIOutputItemWithArguments(state, item, key)
  if (!key) {
    state.outputItems.push(normalizedItem)
    return
  }

  const existingIndex = state.outputItems.findIndex((existing, index) =>
    openAIOutputItemMatchesKey(existing, key, index)
  )
  if (existingIndex >= 0) {
    state.outputItems[existingIndex] = normalizedItem
    return
  }
  state.outputItems.push(normalizedItem)
}

function outputItemFromOpenAIRecord(
  record: Record<string, unknown> | undefined
): OpenAIOutputItem | undefined {
  const item = asRecord(record?.item) ?? asRecord(record?.output_item)
  if (item) return item

  if (record?.type !== 'response.function_call_arguments.done') return undefined

  const callId = nonBlankString(record.call_id)
  const name = nonBlankString(record.name)
  const argumentsJson = readOpenAIFullArguments(record)
  if (!callId || !name) return undefined
  return {
    type: 'function_call',
    call_id: callId,
    name,
    arguments: argumentsJson ?? '',
  }
}

function captureOpenAIOutputItems(
  state: OpenAIStreamState,
  record: Record<string, unknown> | undefined
): void {
  const eventType = nonBlankString(record?.type)
  if (eventType === 'response.completed') {
    const response = asRecord(record?.response)
    const outputItems = openAIOutputItemsFromValue(response?.output)
    if (outputItems.length > 0) {
      state.outputItems = outputItems.map((item, index) =>
        openAIOutputItemWithArguments(state, item, openAIItemKey({ output_index: index }, item))
      )
      state.outputIndexKeys = new Map(
        outputItems.flatMap((item, index) => {
          const key = openAIItemKey({ output_index: index }, item)
          return key ? [[index, key] as const] : []
        })
      )
    }
    return
  }

  if (
    eventType !== 'response.output_item.added' &&
    eventType !== 'response.output_item.done' &&
    eventType !== 'response.function_call_arguments.done'
  ) {
    return
  }

  const item = outputItemFromOpenAIRecord(record)
  if (!item) return
  upsertOpenAIOutputItem(
    state,
    item,
    openAIStateItemKey(state, record, item),
    readOpenAIOutputIndex(record)
  )
}

function finalizedAnthropicContentBlocks(state: AnthropicStreamState): AnthropicContentBlock[] {
  return [...state.contentBlocks.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, block]) => block)
    .filter((block) => block.type !== 'text' || block.text.length > 0)
}

function pendingAnthropicToolCalls(
  contentBlocks: AnthropicContentBlock[]
): PendingProviderToolCall[] {
  return contentBlocks.flatMap((block) =>
    block.type === 'tool_use'
      ? [
          classifyProviderToolCall({
            args: block.input,
            toolCallId: block.id,
            toolName: block.name,
          }),
        ]
      : []
  )
}

function stringifyOpenAIArguments(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return '{}'
  try {
    return JSON.stringify(value)
  } catch {
    return '{}'
  }
}

function parseOpenAIToolArguments(argumentsJson: string): Record<string, unknown> {
  if (!argumentsJson.trim()) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(argumentsJson) as unknown
  } catch {
    throw new Error('OpenAI function_call arguments must be valid JSON')
  }
  const input = asRecord(parsed)
  if (!input) throw new Error('OpenAI function_call arguments must be a JSON object')
  return input
}

function openAIFunctionCallsFromOutputItem(
  item: OpenAIOutputItem
): Array<{ argumentsJson: string; toolCallId: string; toolName: string }> {
  if (item.type === 'function_call') {
    const toolCallId = nonBlankString(item.call_id) ?? nonBlankString(item.id)
    const functionRecord = asRecord(item.function)
    const toolName = nonBlankString(item.name) ?? nonBlankString(functionRecord?.name)
    if (!toolCallId || !toolName) {
      throw new Error('OpenAI function_call output item is missing call_id or name')
    }

    return [
      {
        toolCallId,
        toolName,
        argumentsJson: stringifyOpenAIArguments(item.arguments),
      },
    ]
  }

  if (item.type !== 'message' || !Array.isArray(item.tool_calls)) return []

  return item.tool_calls.flatMap((toolCall) => {
    const record = asRecord(toolCall)
    if (!record) throw new Error('OpenAI message tool_call item must be an object')

    const functionRecord = asRecord(record?.function)
    const toolCallId = nonBlankString(record?.id)
    const toolName = nonBlankString(functionRecord?.name) ?? nonBlankString(record?.name)
    if (!toolCallId || !toolName) {
      throw new Error('OpenAI message tool_call item is missing id or name')
    }

    return [
      {
        toolCallId,
        toolName,
        argumentsJson: stringifyOpenAIArguments(functionRecord?.arguments),
      },
    ]
  })
}

function pendingOpenAIToolCalls(outputItems: OpenAIOutputItem[]): PendingProviderToolCall[] {
  return outputItems.flatMap((item) =>
    openAIFunctionCallsFromOutputItem(item).map((toolCall) =>
      classifyProviderToolCall({
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        args: parseOpenAIToolArguments(toolCall.argumentsJson),
      })
    )
  )
}

async function markRunPausedForToolOrThrow(runId: string): Promise<void> {
  const pausedRun = await markMothershipRunPausedForTool({ runId })
  if (!pausedRun) {
    throw new Error(`Mothership run ${runId} is not pausable`)
  }
}

function classifyProviderToolCall(input: {
  args: Record<string, unknown>
  toolCallId: string
  toolName: string
}): PendingProviderToolCall {
  const entry = getMothershipToolCatalogEntry(input.toolName)
  return {
    ...input,
    route: entry?.route ?? 'sim',
    mode: entry?.mode ?? 'async',
    ...(entry?.subagentId ? { subagentId: entry.subagentId } : {}),
    ...(entry?.internal === true ? { internal: true } : {}),
  }
}

function checkpointToolCalls(toolCalls: PendingProviderToolCall[]): Array<{
  args: Record<string, unknown>
  toolCallId: string
  toolName: string
}> {
  return toolCalls.map((toolCall) => ({
    args: toolCall.args,
    toolCallId: toolCall.toolCallId,
    toolName: toolCall.toolName,
  }))
}

function subagentToolCalls(toolCalls: PendingProviderToolCall[]): PendingProviderToolCall[] {
  return toolCalls.filter((toolCall) => toolCall.route === 'subagent')
}

function hasMixedSubagentToolCalls(toolCalls: PendingProviderToolCall[]): boolean {
  const subagentCount = subagentToolCalls(toolCalls).length
  return subagentCount > 0 && subagentCount < toolCalls.length
}

function getWorkflowIdForSubagent(
  body: WorkflowSubagentContextBody,
  toolCall: PendingProviderToolCall
) {
  return nonBlankString(toolCall.args.workflowId) ?? nonBlankString(body.workflowId)
}

function workflowSubagentMessageFromValue(value: unknown): WorkflowSubagentMessage | undefined {
  const record = asRecord(value)
  const role = record?.role
  const content = typeof record?.content === 'string' ? record.content : undefined
  return (role === 'system' || role === 'user' || role === 'assistant') && content
    ? { role, content }
    : undefined
}

function workflowSubagentMessages(body: WorkflowSubagentContextBody): WorkflowSubagentMessage[] {
  const messages = Array.isArray(body.messages)
    ? body.messages.flatMap((message) => {
        const parsed = workflowSubagentMessageFromValue(message)
        return parsed ? [parsed] : []
      })
    : []

  if (messages.length > 0) return messages

  return [
    {
      role: 'user' as const,
      content: body.message ?? '',
    },
  ]
}

function workflowSubagentResources(
  body: WorkflowSubagentContextBody,
  toolCall: PendingProviderToolCall
) {
  const workflowId = getWorkflowIdForSubagent(body, toolCall)
  if (!workflowId) return []

  return [
    {
      type: 'workflow' as const,
      id: workflowId,
      ...(body.workflowName ? { title: body.workflowName } : {}),
    },
  ]
}

function workflowSubagentContextFromBody(
  body: WorkflowSubagentContextBody
): WorkflowSubagentContextBody | undefined {
  const message = nonBlankString(body.message)
  const messages = Array.isArray(body.messages)
    ? body.messages.flatMap((item) => {
        const parsed = workflowSubagentMessageFromValue(item)
        return parsed ? [parsed] : []
      })
    : []
  if (!message && messages.length === 0) return undefined

  return {
    chatId: body.chatId,
    messageId: body.messageId,
    userId: body.userId,
    workspaceId: body.workspaceId,
    ...(messages.length > 0 ? { messages } : {}),
    ...(messages.length === 0 && message ? { message } : {}),
    ...(nonBlankString(body.workflowId) ? { workflowId: nonBlankString(body.workflowId) } : {}),
    ...(nonBlankString(body.workflowName)
      ? { workflowName: nonBlankString(body.workflowName) }
      : {}),
  }
}

function storedWorkflowSubagentContext(value: unknown): WorkflowSubagentContextBody | undefined {
  const record = asRecord(value)
  if (!record) return undefined

  const chatId = nonBlankString(record.chatId)
  const messageId = nonBlankString(record.messageId)
  const userId = nonBlankString(record.userId)
  const workspaceId = nonBlankString(record.workspaceId)
  const message = nonBlankString(record.message)
  const messages = Array.isArray(record.messages)
    ? record.messages.flatMap((item) => {
        const parsed = workflowSubagentMessageFromValue(item)
        return parsed ? [parsed] : []
      })
    : []

  if (!chatId || !messageId || !userId || !workspaceId || (!message && messages.length === 0)) {
    return undefined
  }

  return {
    chatId,
    messageId,
    userId,
    workspaceId,
    ...(messages.length > 0 ? { messages } : {}),
    ...(messages.length === 0 && message ? { message } : {}),
    ...(nonBlankString(record.workflowId) ? { workflowId: nonBlankString(record.workflowId) } : {}),
    ...(nonBlankString(record.workflowName)
      ? { workflowName: nonBlankString(record.workflowName) }
      : {}),
  }
}

function buildWorkflowSubagentRequest(input: {
  body: WorkflowSubagentContextBody
  model: string
  provider: 'anthropic' | 'openai'
  runId: string
  toolCall: PendingProviderToolCall
}): WorkflowSubagentExecuteBody {
  const spec = getOwnedSubagentSpec(input.toolCall.toolName)
  if (!spec || spec.id !== 'workflow') {
    throw new Error(`Owned Mothership subagent ${input.toolCall.toolName} is not specified`)
  }

  const prompt = nonBlankString(input.toolCall.args.prompt)
  const workflowId = getWorkflowIdForSubagent(input.body, input.toolCall)

  return {
    runId: input.runId,
    streamId: input.body.messageId,
    chatId: input.body.chatId,
    userId: input.body.userId,
    workspaceId: input.body.workspaceId,
    parentToolCallId: input.toolCall.toolCallId,
    model: input.model,
    provider: input.provider,
    depth: 0,
    input: {
      ...(prompt ? { prompt } : {}),
      ...(workflowId ? { workflowId } : {}),
    },
    context: {
      messages: workflowSubagentMessages(input.body),
      resources: workflowSubagentResources(input.body, input.toolCall),
      ...(workflowId ? { workflowId } : {}),
    },
    limits: {
      maxDepth: spec.maxDepth,
      maxProviderRounds: spec.maxProviderRounds,
      maxChildToolCalls: spec.maxChildToolCalls,
    },
  }
}

function subagentScopeFromEvent(
  event: unknown,
  toolCall: PendingProviderToolCall
): MothershipStreamEventInput['scope'] {
  const scope = asRecord(asRecord(event)?.scope)
  if (scope?.lane === 'subagent') {
    return {
      lane: 'subagent',
      agentId: nonBlankString(scope.agentId) ?? toolCall.subagentId ?? toolCall.toolName,
      parentToolCallId: nonBlankString(scope.parentToolCallId) ?? toolCall.toolCallId,
      ...(nonBlankString(scope.spanId) ? { spanId: nonBlankString(scope.spanId) } : {}),
      ...(nonBlankString(scope.parentSpanId)
        ? { parentSpanId: nonBlankString(scope.parentSpanId) }
        : {}),
    }
  }

  return {
    lane: 'subagent',
    agentId: toolCall.subagentId ?? toolCall.toolName,
    parentToolCallId: toolCall.toolCallId,
  }
}

async function publishWorkflowSubagentEvents(
  writer: MothershipStreamWriter,
  toolCall: PendingProviderToolCall,
  streamEvents: WorkflowSubagentExecuteResponse['streamEvents']
): Promise<void> {
  for (const event of streamEvents) {
    await writer.publish({
      type: event.type,
      payload: event.payload,
      scope: subagentScopeFromEvent(event, toolCall),
    })
  }
}

function workflowSubagentOutput(response: WorkflowSubagentExecuteResponse): unknown {
  if (response.success) return response.result
  return {
    status: 'failed',
    code: response.code,
    error: response.error,
    retryable: response.retryable,
  }
}

function workflowSubagentToolResult(
  toolCall: PendingProviderToolCall,
  response: WorkflowSubagentExecuteResponse
): SubagentToolResult {
  const output = workflowSubagentOutput(response)
  if (!response.success) {
    return {
      toolCall,
      success: false,
      status: 'error',
      output,
      error: response.error,
    }
  }

  if (response.result.status === 'completed') {
    return {
      toolCall,
      success: true,
      status: 'success',
      output,
    }
  }

  return {
    toolCall,
    success: false,
    status: response.result.status === 'cancelled' ? 'cancelled' : 'error',
    output,
    error:
      response.result.status === 'cancelled'
        ? response.result.summary
        : `${response.result.reason}: ${response.result.prompt}`,
  }
}

async function publishSubagentToolCall(
  writer: MothershipStreamWriter,
  toolCall: PendingProviderToolCall
): Promise<void> {
  await writer.publish({
    type: 'tool',
    payload: {
      phase: 'call',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      executor: 'go',
      mode: toolCall.mode,
      arguments: toolCall.args,
      status: 'executing',
      ...(toolCall.internal ? { ui: { internal: true } } : {}),
    },
  })
}

async function publishSubagentToolResult(
  writer: MothershipStreamWriter,
  result: SubagentToolResult
): Promise<void> {
  await writer.publish({
    type: 'tool',
    payload: {
      phase: 'result',
      toolCallId: result.toolCall.toolCallId,
      toolName: result.toolCall.toolName,
      executor: 'go',
      mode: result.toolCall.mode,
      success: result.success,
      status: result.status,
      output: result.output,
      ...(result.error ? { error: result.error } : {}),
    },
  })
}

function stringifySubagentToolResult(result: SubagentToolResult): string {
  try {
    return JSON.stringify(result.output)
  } catch {
    return result.error ?? String(result.output)
  }
}

function subagentResultsToAnthropicToolResults(
  results: SubagentToolResult[]
): AnthropicToolResultBlock[] {
  return results.map((result) => ({
    type: 'tool_result',
    tool_use_id: result.toolCall.toolCallId,
    content: stringifySubagentToolResult(result),
    ...(result.success ? {} : { is_error: true }),
  }))
}

function subagentResultsToOpenAIToolResults(
  results: SubagentToolResult[]
): OpenAIFunctionCallOutputItem[] {
  return results.map((result) => ({
    type: 'function_call_output',
    call_id: result.toolCall.toolCallId,
    output: stringifySubagentToolResult(result),
  }))
}

function buildAnthropicSubagentContinuationRequest(
  request: AnthropicRequestPayload,
  assistantContent: AnthropicContentBlock[],
  subagentResults: SubagentToolResult[]
): AnthropicRequestPayload {
  return {
    ...request,
    messages: [
      ...request.messages,
      {
        role: 'assistant',
        content: assistantContent,
      },
      {
        role: 'user',
        content: subagentResultsToAnthropicToolResults(subagentResults),
      },
    ],
  }
}

function buildOpenAISubagentContinuationRequest(
  request: OpenAIRequestPayload,
  outputItems: OpenAIOutputItem[],
  subagentResults: SubagentToolResult[]
): OpenAIRequestPayload {
  return {
    ...request,
    input: [
      ...request.input,
      ...outputItems,
      ...subagentResultsToOpenAIToolResults(subagentResults),
    ],
  }
}

async function executeWorkflowSubagentToolCalls(input: {
  body: WorkflowSubagentContextBody
  env: MothershipEnv
  model: string
  provider: 'anthropic' | 'openai'
  runId: string
  toolCalls: PendingProviderToolCall[]
  writer: MothershipStreamWriter
}): Promise<SubagentToolResult[]> {
  const results: SubagentToolResult[] = []
  for (const toolCall of subagentToolCalls(input.toolCalls)) {
    await publishSubagentToolCall(input.writer, toolCall)
    const callback = await executeWorkflowSubagentCallback({
      env: input.env,
      request: buildWorkflowSubagentRequest({
        body: input.body,
        model: input.model,
        provider: input.provider,
        runId: input.runId,
        toolCall,
      }),
    })

    if (callback.status === 'misconfigured') {
      throw new Error(`Workflow subagent callback is not configured: ${callback.missing}`)
    }
    if (callback.status === 'rejected') {
      throw new Error(`Workflow subagent callback failed with status ${callback.statusCode}`)
    }
    if (callback.status === 'callback_error') {
      throw new Error('Workflow subagent callback failed')
    }

    await publishWorkflowSubagentEvents(input.writer, toolCall, callback.response.streamEvents)
    const result = workflowSubagentToolResult(toolCall, callback.response)
    await publishSubagentToolResult(input.writer, result)
    results.push(result)
  }

  return results
}

async function publishUnsupportedSubagentToolCalls(
  options: ProviderTerminalOptions,
  provider: 'anthropic' | 'openai',
  model: string,
  toolCalls: PendingProviderToolCall[]
): Promise<void> {
  const unsupportedToolCalls = subagentToolCalls(toolCalls)
  if (unsupportedToolCalls.length === 0) return

  for (const toolCall of unsupportedToolCalls) {
    await options.writer.publish({
      type: 'tool',
      payload: {
        phase: 'call',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        executor: 'go',
        mode: toolCall.mode,
        arguments: toolCall.args,
        status: 'executing',
        ...(toolCall.internal ? { ui: { internal: true } } : {}),
      },
    })
  }

  const toolNames = unsupportedToolCalls.map((toolCall) => toolCall.toolName).join(', ')
  await options.writer.publish({
    type: 'error',
    payload: createErrorPayload({
      code: 'owned_subagent_continuation_not_implemented',
      message: `Owned Mothership subagent continuation is not implemented yet for ${toolNames}.`,
      provider,
      route: options.route,
      model,
    }),
    afterPersist: async () => {
      await options.beforeTerminalStatusUpdate?.()
      await markRunFailedOrThrow(options.runId, 'owned_subagent_continuation_not_implemented')
    },
  })
}

async function publishAnthropicToolCheckpoint(
  options: AnthropicRuntimeOptions,
  model: string,
  request: AnthropicRequestPayload,
  state: AnthropicStreamState,
  billing: AnthropicBillingState,
  apiKey: string
): Promise<void> {
  const assistantContent = finalizedAnthropicContentBlocks(state)
  const pendingToolCalls = pendingAnthropicToolCalls(assistantContent)
  if (pendingToolCalls.length === 0) {
    throw new Error('Anthropic stopped for tool_use without tool_use content blocks')
  }
  if (subagentToolCalls(pendingToolCalls).length > 0) {
    if (hasMixedSubagentToolCalls(pendingToolCalls)) {
      await publishAnthropicError(
        options,
        'owned_subagent_mixed_tool_calls_not_supported',
        'Owned Mothership subagent continuation does not support mixed Sim and subagent tool calls yet.',
        model
      )
      return
    }
    if (!options.chatBody) {
      await publishUnsupportedSubagentToolCalls(options, 'anthropic', model, pendingToolCalls)
      return
    }
    const spec = getOwnedSubagentSpec(pendingToolCalls[0].toolName)
    if ((options.subagentContinuationDepth ?? 0) >= (spec?.maxProviderRounds ?? 1)) {
      await publishAnthropicError(
        options,
        'owned_subagent_continuation_limit_exceeded',
        'Owned Mothership subagent continuation exceeded the workflow subagent round limit.',
        model
      )
      return
    }
    const subagentResults = await executeWorkflowSubagentToolCalls({
      body: options.chatBody,
      env: options.env,
      model,
      provider: 'anthropic',
      runId: options.runId,
      toolCalls: pendingToolCalls,
      writer: options.writer,
    })
    await completeAnthropicRequest(
      {
        ...options,
        billing,
        subagentContinuationDepth: (options.subagentContinuationDepth ?? 0) + 1,
      },
      model,
      buildAnthropicSubagentContinuationRequest(request, assistantContent, subagentResults),
      apiKey
    )
    return
  }

  const workflowSubagentContext = options.chatBody
    ? workflowSubagentContextFromBody(options.chatBody)
    : undefined
  const checkpoint = await createMothershipToolCheckpoint({
    runId: options.runId,
    pendingToolCalls: checkpointToolCalls(pendingToolCalls),
    conversationSnapshot: {
      messages: request.messages,
      assistantContent,
    },
    agentState: {
      provider: 'anthropic',
      stopReason: 'tool_use',
    },
    providerRequest: {
      provider: 'anthropic',
      model,
      executionId: options.executionId,
      request,
      assistantContent,
      billing,
      ...(workflowSubagentContext ? { workflowSubagentContext } : {}),
    } satisfies StoredAnthropicProviderRequest,
  })

  if (checkpoint.status !== 'ready') {
    throw new Error(`Mothership run ${options.runId} is not checkpointable`)
  }

  for (const toolCall of pendingToolCalls) {
    await options.writer.publish({
      type: 'tool',
      payload: {
        phase: 'call',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        executor: 'sim',
        mode: 'async',
        arguments: toolCall.args,
        status: 'executing',
      },
    })
  }

  await options.writer.publish({
    type: 'run',
    payload: {
      kind: 'checkpoint_pause',
      checkpointId: checkpoint.checkpointId,
      executionId: options.executionId,
      runId: options.runId,
      pendingToolCallIds: checkpoint.pendingToolCallIds,
    },
    afterPersist: async () => {
      await options.beforeTerminalStatusUpdate?.()
      await markRunPausedForToolOrThrow(options.runId)
    },
  })
}

async function publishOpenAIToolCheckpoint(
  options: OpenAIRuntimeOptions,
  model: string,
  request: OpenAIRequestPayload,
  state: OpenAIStreamState,
  billing: OpenAIBillingState,
  apiKey: string
): Promise<void> {
  const outputItems = state.outputItems
  const pendingToolCalls = pendingOpenAIToolCalls(outputItems)
  if (pendingToolCalls.length === 0) {
    throw new Error('OpenAI completed with no function_call output items')
  }
  if (subagentToolCalls(pendingToolCalls).length > 0) {
    if (hasMixedSubagentToolCalls(pendingToolCalls)) {
      await publishOpenAIError(
        options,
        'owned_subagent_mixed_tool_calls_not_supported',
        'Owned Mothership subagent continuation does not support mixed Sim and subagent tool calls yet.',
        model
      )
      return
    }
    if (!options.chatBody) {
      await publishUnsupportedSubagentToolCalls(options, 'openai', model, pendingToolCalls)
      return
    }
    const spec = getOwnedSubagentSpec(pendingToolCalls[0].toolName)
    if ((options.subagentContinuationDepth ?? 0) >= (spec?.maxProviderRounds ?? 1)) {
      await publishOpenAIError(
        options,
        'owned_subagent_continuation_limit_exceeded',
        'Owned Mothership subagent continuation exceeded the workflow subagent round limit.',
        model
      )
      return
    }
    const subagentResults = await executeWorkflowSubagentToolCalls({
      body: options.chatBody,
      env: options.env,
      model,
      provider: 'openai',
      runId: options.runId,
      toolCalls: pendingToolCalls,
      writer: options.writer,
    })
    await completeOpenAIRequest(
      {
        ...options,
        billing,
        subagentContinuationDepth: (options.subagentContinuationDepth ?? 0) + 1,
      },
      model,
      buildOpenAISubagentContinuationRequest(request, outputItems, subagentResults),
      apiKey
    )
    return
  }

  const workflowSubagentContext = options.chatBody
    ? workflowSubagentContextFromBody(options.chatBody)
    : undefined
  const checkpoint = await createMothershipToolCheckpoint({
    runId: options.runId,
    pendingToolCalls: checkpointToolCalls(pendingToolCalls),
    conversationSnapshot: {
      input: request.input,
      outputItems,
    },
    agentState: {
      provider: 'openai',
      stopReason: 'tool_call',
    },
    providerRequest: {
      provider: 'openai',
      model,
      executionId: options.executionId,
      request,
      outputItems,
      billing,
      ...(workflowSubagentContext ? { workflowSubagentContext } : {}),
    } satisfies StoredOpenAIProviderRequest,
  })

  if (checkpoint.status !== 'ready') {
    throw new Error(`Mothership run ${options.runId} is not checkpointable`)
  }

  for (const toolCall of pendingToolCalls) {
    await options.writer.publish({
      type: 'tool',
      payload: {
        phase: 'call',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        executor: 'sim',
        mode: 'async',
        arguments: toolCall.args,
        status: 'executing',
      },
    })
  }

  await options.writer.publish({
    type: 'run',
    payload: {
      kind: 'checkpoint_pause',
      checkpointId: checkpoint.checkpointId,
      executionId: options.executionId,
      runId: options.runId,
      pendingToolCallIds: checkpoint.pendingToolCallIds,
    },
    afterPersist: async () => {
      await options.beforeTerminalStatusUpdate?.()
      await markRunPausedForToolOrThrow(options.runId)
    },
  })
}

function stringifyAnthropicToolResult(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function storedAnthropicProviderRequest(
  value: unknown
): StoredAnthropicProviderRequest | undefined {
  const record = asRecord(value)
  const request = asRecord(record?.request)
  if (record?.provider !== 'anthropic' || !request) return undefined
  const workflowSubagentContext =
    record.workflowSubagentContext === undefined
      ? undefined
      : storedWorkflowSubagentContext(record.workflowSubagentContext)
  if (record.workflowSubagentContext !== undefined && !workflowSubagentContext) return undefined

  const model = nonBlankString(record.model)
  const executionId = nonBlankString(record.executionId)
  const requestModel = nonBlankString(request.model)
  const messages = request.messages
  if (
    !model ||
    !executionId ||
    !requestModel ||
    !Array.isArray(messages) ||
    request.stream !== true
  ) {
    return undefined
  }

  const maxTokens = typeof request.max_tokens === 'number' ? request.max_tokens : DEFAULT_MAX_TOKENS
  const tools = Array.isArray(request.tools)
    ? request.tools.flatMap((tool) => {
        const parsed = toAnthropicTool(tool)
        return parsed ? [parsed] : []
      })
    : []
  const assistantContent = Array.isArray(record.assistantContent)
    ? (record.assistantContent as AnthropicContentBlock[])
    : undefined
  if (!assistantContent) return undefined

  return {
    provider: 'anthropic',
    model,
    executionId,
    request: {
      model: requestModel,
      max_tokens: maxTokens,
      stream: true,
      messages: messages as AnthropicMessage[],
      ...(tools.length > 0 ? { tools } : {}),
    },
    assistantContent,
    billing: storedBillingState(record.billing),
    ...(workflowSubagentContext ? { workflowSubagentContext } : {}),
  }
}

function storedOpenAIBillingState(value: unknown): OpenAIBillingState | undefined {
  const billing = storedBillingState(value)
  if (!billing) return undefined

  return {
    source: billing.source,
    userId: billing.userId,
    workspaceId: billing.workspaceId,
    ...(billing.credentialSource ? { credentialSource: billing.credentialSource } : {}),
    cumulativeUsage: billing.cumulativeUsage,
  }
}

function storedOpenAIInputItems(value: unknown): OpenAIInputItem[] | undefined {
  if (!Array.isArray(value)) return undefined

  const items = value.flatMap((item) => {
    const record = asRecord(item)
    return record ? [record as OpenAIInputItem] : []
  })
  return items.length > 0 && items.length === value.length ? items : undefined
}

function storedOpenAIOutputItems(value: unknown): OpenAIOutputItem[] | undefined {
  const outputItems = openAIOutputItemsFromValue(value)
  return Array.isArray(value) && outputItems.length === value.length ? outputItems : undefined
}

function storedOpenAIProviderRequest(value: unknown): StoredOpenAIProviderRequest | undefined {
  const record = asRecord(value)
  const request = asRecord(record?.request)
  if (record?.provider !== 'openai' || !request) return undefined
  const workflowSubagentContext =
    record.workflowSubagentContext === undefined
      ? undefined
      : storedWorkflowSubagentContext(record.workflowSubagentContext)
  if (record.workflowSubagentContext !== undefined && !workflowSubagentContext) return undefined

  const model = nonBlankString(record.model)
  const executionId = nonBlankString(record.executionId)
  const requestModel = nonBlankString(request.model)
  const input = storedOpenAIInputItems(request.input)
  const outputItems = storedOpenAIOutputItems(record.outputItems)
  let toolCalls: ReturnType<typeof pendingOpenAIToolCalls> = []
  try {
    toolCalls = outputItems ? pendingOpenAIToolCalls(outputItems) : []
  } catch {
    return undefined
  }
  const normalizedModel = model ? normalizeOpenAIModel(model) : undefined
  const normalizedRequestModel = requestModel ? normalizeOpenAIModel(requestModel) : undefined
  if (
    !normalizedModel ||
    !executionId ||
    !normalizedRequestModel ||
    normalizedModel !== normalizedRequestModel ||
    !resolveOpenAIPricing(normalizedModel) ||
    !input ||
    !outputItems ||
    toolCalls.length === 0 ||
    request.stream !== true
  ) {
    return undefined
  }

  const tools = Array.isArray(request.tools)
    ? request.tools.flatMap((tool) => {
        const parsed = toOpenAITool(tool)
        return parsed ? [parsed] : []
      })
    : []
  const toolNames = new Set(tools.map((tool) => tool.name))
  if (tools.length === 0 || toolCalls.some((toolCall) => !toolNames.has(toolCall.toolName))) {
    return undefined
  }

  return {
    provider: 'openai',
    model: normalizedModel,
    executionId,
    request: {
      model: normalizedRequestModel,
      stream: true,
      input,
      tools,
    },
    outputItems,
    billing: storedOpenAIBillingState(record.billing),
    ...(workflowSubagentContext ? { workflowSubagentContext } : {}),
  }
}

export function canResumeOwnedProviderRequest(providerRequest: unknown): boolean {
  return Boolean(
    storedAnthropicProviderRequest(providerRequest) ?? storedOpenAIProviderRequest(providerRequest)
  )
}

function resultInputByCallId(
  results: ResumeToolsBody['results']
): Map<string, ResumeToolsBody['results'][number]> {
  return new Map(results.map((result) => [result.callId, result]))
}

function isCancelledToolResult(
  result: MothershipResumeToolCallRecord,
  requestResult?: ResumeToolsBody['results'][number]
): boolean {
  if (result.status === 'cancelled') return true
  const requestData = asRecord(requestResult?.data)
  return requestData?.cancelled === true
}

function buildAnthropicToolResultBlocks(
  recordedResults: MothershipResumeToolCallRecord[],
  requestResults: ResumeToolsBody['results']
): AnthropicToolResultBlock[] {
  const requestResultMap = resultInputByCallId(requestResults)
  return recordedResults.map((result) => {
    const requestResult = requestResultMap.get(result.toolCallId)
    const cancelled = isCancelledToolResult(result, requestResult)
    const success = (requestResult?.success ?? result.status === 'completed') && !cancelled
    const content = success
      ? stringifyAnthropicToolResult(result.result)
      : result.error ||
        stringifyAnthropicToolResult(result.result) ||
        (cancelled ? 'Tool cancelled' : 'Tool failed')
    return {
      type: 'tool_result',
      tool_use_id: result.toolCallId,
      content,
      ...(success ? {} : { is_error: true }),
    }
  })
}

function orderRecordedResumeToolResults(
  recordedResults: MothershipResumeToolCallRecord[],
  orderedToolCallIds: string[]
): MothershipResumeToolCallRecord[] {
  const orderByCallId = new Map(orderedToolCallIds.map((toolCallId, index) => [toolCallId, index]))
  return recordedResults
    .map((result, index) => ({ result, index }))
    .sort((left, right) => {
      const leftOrder = orderByCallId.get(left.result.toolCallId) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = orderByCallId.get(right.result.toolCallId) ?? Number.MAX_SAFE_INTEGER
      return leftOrder - rightOrder || left.index - right.index
    })
    .map(({ result }) => result)
}

function buildAnthropicResumeRequest(
  stored: StoredAnthropicProviderRequest,
  toolResults: AnthropicToolResultBlock[]
): AnthropicRequestPayload {
  return {
    ...stored.request,
    messages: [
      ...stored.request.messages,
      {
        role: 'assistant',
        content: stored.assistantContent,
      },
      {
        role: 'user',
        content: toolResults,
      },
    ],
  }
}

function buildOpenAIToolResultItems(
  toolResults: AnthropicToolResultBlock[]
): OpenAIFunctionCallOutputItem[] {
  return toolResults.map((result) => ({
    type: 'function_call_output',
    call_id: result.tool_use_id,
    output: result.content,
  }))
}

function buildOpenAIResumeRequest(
  stored: StoredOpenAIProviderRequest,
  toolResults: AnthropicToolResultBlock[]
): OpenAIRequestPayload {
  return {
    ...stored.request,
    input: [
      ...stored.request.input,
      ...stored.outputItems,
      ...buildOpenAIToolResultItems(toolResults),
    ],
  }
}

async function publishResumeToolResults(
  options: RunOwnedProviderResumeOptions,
  toolResults: AnthropicToolResultBlock[],
  delivery: { defer: boolean }
): Promise<void> {
  const resultByCallId = new Map(toolResults.map((result) => [result.tool_use_id, result]))
  const requestResultByCallId = resultInputByCallId(options.requestResults)
  for (const result of options.recordedResults) {
    const toolResult = resultByCallId.get(result.toolCallId)
    const cancelled = isCancelledToolResult(result, requestResultByCallId.get(result.toolCallId))
    const failed = toolResult?.is_error === true || cancelled
    const error = toolResult?.content ?? (cancelled ? 'Tool cancelled' : 'Tool failed')
    await options.writer.publish({
      type: 'tool',
      payload: {
        phase: 'result',
        toolCallId: result.toolCallId,
        toolName: result.toolName,
        executor: 'sim',
        mode: 'async',
        success: !failed,
        ...(failed ? { status: cancelled ? 'cancelled' : 'error', error } : {}),
        ...(!failed ? { status: 'success', output: result.result } : {}),
        ...(cancelled && result.result !== null && result.result !== undefined
          ? { output: result.result }
          : {}),
      },
      ...(delivery.defer
        ? {}
        : {
            afterPersist: async () => {
              await markMothershipResumeToolResultDelivered({
                checkpointId: result.checkpointId ?? options.checkpoint.checkpointId,
                toolCallId: result.toolCallId,
              })
            },
          }),
    })
  }
}

async function markResumeToolResultsDelivered(
  options: RunOwnedProviderResumeOptions
): Promise<void> {
  for (const result of options.recordedResults) {
    await markMothershipResumeToolResultDelivered({
      checkpointId: result.checkpointId ?? options.checkpoint.checkpointId,
      toolCallId: result.toolCallId,
    })
  }
}

async function completeAnthropicRequest(
  options: AnthropicRuntimeOptions,
  model: string,
  request: AnthropicRequestPayload,
  apiKey: string
): Promise<void> {
  const state = await withProviderRequestSignal(options.env, options.signal, async (signal) => {
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      throw new Error(`Anthropic request failed with status ${response.status}`)
    }

    return processAnthropicSse(response, options.writer)
  })
  if (!state.sawMessageStop) {
    throw new Error('Anthropic stream ended before message_stop')
  }
  const billing = await reportAnthropicBilling(options, model, state.usage)
  if (state.stopReason === 'tool_use') {
    await publishAnthropicToolCheckpoint(options, model, request, state, billing, apiKey)
    return
  }
  const cost =
    billing.credentialSource === 'byok'
      ? zeroProviderCost()
      : calculateAnthropicCost(model, billing.cumulativeUsage)
  await options.writer.publish({
    type: 'complete',
    payload: createCompletePayload(model, billing.cumulativeUsage, cost),
    afterPersist: async () => {
      await options.beforeTerminalStatusUpdate?.()
      await markRunCompleteOrThrow(options.runId)
    },
  })
}

async function reportAnthropicBilling(
  options: AnthropicRuntimeOptions,
  model: string,
  usage: AnthropicUsage
): Promise<AnthropicBillingState> {
  const cumulativeUsage = addUsage(options.billing.cumulativeUsage, usage)
  if (options.billing.credentialSource === 'byok') {
    return {
      ...options.billing,
      cumulativeUsage,
    }
  }

  const cost = calculateAnthropicCost(model, cumulativeUsage)
  const result = await reportMothershipBillingUsage({
    env: options.env,
    userId: options.billing.userId,
    workspaceId: options.billing.workspaceId,
    source: options.billing.source,
    model,
    inputTokens: cumulativeUsage.input_tokens ?? 0,
    outputTokens: cumulativeUsage.output_tokens ?? 0,
    cost: cost.total,
    idempotencyKey: `mothership-run:${options.runId}:anthropic`,
  })

  if (result.status === 'ok') {
    return {
      ...options.billing,
      cumulativeUsage,
    }
  }

  if (result.status === 'misconfigured') {
    throw new Error(`Mothership billing callback is not configured: ${result.missing}`)
  }
  if (result.status === 'rejected') {
    throw new Error(`Mothership billing callback failed with status ${result.statusCode}`)
  }
  throw new Error('Mothership billing callback failed')
}

async function completeOpenAIRequest(
  options: OpenAIRuntimeOptions,
  model: string,
  request: OpenAIRequestPayload,
  apiKey: string
): Promise<void> {
  const state = await withProviderRequestSignal(options.env, options.signal, async (signal) => {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'OpenAI-Beta': 'responses=v1',
      },
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      throw new Error(`OpenAI Responses request failed with status ${response.status}`)
    }

    return processOpenAISse(response, options.writer)
  })
  if (!state.sawCompleted) {
    throw new Error('OpenAI Responses stream ended before response.completed')
  }

  const pendingToolCalls = pendingOpenAIToolCalls(state.outputItems)
  const billing = await reportOpenAIBilling(options, model, state.usage)
  if (pendingToolCalls.length > 0) {
    await publishOpenAIToolCheckpoint(options, model, request, state, billing, apiKey)
    return
  }

  const cost =
    billing.credentialSource === 'byok'
      ? zeroProviderCost()
      : calculateOpenAICost(model, billing.cumulativeUsage)
  await options.writer.publish({
    type: 'complete',
    payload: createCompletePayload(model, billing.cumulativeUsage, cost),
    afterPersist: async () => {
      await options.beforeTerminalStatusUpdate?.()
      await markRunCompleteOrThrow(options.runId)
    },
  })
}

async function completeCliProxyApiRequest(
  options: OpenAIRuntimeOptions,
  model: string,
  request: CliProxyApiRequestPayload,
  apiKey: string
): Promise<void> {
  const state = await withProviderRequestSignal(options.env, options.signal, async (signal) => {
    const response = await fetch(cliproxyApiChatCompletionsUrl(options.env), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      throw new Error(`CliProxyAPI chat completions request failed with status ${response.status}`)
    }

    return processCliProxyApiSse(response, options.writer)
  })
  if (!state.sawDone) {
    throw new Error('CliProxyAPI chat completions stream ended before [DONE]')
  }
  if (!state.sawFinished) {
    throw new Error('CliProxyAPI chat completions stream ended before finish_reason')
  }
  if (!state.sawUsage) {
    await publishCliProxyApiError(
      options,
      'owned_provider_usage_missing',
      'CliProxyAPI chat completions response did not include billable usage.',
      model
    )
    return
  }

  const billing = await reportCliProxyApiBilling(options, model, state.usage)
  const cost = calculateOpenAICost(model, billing.cumulativeUsage)
  await options.writer.publish({
    type: 'complete',
    payload: createCompletePayload(model, billing.cumulativeUsage, cost),
    afterPersist: async () => {
      await options.beforeTerminalStatusUpdate?.()
      await markRunCompleteOrThrow(options.runId)
    },
  })
}

async function reportOpenAIBilling(
  options: OpenAIRuntimeOptions,
  model: string,
  usage: AnthropicUsage
): Promise<OpenAIBillingState> {
  const cumulativeUsage = addUsage(options.billing.cumulativeUsage, usage)
  if (options.billing.credentialSource === 'byok') {
    return {
      ...options.billing,
      cumulativeUsage,
    }
  }

  const cost = calculateOpenAICost(model, cumulativeUsage)
  const result = await reportMothershipBillingUsage({
    env: options.env,
    userId: options.billing.userId,
    workspaceId: options.billing.workspaceId,
    source: options.billing.source,
    model,
    inputTokens: cumulativeUsage.input_tokens ?? 0,
    outputTokens: cumulativeUsage.output_tokens ?? 0,
    cost: cost.total,
    idempotencyKey: `mothership-run:${options.runId}:openai`,
  })

  if (result.status === 'ok') {
    return {
      ...options.billing,
      cumulativeUsage,
    }
  }

  if (result.status === 'misconfigured') {
    throw new Error(`Mothership billing callback is not configured: ${result.missing}`)
  }
  if (result.status === 'rejected') {
    throw new Error(`Mothership billing callback failed with status ${result.statusCode}`)
  }
  throw new Error('Mothership billing callback failed')
}

async function reportCliProxyApiBilling(
  options: OpenAIRuntimeOptions,
  model: string,
  usage: AnthropicUsage
): Promise<OpenAIBillingState> {
  const cumulativeUsage = addUsage(options.billing.cumulativeUsage, usage)
  const cost = calculateOpenAICost(model, cumulativeUsage)
  const result = await reportMothershipBillingUsage({
    env: options.env,
    userId: options.billing.userId,
    workspaceId: options.billing.workspaceId,
    source: options.billing.source,
    model,
    inputTokens: cumulativeUsage.input_tokens ?? 0,
    outputTokens: cumulativeUsage.output_tokens ?? 0,
    cost: cost.total,
    idempotencyKey: `mothership-run:${options.runId}:cliproxyapi`,
  })

  if (result.status === 'ok') {
    return {
      ...options.billing,
      cumulativeUsage,
    }
  }

  if (result.status === 'misconfigured') {
    throw new Error(`Mothership billing callback is not configured: ${result.missing}`)
  }
  if (result.status === 'rejected') {
    throw new Error(`Mothership billing callback failed with status ${result.statusCode}`)
  }
  throw new Error('Mothership billing callback failed')
}

async function runAnthropicContinuation(
  options: RunOwnedProviderContinuationOptions,
  model: string
): Promise<void> {
  const initialBilling = initialBillingState(options.body, options.route)
  const credentials = await resolveAnthropicCredentials({
    billing: initialBilling,
    env: options.env,
    initialByokEligible: shouldAttemptInitialAnthropicByok(options.body, options.route),
    signal: options.signal,
  })

  const runtimeOptions: AnthropicRuntimeOptions = {
    billing: {
      ...initialBilling,
      credentialSource: credentials?.source ?? 'hosted',
    },
    chatBody: options.body,
    env: options.env,
    executionId: options.body.executionId,
    route: options.route,
    runId: options.runId,
    signal: options.signal,
    writer: options.writer,
  }

  if (!credentials) {
    await publishAnthropicError(
      runtimeOptions,
      'owned_provider_credentials_missing',
      'Mothership Anthropic credentials are not configured.',
      model
    )
    return
  }

  await completeAnthropicRequest(
    runtimeOptions,
    model,
    buildAnthropicRequest(options.body, model),
    credentials.apiKey
  )
}

async function runOpenAIContinuation(
  options: RunOwnedProviderContinuationOptions,
  model: string
): Promise<void> {
  const initialBilling = initialBillingState(options.body, options.route)
  let runtimeOptions: OpenAIRuntimeOptions = {
    billing: initialBilling,
    chatBody: options.body,
    env: options.env,
    executionId: options.body.executionId,
    route: options.route,
    runId: options.runId,
    signal: options.signal,
    writer: options.writer,
  }

  if (!resolveOpenAIPricing(model)) {
    await publishOpenAIError(
      runtimeOptions,
      'owned_provider_pricing_not_configured',
      `Mothership billing pricing is not configured for OpenAI model ${model}.`,
      model
    )
    return
  }

  const credentials = await resolveOpenAICredentials({
    billing: initialBilling,
    env: options.env,
    initialByokEligible: shouldAttemptInitialOpenAIByok(options.body, options.route),
    signal: options.signal,
  })
  runtimeOptions = {
    ...runtimeOptions,
    billing: {
      ...initialBilling,
      ...(credentials?.source === 'byok' ? { credentialSource: credentials.source } : {}),
    },
  }

  if (!credentials) {
    await publishOpenAIError(
      runtimeOptions,
      'owned_provider_credentials_missing',
      'Mothership OpenAI credentials are not configured.',
      model
    )
    return
  }

  await completeOpenAIRequest(
    runtimeOptions,
    model,
    buildOpenAIRequest(options.body, model),
    credentials.apiKey
  )
}

async function runCliProxyApiContinuation(
  options: RunOwnedProviderContinuationOptions,
  model: string
): Promise<void> {
  const initialBilling = initialBillingState(options.body, options.route)
  const runtimeOptions: OpenAIRuntimeOptions = {
    billing: initialBilling,
    chatBody: options.body,
    env: options.env,
    executionId: options.body.executionId,
    route: options.route,
    runId: options.runId,
    signal: options.signal,
    writer: options.writer,
  }

  if (!resolveOpenAIPricing(model)) {
    await publishCliProxyApiError(
      runtimeOptions,
      'owned_provider_pricing_not_configured',
      `Mothership billing pricing is not configured for CliProxyAPI model ${model}.`,
      model
    )
    return
  }

  if (hasRequestedProviderTools(options.body)) {
    await publishCliProxyApiError(
      runtimeOptions,
      'owned_provider_tools_not_supported',
      'Mothership CliProxyAPI tool calls are not implemented yet.',
      model
    )
    return
  }

  const credentials = resolveCliProxyApiCredentials(options.env)
  if (!credentials) {
    await publishCliProxyApiError(
      runtimeOptions,
      'owned_provider_credentials_missing',
      'Mothership CliProxyAPI credentials are not configured.',
      model
    )
    return
  }

  await completeCliProxyApiRequest(
    runtimeOptions,
    model,
    buildCliProxyApiRequest(options.body, options.env, model),
    credentials.apiKey
  )
}

export async function runOwnedProviderContinuation(
  options: RunOwnedProviderContinuationOptions
): Promise<ProviderRuntimeStatus> {
  const { model: requestedModel, provider } = resolveOwnedProviderSelection({
    env: options.env,
    model: options.model,
    provider: options.provider,
  })
  if (selectedCliProxyApiProvider(provider)) {
    const model = requestedModel
    try {
      await runCliProxyApiContinuation(options, model)
    } catch (error) {
      if (error instanceof MothershipStreamPersistenceError) throw error

      const message = getErrorMessage(error, 'Owned Mothership CliProxyAPI provider request failed')
      logger.warn('CliProxyAPI owned provider continuation failed', {
        route: options.route,
        model,
        error: message,
      })
      await publishCliProxyApiError(
        {
          route: options.route,
          runId: options.runId,
          writer: options.writer,
        },
        'owned_provider_error',
        'Owned Mothership CliProxyAPI provider request failed.',
        model
      )
    }

    return 'handled'
  }

  if (provider === 'openai') {
    const model = requestedModel
    try {
      await runOpenAIContinuation(options, model)
    } catch (error) {
      if (error instanceof MothershipStreamPersistenceError) throw error

      const message = getErrorMessage(error, 'Owned Mothership OpenAI provider request failed')
      logger.warn('OpenAI owned provider continuation failed', {
        route: options.route,
        model,
        error: message,
      })
      await publishOpenAIError(
        {
          route: options.route,
          runId: options.runId,
          writer: options.writer,
        },
        'owned_provider_error',
        message,
        model
      )
    }

    return 'handled'
  }

  const model = requestedModel
  if (!selectedAnthropicProvider(provider, model)) {
    return 'unsupported'
  }

  try {
    await runAnthropicContinuation(options, model)
  } catch (error) {
    if (error instanceof MothershipStreamPersistenceError) throw error

    const message = getErrorMessage(error, 'Owned Mothership provider request failed')
    logger.warn('Anthropic owned provider continuation failed', {
      route: options.route,
      model,
      error: message,
    })
    await publishAnthropicError(
      {
        route: options.route,
        runId: options.runId,
        writer: options.writer,
      },
      'owned_provider_error',
      message,
      model
    )
  }

  return 'handled'
}

export async function runOwnedProviderResume(
  options: RunOwnedProviderResumeOptions
): Promise<ProviderRuntimeStatus> {
  const storedOpenAI = storedOpenAIProviderRequest(options.checkpoint.providerRequest)
  if (storedOpenAI) {
    const fallbackBilling = fallbackResumeBillingState(options.body, options.route)
    const resumeBilling: OpenAIBillingState = storedOpenAI.billing ?? {
      source: fallbackBilling.source,
      userId: fallbackBilling.userId,
      workspaceId: fallbackBilling.workspaceId,
      cumulativeUsage: fallbackBilling.cumulativeUsage,
    }
    const orderedRecordedResults = orderRecordedResumeToolResults(
      options.recordedResults,
      pendingOpenAIToolCalls(storedOpenAI.outputItems).map((toolCall) => toolCall.toolCallId)
    )
    const resumeOptions: RunOwnedProviderResumeOptions = {
      ...options,
      recordedResults: orderedRecordedResults,
    }
    let runtimeOptions: OpenAIRuntimeOptions = {
      billing: resumeBilling,
      env: options.env,
      executionId: storedOpenAI.executionId,
      route: options.route,
      runId: options.checkpoint.runId,
      signal: options.signal,
      writer: options.writer,
      ...(storedOpenAI.workflowSubagentContext
        ? { chatBody: storedOpenAI.workflowSubagentContext }
        : {}),
      ...(options.body.willRetryOnStreamError
        ? { beforeTerminalStatusUpdate: () => markResumeToolResultsDelivered(resumeOptions) }
        : {}),
    }
    const toolResults = buildAnthropicToolResultBlocks(
      orderedRecordedResults,
      options.requestResults
    )

    try {
      const credentials = await resolveOpenAICredentials({
        billing: resumeBilling,
        env: options.env,
        initialByokEligible: false,
        signal: options.signal,
      })
      runtimeOptions = {
        ...runtimeOptions,
        billing: {
          ...resumeBilling,
          ...(credentials?.source === 'byok' || resumeBilling.credentialSource
            ? { credentialSource: credentials?.source ?? resumeBilling.credentialSource }
            : {}),
        },
      }
      await options.writer.publish({
        type: 'run',
        payload: {
          kind: 'resumed',
        },
      })
      await publishResumeToolResults(resumeOptions, toolResults, {
        defer: options.body.willRetryOnStreamError === true,
      })

      if (!credentials) {
        await publishOpenAIError(
          runtimeOptions,
          'owned_provider_credentials_missing',
          'Mothership OpenAI credentials are not configured.',
          storedOpenAI.model
        )
        return 'handled'
      }

      await completeOpenAIRequest(
        runtimeOptions,
        storedOpenAI.model,
        buildOpenAIResumeRequest(storedOpenAI, toolResults),
        credentials.apiKey
      )
    } catch (error) {
      if (error instanceof MothershipStreamPersistenceError) {
        await markRunPausedForToolOrThrow(options.checkpoint.runId)
        throw error
      }

      const message = getErrorMessage(error, 'Owned Mothership OpenAI provider resume failed')
      logger.warn('OpenAI owned provider resume failed', {
        route: options.route,
        model: storedOpenAI.model,
        checkpointId: options.checkpoint.checkpointId,
        error: message,
        willRetryOnStreamError: options.body.willRetryOnStreamError,
      })
      if (
        options.body.willRetryOnStreamError &&
        !(error instanceof MothershipByokCredentialsError)
      ) {
        await markRunPausedForToolOrThrow(options.checkpoint.runId)
        throw error
      }
      await publishOpenAIError(runtimeOptions, 'owned_provider_error', message, storedOpenAI.model)
    }

    return 'handled'
  }

  const stored = storedAnthropicProviderRequest(options.checkpoint.providerRequest)
  if (!stored) {
    await publishAnthropicError(
      {
        route: options.route,
        runId: options.checkpoint.runId,
        writer: options.writer,
      },
      'owned_provider_resume_request_missing',
      'Mothership resume checkpoint is missing an owned Anthropic provider request.',
      DEFAULT_ANTHROPIC_MODEL
    )
    return 'handled'
  }

  const resumeBilling = stored.billing ?? fallbackResumeBillingState(options.body, options.route)
  const orderedRecordedResults = orderRecordedResumeToolResults(
    options.recordedResults,
    pendingAnthropicToolCalls(stored.assistantContent).map((toolCall) => toolCall.toolCallId)
  )
  const resumeOptions: RunOwnedProviderResumeOptions = {
    ...options,
    recordedResults: orderedRecordedResults,
  }
  let runtimeOptions: AnthropicRuntimeOptions = {
    billing: {
      ...resumeBilling,
      credentialSource: resumeBilling.credentialSource ?? 'hosted',
    },
    env: options.env,
    executionId: stored.executionId,
    route: options.route,
    runId: options.checkpoint.runId,
    signal: options.signal,
    writer: options.writer,
    ...(stored.workflowSubagentContext ? { chatBody: stored.workflowSubagentContext } : {}),
  }
  const toolResults = buildAnthropicToolResultBlocks(orderedRecordedResults, options.requestResults)

  try {
    const credentials = await resolveAnthropicCredentials({
      billing: resumeBilling,
      env: options.env,
      initialByokEligible: false,
      signal: options.signal,
    })
    runtimeOptions = {
      ...runtimeOptions,
      billing: {
        ...resumeBilling,
        credentialSource: credentials?.source ?? resumeBilling.credentialSource ?? 'hosted',
      },
      ...(options.body.willRetryOnStreamError
        ? { beforeTerminalStatusUpdate: () => markResumeToolResultsDelivered(resumeOptions) }
        : {}),
    }
    await options.writer.publish({
      type: 'run',
      payload: {
        kind: 'resumed',
      },
    })
    await publishResumeToolResults(resumeOptions, toolResults, {
      defer: options.body.willRetryOnStreamError === true,
    })

    if (!credentials) {
      await publishAnthropicError(
        runtimeOptions,
        'owned_provider_credentials_missing',
        'Mothership Anthropic credentials are not configured.',
        stored.model
      )
      return 'handled'
    }

    await completeAnthropicRequest(
      runtimeOptions,
      stored.model,
      buildAnthropicResumeRequest(stored, toolResults),
      credentials.apiKey
    )
  } catch (error) {
    if (error instanceof MothershipStreamPersistenceError) {
      await markRunPausedForToolOrThrow(options.checkpoint.runId)
      throw error
    }

    const message = getErrorMessage(error, 'Owned Mothership provider resume failed')
    logger.warn('Anthropic owned provider resume failed', {
      route: options.route,
      model: stored.model,
      checkpointId: options.checkpoint.checkpointId,
      error: message,
      willRetryOnStreamError: options.body.willRetryOnStreamError,
    })
    if (options.body.willRetryOnStreamError && !(error instanceof MothershipByokCredentialsError)) {
      await markRunPausedForToolOrThrow(options.checkpoint.runId)
      throw error
    }
    await publishAnthropicError(runtimeOptions, 'owned_provider_error', message, stored.model)
  }

  return 'handled'
}

export async function generateOwnedChatTitle(
  body: GenerateChatTitleBody,
  env: MothershipEnv,
  signal?: AbortSignal
): Promise<OwnedChatTitleResult> {
  const provider = normalizeProvider(body.provider) ?? defaultProvider(env)
  const model =
    body.model ??
    env.MOTHERSHIP_DEFAULT_MODEL ??
    (provider === 'cliproxyapi' ? cliproxyApiModel(env) : DEFAULT_ANTHROPIC_MODEL)

  if (selectedCliProxyApiProvider(provider)) {
    const apiKey = env.MOTHERSHIP_CLIPROXY_API_KEY
    if (!apiKey) {
      return { status: 'missing_credentials', model, provider: 'cliproxyapi' }
    }

    try {
      const response = await withProviderRequestSignal(env, signal, (requestSignal) =>
        fetch(cliproxyApiChatCompletionsUrl(env), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            stream: false,
            max_completion_tokens: DEFAULT_TITLE_MAX_COMPLETION_TOKENS,
            reasoning_effort: cliproxyApiReasoningEffort(env),
            messages: [{ role: 'user', content: buildTitlePrompt(body.message) }],
          }),
          signal: requestSignal,
        })
      )

      if (!response.ok) {
        return {
          status: 'provider_error',
          model,
          message: `CliProxyAPI title request failed with status ${response.status}`,
        }
      }

      const titleText = normalizeTitle(
        readChatCompletionsMessageText((await response.json()) as unknown) ?? ''
      )
      if (!titleText) {
        return {
          status: 'provider_error',
          model,
          message: 'CliProxyAPI title response did not include text',
        }
      }

      return { status: 'ok', title: titleText }
    } catch (error) {
      return {
        status: 'provider_error',
        model,
        message: getErrorMessage(error, 'CliProxyAPI title request failed'),
      }
    }
  }

  if (!selectedAnthropicProvider(provider, model)) {
    return { status: 'unsupported_provider', model }
  }

  const apiKey = env.MOTHERSHIP_ANTHROPIC_API_KEY
  if (!apiKey) {
    return { status: 'missing_credentials', model, provider: 'anthropic' }
  }

  try {
    const response = await withProviderRequestSignal(env, signal, (requestSignal) =>
      fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: 64,
          stream: false,
          messages: [{ role: 'user', content: buildTitlePrompt(body.message) }],
        }),
        signal: requestSignal,
      })
    )

    if (!response.ok) {
      return {
        status: 'provider_error',
        model,
        message: `Anthropic title request failed with status ${response.status}`,
      }
    }

    const titleText = normalizeTitle(
      readAnthropicJsonText((await response.json()) as unknown) ?? ''
    )
    if (!titleText) {
      return {
        status: 'provider_error',
        model,
        message: 'Anthropic title response did not include text',
      }
    }

    return { status: 'ok', title: titleText }
  } catch (error) {
    return {
      status: 'provider_error',
      model,
      message: getErrorMessage(error, 'Anthropic title request failed'),
    }
  }
}
