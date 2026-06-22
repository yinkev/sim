import { createLogger } from '@sim/logger'
import {
  createSimCallbackHeaders,
  MothershipClientError,
  type MothershipFetch,
  requestMothership,
} from '@sim/mothership-client'
import {
  type BillingUpdateCostBody,
  billingUpdateCostCallbackContract,
  simApiKeyValidateCallbackContract,
  simByokValidateCallbackContract,
  type WorkflowSubagentExecuteBody,
  type WorkflowSubagentExecuteResponse,
  workflowSubagentExecuteCallbackContract,
} from '@sim/mothership-contracts/routes'
import type { MothershipEnv } from '@/env'
import {
  claimMothershipBillingCallbackOutboxEventById,
  claimNextMothershipBillingCallbackOutboxEvent,
  completeMothershipBillingCallbackOutboxEvent,
  enqueueMothershipBillingCallbackOutboxEvent,
  type MothershipBillingCallbackOutboxEvent,
  reclaimStaleMothershipBillingCallbackOutboxEvents,
  recordMothershipBillingCallbackOutboxFailure,
} from '@/state/callback-outbox'

const logger = createLogger('MothershipCallbacks')

type CallbackConfigResult =
  | { status: 'ok'; baseUrl: string; callbackKey: string }
  | { status: 'misconfigured'; missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY' | 'SIM_BASE_URL' }

export type MothershipApiKeyEntitlementResult =
  | { status: 'ok' }
  | { status: 'misconfigured'; missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY' | 'SIM_BASE_URL' }
  | { status: 'rejected'; statusCode: number; body: unknown }
  | { status: 'callback_error'; error: unknown }

export type MothershipBillingUsageResult =
  | { status: 'ok'; duplicate?: boolean }
  | { status: 'misconfigured'; missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY' | 'SIM_BASE_URL' }
  | { status: 'rejected'; statusCode: number; body: unknown }
  | { status: 'callback_error'; error: unknown }

export type MothershipByokEntitlementResult =
  | { status: 'ok' }
  | { status: 'misconfigured'; missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY' | 'SIM_BASE_URL' }
  | { status: 'rejected'; statusCode: number; body: unknown }
  | { status: 'callback_error'; error: unknown }

export type MothershipWorkflowSubagentExecutionResult =
  | { status: 'ok'; response: WorkflowSubagentExecuteResponse }
  | { status: 'misconfigured'; missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY' | 'SIM_BASE_URL' }
  | { status: 'rejected'; statusCode: number; body: unknown }
  | { status: 'callback_error'; error: unknown }

export interface ValidateMothershipApiKeyEntitlementInput {
  env: MothershipEnv
  userId: string
  workspaceId: string
  signal?: AbortSignal
  fetch?: MothershipFetch
}

export interface ReportMothershipBillingUsageInput {
  cost: number
  env: MothershipEnv
  idempotencyKey: string
  inputTokens: number
  model: string
  outputTokens: number
  signal?: AbortSignal
  source: BillingUpdateCostBody['source']
  userId: string
  workspaceId: string
  fetch?: MothershipFetch
}

export interface ValidateMothershipByokEntitlementInput {
  env: MothershipEnv
  userId: string
  workspaceId: string
  signal?: AbortSignal
  fetch?: MothershipFetch
}

export interface ExecuteWorkflowSubagentCallbackInput {
  env: MothershipEnv
  request: WorkflowSubagentExecuteBody
  signal?: AbortSignal
  fetch?: MothershipFetch
}

export type ProcessMothershipBillingUsageOutboxEventResult =
  | MothershipBillingUsageResult
  | { status: 'completed' | 'dead_letter' | 'lease_lost' | 'not_found' | 'pending' | 'processing' }

export interface ProcessPendingMothershipBillingUsageCallbacksResult {
  attempted: number
  completed: number
  deadLettered: number
  leaseLost: number
  reaped: number
  retryable: number
}

type ClaimedMothershipBillingUsageOutboxProcessingResult = {
  delivery: MothershipBillingUsageResult
  outboxStatus: 'completed' | 'dead_letter' | 'lease_lost' | 'pending'
}

function readCallbackConfig(env: MothershipEnv): CallbackConfigResult {
  if (!env.MOTHERSHIP_TO_SIM_CALLBACK_KEY) {
    return { status: 'misconfigured', missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY' }
  }
  if (!env.SIM_BASE_URL) {
    return { status: 'misconfigured', missing: 'SIM_BASE_URL' }
  }

  return {
    status: 'ok',
    baseUrl: env.SIM_BASE_URL,
    callbackKey: env.MOTHERSHIP_TO_SIM_CALLBACK_KEY,
  }
}

export async function validateMothershipApiKeyEntitlement(
  input: ValidateMothershipApiKeyEntitlementInput
): Promise<MothershipApiKeyEntitlementResult> {
  const config = readCallbackConfig(input.env)
  if (config.status !== 'ok') return config

  try {
    await requestMothership(
      simApiKeyValidateCallbackContract,
      {
        baseUrl: config.baseUrl,
        fetch: input.fetch,
      },
      {
        headers: createSimCallbackHeaders(config.callbackKey),
        body: {
          userId: input.userId,
          workspaceId: input.workspaceId,
        },
        signal: input.signal,
      }
    )
    return { status: 'ok' }
  } catch (error) {
    if (error instanceof MothershipClientError && error.status > 0) {
      return { status: 'rejected', statusCode: error.status, body: error.body }
    }
    return { status: 'callback_error', error }
  }
}

export async function reportMothershipBillingUsage(
  input: ReportMothershipBillingUsageInput
): Promise<MothershipBillingUsageResult> {
  const config = readCallbackConfig(input.env)
  if (config.status !== 'ok') return config

  const eventId = await enqueueMothershipBillingCallbackOutboxEvent({
    cost: input.cost,
    idempotencyKey: input.idempotencyKey,
    inputTokens: input.inputTokens,
    model: input.model,
    outputTokens: input.outputTokens,
    source: input.source,
    userId: input.userId,
    workspaceId: input.workspaceId,
  })

  const result = await processMothershipBillingUsageOutboxEventById({
    env: input.env,
    eventId,
    fetch: input.fetch,
    signal: input.signal,
  })

  if (
    result.status === 'ok' ||
    result.status === 'misconfigured' ||
    result.status === 'rejected' ||
    result.status === 'callback_error'
  ) {
    return result
  }

  if (result.status === 'completed') {
    return { status: 'ok' }
  }

  return {
    status: 'callback_error',
    error: new Error(`Billing callback outbox event ${eventId} is ${result.status}`),
  }
}

export async function validateMothershipByokEntitlement(
  input: ValidateMothershipByokEntitlementInput
): Promise<MothershipByokEntitlementResult> {
  const config = readCallbackConfig(input.env)
  if (config.status !== 'ok') return config

  try {
    await requestMothership(
      simByokValidateCallbackContract,
      {
        baseUrl: config.baseUrl,
        fetch: input.fetch,
      },
      {
        headers: createSimCallbackHeaders(config.callbackKey),
        body: {
          userId: input.userId,
          workspaceId: input.workspaceId,
        },
        signal: input.signal,
      }
    )
    return { status: 'ok' }
  } catch (error) {
    if (error instanceof MothershipClientError && error.status > 0) {
      return { status: 'rejected', statusCode: error.status, body: error.body }
    }
    return { status: 'callback_error', error }
  }
}

export async function executeWorkflowSubagentCallback(
  input: ExecuteWorkflowSubagentCallbackInput
): Promise<MothershipWorkflowSubagentExecutionResult> {
  const config = readCallbackConfig(input.env)
  if (config.status !== 'ok') return config

  try {
    const response = await requestMothership(
      workflowSubagentExecuteCallbackContract,
      {
        baseUrl: config.baseUrl,
        fetch: input.fetch,
      },
      {
        headers: createSimCallbackHeaders(config.callbackKey),
        body: input.request,
        signal: input.signal,
      }
    )
    return { status: 'ok', response }
  } catch (error) {
    if (error instanceof MothershipClientError && error.status > 0) {
      return { status: 'rejected', statusCode: error.status, body: error.body }
    }
    return { status: 'callback_error', error }
  }
}

export async function processMothershipBillingUsageOutboxEventById(input: {
  env: MothershipEnv
  eventId: string
  fetch?: MothershipFetch
  signal?: AbortSignal
}): Promise<ProcessMothershipBillingUsageOutboxEventResult> {
  const claim = await claimMothershipBillingCallbackOutboxEventById(input.eventId, {
    allowBeforeAvailableAt: true,
  })
  if (claim.status !== 'claimed') {
    return claim
  }

  const processed = await processClaimedMothershipBillingUsageOutboxEvent(claim.event, input)
  if (processed.outboxStatus === 'completed' || processed.outboxStatus === 'pending') {
    return processed.delivery
  }

  return { status: processed.outboxStatus }
}

export async function processPendingMothershipBillingUsageCallbacks(input: {
  batchSize?: number
  env: MothershipEnv
  fetch?: MothershipFetch
  signal?: AbortSignal
}): Promise<ProcessPendingMothershipBillingUsageCallbacksResult> {
  const batchSize = input.batchSize ?? 10
  let attempted = 0
  let completed = 0
  let deadLettered = 0
  let leaseLost = 0
  const reaped = await reclaimStaleMothershipBillingCallbackOutboxEvents()
  let retryable = 0

  for (let index = 0; index < batchSize; index++) {
    const claim = await claimNextMothershipBillingCallbackOutboxEvent()
    if (claim.status === 'none') break

    attempted++
    if (claim.status !== 'claimed') {
      deadLettered++
      continue
    }

    const result = await processClaimedMothershipBillingUsageOutboxEvent(claim.event, input)
    if (result.outboxStatus === 'completed') {
      completed++
      continue
    }
    if (result.outboxStatus === 'pending') {
      retryable++
      continue
    }
    if (result.outboxStatus === 'dead_letter') {
      deadLettered++
      continue
    }
    leaseLost++
  }

  return {
    attempted,
    completed,
    deadLettered,
    leaseLost,
    reaped,
    retryable,
  }
}

async function processClaimedMothershipBillingUsageOutboxEvent(
  event: MothershipBillingCallbackOutboxEvent,
  input: {
    env: MothershipEnv
    fetch?: MothershipFetch
    signal?: AbortSignal
  }
): Promise<ClaimedMothershipBillingUsageOutboxProcessingResult> {
  const result = await deliverMothershipBillingUsageCallback({
    env: input.env,
    fetch: input.fetch,
    payload: event.payload,
    signal: input.signal,
  })

  if (result.status === 'ok') {
    const completed = await completeMothershipBillingCallbackOutboxEvent(event)
    if (!completed) {
      logger.warn('Mothership billing callback outbox lease was lost before completion', {
        eventId: event.id,
      })
    }
    return {
      delivery: result,
      outboxStatus: completed ? 'completed' : 'lease_lost',
    }
  }

  const failure = await recordMothershipBillingCallbackOutboxFailure(
    event,
    result.status === 'callback_error'
      ? result.error
      : new Error(
          result.status === 'misconfigured'
            ? `Mothership billing callback is not configured: ${result.missing}`
            : `Mothership billing callback failed with status ${result.statusCode}`
        )
  )

  if (failure.status === 'lease_lost') {
    logger.warn('Mothership billing callback outbox lease was lost before retry scheduling', {
      eventId: event.id,
    })
  }

  return {
    delivery: result,
    outboxStatus: failure.status,
  }
}

async function deliverMothershipBillingUsageCallback(input: {
  env: MothershipEnv
  fetch?: MothershipFetch
  payload: BillingUpdateCostBody
  signal?: AbortSignal
}): Promise<MothershipBillingUsageResult> {
  const config = readCallbackConfig(input.env)
  if (config.status !== 'ok') return config

  try {
    await requestMothership(
      billingUpdateCostCallbackContract,
      {
        baseUrl: config.baseUrl,
        fetch: input.fetch,
      },
      {
        headers: createSimCallbackHeaders(config.callbackKey),
        body: input.payload,
        signal: input.signal,
      }
    )
    return { status: 'ok' }
  } catch (error) {
    if (error instanceof MothershipClientError && error.status === 409) {
      return { status: 'ok', duplicate: true }
    }
    if (error instanceof MothershipClientError && error.status > 0) {
      return { status: 'rejected', statusCode: error.status, body: error.body }
    }
    return { status: 'callback_error', error }
  }
}
