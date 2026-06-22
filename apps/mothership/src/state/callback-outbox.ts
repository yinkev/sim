import { db } from '@sim/db'
import { outboxEvent } from '@sim/db/schema'
import { createLogger } from '@sim/logger'
import {
  type BillingUpdateCostBody,
  billingUpdateCostBodySchema,
} from '@sim/mothership-contracts/routes'
import { getErrorMessage } from '@sim/utils/errors'
import { generateId } from '@sim/utils/id'
import { backoffWithJitter } from '@sim/utils/retry'
import { truncate } from '@sim/utils/string'
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm'

const logger = createLogger('MothershipCallbackOutbox')

const DEFAULT_MAX_ATTEMPTS = 10
const RETRY_BACKOFF_OPTIONS = {
  baseMs: 1_000,
  maxMs: 60_000,
} as const
const IMMEDIATE_DELIVERY_GRACE_MS = 30 * 1000
const STUCK_PROCESSING_THRESHOLD_MS = 10 * 60 * 1000
const MAX_LAST_ERROR_LENGTH = 1_000
const INVALID_PAYLOAD_LAST_ERROR = 'Invalid Mothership billing callback outbox payload'

export const MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES = {
  BILLING_USAGE: 'mothership_billing_usage',
} as const

type MothershipDbClient = Pick<typeof db, 'insert' | 'select' | 'transaction' | 'update'>
type MothershipDbInsertClient = Pick<typeof db, 'insert'>
type OutboxRow = typeof outboxEvent.$inferSelect
type OutboxStatus = 'pending' | 'processing' | 'completed' | 'dead_letter'
type ClaimedOutboxStatus = Extract<OutboxStatus, 'processing'>
type DeadLetterOutboxStatus = Extract<OutboxStatus, 'dead_letter'>
type TerminalOutboxStatus = Extract<OutboxStatus, 'completed' | 'dead_letter'>

interface ClaimMothershipBillingCallbackOutboxEventOptions {
  allowBeforeAvailableAt?: boolean
}

export interface MothershipBillingCallbackOutboxPayload {
  cost: number
  idempotencyKey: string
  inputTokens: number
  model: string
  outputTokens: number
  source: BillingUpdateCostBody['source']
  userId: string
  workspaceId: string
}

export interface EnqueueMothershipBillingCallbackOutboxEventInput
  extends MothershipBillingCallbackOutboxPayload {
  availableAt?: Date
  maxAttempts?: number
}

export interface MothershipBillingCallbackOutboxEvent
  extends Omit<OutboxRow, 'lockedAt' | 'payload' | 'status' | 'eventType'> {
  eventType: typeof MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE
  lockedAt: Date
  payload: MothershipBillingCallbackOutboxPayload
  status: ClaimedOutboxStatus
}

export type ClaimMothershipBillingCallbackOutboxEventResult =
  | { status: 'claimed'; event: MothershipBillingCallbackOutboxEvent }
  | { status: OutboxStatus | 'not_found' }

export type ClaimNextMothershipBillingCallbackOutboxEventResult =
  | { status: 'claimed'; event: MothershipBillingCallbackOutboxEvent }
  | { status: 'dead_letter' | 'none' }

export type RecordMothershipBillingCallbackOutboxFailureResult =
  | { status: 'pending'; availableAt: Date; attempts: number }
  | { status: DeadLetterOutboxStatus; attempts: number }
  | { status: 'lease_lost'; attempts: number }

/**
 * Persists a durable billing callback event without storing callback secrets.
 */
export async function enqueueMothershipBillingCallbackOutboxEvent(
  input: EnqueueMothershipBillingCallbackOutboxEventInput,
  executor: MothershipDbInsertClient = db
): Promise<string> {
  const eventId = generateId()
  await executor.insert(outboxEvent).values({
    id: eventId,
    eventType: MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE,
    payload: {
      cost: input.cost,
      idempotencyKey: input.idempotencyKey,
      inputTokens: input.inputTokens,
      model: input.model,
      outputTokens: input.outputTokens,
      source: input.source,
      userId: input.userId,
      workspaceId: input.workspaceId,
    } as never,
    status: 'pending',
    attempts: 0,
    maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    availableAt: input.availableAt ?? new Date(Date.now() + IMMEDIATE_DELIVERY_GRACE_MS),
  })
  logger.info('Enqueued Mothership billing callback outbox event', {
    eventId,
    idempotencyKey: input.idempotencyKey,
    workspaceId: input.workspaceId,
  })
  return eventId
}

/**
 * Claims a specific pending billing callback event for delivery.
 */
export async function claimMothershipBillingCallbackOutboxEventById(
  eventId: string,
  options: ClaimMothershipBillingCallbackOutboxEventOptions = {},
  client: MothershipDbClient = db
): Promise<ClaimMothershipBillingCallbackOutboxEventResult> {
  const now = new Date()
  const claimed = await client.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(outboxEvent)
      .where(eq(outboxEvent.id, eventId))
      .for('update', { skipLocked: true })
      .limit(1)

    if (!row) return null
    if (row.eventType !== MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE) {
      return { status: 'not_found' as const }
    }
    if (row.status !== 'pending') {
      return { status: row.status as OutboxStatus }
    }
    if (row.availableAt > now && !options.allowBeforeAvailableAt) {
      return { status: 'pending' as const }
    }

    const payloadResult = parseMothershipBillingCallbackOutboxPayload(row.payload)
    if (!payloadResult.success) {
      await deadLetterInvalidMothershipBillingCallbackOutboxEvent(row, payloadResult.error, tx)
      return { status: 'dead_letter' as const }
    }

    await tx
      .update(outboxEvent)
      .set({
        status: 'processing',
        lockedAt: now,
      })
      .where(
        and(
          eq(outboxEvent.id, row.id),
          eq(outboxEvent.eventType, MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE),
          eq(outboxEvent.status, 'pending')
        )
      )

    return {
      status: 'claimed' as const,
      event: toClaimedEvent(
        {
          ...row,
          status: 'processing',
          lockedAt: now,
        },
        payloadResult.payload
      ),
    }
  })

  if (claimed) {
    return claimed
  }

  const [current] = await client
    .select({
      eventType: outboxEvent.eventType,
      status: outboxEvent.status,
    })
    .from(outboxEvent)
    .where(eq(outboxEvent.id, eventId))
    .limit(1)

  if (!current || current.eventType !== MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE) {
    return { status: 'not_found' }
  }

  return {
    status: current.status as OutboxStatus,
  }
}

/**
 * Claims the next due pending billing callback event in created-order.
 */
export async function claimNextMothershipBillingCallbackOutboxEvent(
  client: MothershipDbClient = db
): Promise<ClaimNextMothershipBillingCallbackOutboxEventResult> {
  const now = new Date()
  return client.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(outboxEvent)
      .where(
        and(
          eq(outboxEvent.eventType, MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE),
          eq(outboxEvent.status, 'pending'),
          lte(outboxEvent.availableAt, now)
        )
      )
      .orderBy(asc(outboxEvent.createdAt))
      .for('update', { skipLocked: true })
      .limit(1)

    if (!row) return { status: 'none' as const }

    const payloadResult = parseMothershipBillingCallbackOutboxPayload(row.payload)
    if (!payloadResult.success) {
      await deadLetterInvalidMothershipBillingCallbackOutboxEvent(row, payloadResult.error, tx)
      return { status: 'dead_letter' as const }
    }

    await tx
      .update(outboxEvent)
      .set({
        status: 'processing',
        lockedAt: now,
      })
      .where(
        and(
          eq(outboxEvent.id, row.id),
          eq(outboxEvent.eventType, MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE),
          eq(outboxEvent.status, 'pending')
        )
      )

    return {
      status: 'claimed' as const,
      event: toClaimedEvent(
        {
          ...row,
          status: 'processing',
          lockedAt: now,
        },
        payloadResult.payload
      ),
    }
  })
}

/**
 * Reclaims stale billing callback leases left behind by crashed workers.
 */
export async function reclaimStaleMothershipBillingCallbackOutboxEvents(
  client: Pick<typeof db, 'update'> = db
): Promise<number> {
  const staleBefore = new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MS)
  const updated = await client
    .update(outboxEvent)
    .set({
      status: 'pending',
      lockedAt: null,
    })
    .where(
      and(
        eq(outboxEvent.eventType, MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE),
        eq(outboxEvent.status, 'processing'),
        or(isNull(outboxEvent.lockedAt), lte(outboxEvent.lockedAt, staleBefore))
      )
    )
    .returning({ id: outboxEvent.id })

  if (updated.length > 0) {
    logger.warn('Reclaimed stale Mothership billing callback outbox leases', {
      count: updated.length,
      thresholdMs: STUCK_PROCESSING_THRESHOLD_MS,
    })
  }

  return updated.length
}

/**
 * Marks a claimed billing callback event completed after a successful or duplicate callback.
 */
export async function completeMothershipBillingCallbackOutboxEvent(
  event: MothershipBillingCallbackOutboxEvent,
  client: Pick<typeof db, 'update'> = db
): Promise<boolean> {
  const updated = await updateClaimedMothershipBillingCallbackOutboxEvent(
    event,
    {
      status: 'completed',
      lockedAt: null,
      processedAt: new Date(),
      lastError: null,
    },
    client
  )

  if (updated) {
    logger.info('Completed Mothership billing callback outbox event', {
      eventId: event.id,
      attempts: event.attempts + 1,
      workspaceId: event.payload.workspaceId,
    })
  }

  return updated
}

/**
 * Reschedules a claimed billing callback event with bounded retry backoff.
 */
export async function recordMothershipBillingCallbackOutboxFailure(
  event: MothershipBillingCallbackOutboxEvent,
  error: unknown,
  client: Pick<typeof db, 'update'> = db
): Promise<RecordMothershipBillingCallbackOutboxFailureResult> {
  const nextAttempts = event.attempts + 1
  const lastError = truncate(
    getErrorMessage(error, 'Mothership billing callback failed'),
    MAX_LAST_ERROR_LENGTH
  )

  if (nextAttempts >= event.maxAttempts) {
    const updated = await updateClaimedMothershipBillingCallbackOutboxEvent(
      event,
      {
        attempts: nextAttempts,
        status: 'dead_letter',
        lockedAt: null,
        processedAt: new Date(),
        lastError,
      },
      client
    )

    if (!updated) {
      return { status: 'lease_lost', attempts: nextAttempts }
    }

    logger.error('Dead-lettered Mothership billing callback outbox event', {
      eventId: event.id,
      attempts: nextAttempts,
      error: lastError,
      workspaceId: event.payload.workspaceId,
    })

    return { status: 'dead_letter', attempts: nextAttempts }
  }

  const retryDelayMs = Math.ceil(backoffWithJitter(nextAttempts, null, RETRY_BACKOFF_OPTIONS))
  const availableAt = new Date(Date.now() + retryDelayMs)
  const updated = await updateClaimedMothershipBillingCallbackOutboxEvent(
    event,
    {
      attempts: nextAttempts,
      status: 'pending',
      availableAt,
      lockedAt: null,
      processedAt: null,
      lastError,
    },
    client
  )

  if (!updated) {
    return { status: 'lease_lost', attempts: nextAttempts }
  }

  logger.warn('Rescheduled Mothership billing callback outbox event', {
    eventId: event.id,
    attempts: nextAttempts,
    availableAt: availableAt.toISOString(),
    error: lastError,
    workspaceId: event.payload.workspaceId,
  })

  return {
    status: 'pending',
    availableAt,
    attempts: nextAttempts,
  }
}

type ParseMothershipBillingCallbackOutboxPayloadResult =
  | { success: true; payload: MothershipBillingCallbackOutboxPayload }
  | { success: false; error: string }

function parseMothershipBillingCallbackOutboxPayload(
  payload: unknown
): ParseMothershipBillingCallbackOutboxPayloadResult {
  const parsed = billingUpdateCostBodySchema.safeParse(payload)
  if (!parsed.success) {
    return {
      success: false,
      error: `${INVALID_PAYLOAD_LAST_ERROR}: ${parsed.error.issues
        .map((issue) => {
          const path = issue.path.join('.')
          return path ? `${path} ${issue.message}` : issue.message
        })
        .join('; ')}`,
    }
  }

  if (!parsed.data.workspaceId) {
    return { success: false, error: `${INVALID_PAYLOAD_LAST_ERROR}: workspaceId is required` }
  }
  if (!parsed.data.idempotencyKey) {
    return { success: false, error: `${INVALID_PAYLOAD_LAST_ERROR}: idempotencyKey is required` }
  }

  return {
    success: true,
    payload: {
      cost: parsed.data.cost,
      idempotencyKey: parsed.data.idempotencyKey,
      inputTokens: parsed.data.inputTokens,
      model: parsed.data.model,
      outputTokens: parsed.data.outputTokens,
      source: parsed.data.source,
      userId: parsed.data.userId,
      workspaceId: parsed.data.workspaceId,
    },
  }
}

async function deadLetterInvalidMothershipBillingCallbackOutboxEvent(
  row: OutboxRow,
  error: string,
  client: Pick<typeof db, 'update'>
): Promise<boolean> {
  const updated = await client
    .update(outboxEvent)
    .set({
      attempts: row.attempts + 1,
      status: 'dead_letter',
      lockedAt: null,
      processedAt: new Date(),
      lastError: truncate(error, MAX_LAST_ERROR_LENGTH),
    })
    .where(
      and(
        eq(outboxEvent.id, row.id),
        eq(outboxEvent.eventType, MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE),
        eq(outboxEvent.status, row.status)
      )
    )
    .returning({ id: outboxEvent.id })

  if (updated.length > 0) {
    logger.error('Dead-lettered invalid Mothership billing callback outbox payload', {
      eventId: row.id,
      error,
    })
  }

  return updated.length > 0
}

function toClaimedEvent(
  row: OutboxRow & { lockedAt: Date; status: ClaimedOutboxStatus },
  payload: MothershipBillingCallbackOutboxPayload
): MothershipBillingCallbackOutboxEvent {
  return {
    ...row,
    eventType: MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE,
    lockedAt: row.lockedAt,
    payload,
    status: 'processing',
  }
}

async function updateClaimedMothershipBillingCallbackOutboxEvent(
  event: MothershipBillingCallbackOutboxEvent,
  patch: {
    attempts?: number
    availableAt?: Date
    lastError?: string | null
    lockedAt: Date | null
    processedAt?: Date | null
    status: TerminalOutboxStatus | 'pending'
  },
  client: Pick<typeof db, 'update'>
): Promise<boolean> {
  const updated = await client
    .update(outboxEvent)
    .set(patch)
    .where(
      and(
        eq(outboxEvent.id, event.id),
        eq(outboxEvent.status, 'processing'),
        eq(outboxEvent.lockedAt, event.lockedAt)
      )
    )
    .returning({ id: outboxEvent.id })

  return updated.length > 0
}
