import { createLogger } from '@sim/logger'
import { sleep } from '@sim/utils/helpers'
import { generateShortId } from '@sim/utils/id'
import postgres from 'postgres'

const logger = createLogger('MothershipCallbackOutboxConcurrencySmoke')

const CLAIM_TIMEOUT_MS = 3_000

interface BillingPayload {
  [key: string]: number | string
  cost: number
  idempotencyKey: string
  inputTokens: number
  model: string
  outputTokens: number
  source: 'copilot'
  userId: string
  workspaceId: string
}

interface SmokeIds {
  lockedFirstEventId: string
  secondEventId: string
  userId: string
  workspaceId: string
}

interface OutboxRow {
  attempts: number
  available_at: Date
  event_type: string
  id: string
  last_error: string | null
  locked_at: Date | null
  max_attempts: number
  processed_at: Date | null
  status: string
}

interface Deferred<T> {
  promise: Promise<T>
  reject: (error: unknown) => void
  resolve: (value: T) => void
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the billing callback outbox concurrency smoke')
  }
  return databaseUrl
}

function createIds(): SmokeIds {
  const suffix = generateShortId()
  return {
    lockedFirstEventId: `mship-outbox-smoke-locked-${suffix}`,
    secondEventId: `mship-outbox-smoke-second-${suffix}`,
    userId: `mship-outbox-smoke-user-${suffix}`,
    workspaceId: `mship-outbox-smoke-workspace-${suffix}`,
  }
}

function createPayload(ids: SmokeIds, label: string): BillingPayload {
  return {
    cost: 0.01,
    idempotencyKey: `mship-outbox-smoke:${ids.workspaceId}:${label}`,
    inputTokens: 10,
    model: 'claude-3-5-sonnet-20241022',
    outputTokens: 5,
    source: 'copilot',
    userId: ids.userId,
    workspaceId: ids.workspaceId,
  }
}

async function assertOutboxSchemaExists(sql: postgres.Sql): Promise<void> {
  const [row] = await sql<{ outbox_table: string | null }[]>`
    select to_regclass('public.outbox_event') as outbox_table
  `
  assert(
    row?.outbox_table === 'outbox_event',
    'outbox_event is missing. Run packages/db migrations against this DATABASE_URL first.'
  )
}

async function seedOutboxRows(sql: postgres.Sql, ids: SmokeIds, eventType: string): Promise<void> {
  const now = Date.now()
  await sql.begin(async (tx) => {
    await tx`
      insert into outbox_event (
        id,
        event_type,
        payload,
        status,
        attempts,
        max_attempts,
        available_at,
        created_at
      )
      values
        (
          ${ids.lockedFirstEventId},
          ${eventType},
          ${tx.json(createPayload(ids, 'locked-first'))},
          'pending',
          0,
          10,
          ${new Date(now - 1_000)},
          ${new Date(now - 2_000)}
        ),
        (
          ${ids.secondEventId},
          ${eventType},
          ${tx.json(createPayload(ids, 'second'))},
          'pending',
          0,
          10,
          ${new Date(now - 1_000)},
          ${new Date(now - 1_000)}
        )
    `
  })
}

async function getOutboxRow(sql: postgres.Sql, id: string): Promise<OutboxRow> {
  const [row] = await sql<OutboxRow[]>`
    select
      id,
      event_type,
      status,
      attempts,
      max_attempts,
      available_at,
      locked_at,
      last_error,
      processed_at
    from outbox_event
    where id = ${id}
  `
  assert(row, `Expected outbox row ${id} to exist`)
  return row
}

async function cleanupOutboxRows(sql: postgres.Sql, ids: SmokeIds): Promise<void> {
  await sql`
    delete from outbox_event
    where id in (${ids.lockedFirstEventId}, ${ids.secondEventId})
  `
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from outbox_event
    where id in (${ids.lockedFirstEventId}, ${ids.secondEventId})
  `
  assert(row?.count === 0, `Expected smoke cleanup to remove all rows, found ${row?.count ?? 0}`)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  const result = await Promise.race([
    promise.then((value) => ({ timedOut: false as const, value })),
    sleep(timeoutMs).then(() => ({ timedOut: true as const })),
  ])

  if (result.timedOut) {
    throw new Error(message)
  }

  return result.value
}

async function main(): Promise<void> {
  const databaseUrl = requireDatabaseUrl()
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 5 })
  const lockSql = postgres(databaseUrl, { max: 1, connect_timeout: 5 })
  const ids = createIds()
  let smokeError: unknown
  let smokeResult: { completedEventId: string; retriedEventId: string } | null = null
  const {
    claimNextMothershipBillingCallbackOutboxEvent,
    completeMothershipBillingCallbackOutboxEvent,
    MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES,
    recordMothershipBillingCallbackOutboxFailure,
  } = await import('@/state/callback-outbox')

  try {
    await assertOutboxSchemaExists(sql)
    await seedOutboxRows(sql, ids, MOTHERSHIP_CALLBACK_OUTBOX_EVENT_TYPES.BILLING_USAGE)

    const lockReady = createDeferred<void>()
    const releaseLock = createDeferred<void>()
    const lockTransaction = lockSql.begin(async (tx) => {
      try {
        await tx`
          select id
          from outbox_event
          where id = ${ids.lockedFirstEventId}
          for update
        `
        lockReady.resolve(undefined)
        await releaseLock.promise
      } catch (error) {
        lockReady.reject(error)
        throw error
      }
    })

    let skipLockedClaim: Awaited<ReturnType<typeof claimNextMothershipBillingCallbackOutboxEvent>>
    let skipLockedClaimPromise:
      | ReturnType<typeof claimNextMothershipBillingCallbackOutboxEvent>
      | undefined

    try {
      await lockReady.promise
      skipLockedClaimPromise = claimNextMothershipBillingCallbackOutboxEvent()
      skipLockedClaim = await withTimeout(
        skipLockedClaimPromise,
        CLAIM_TIMEOUT_MS,
        'Claiming the next billing callback outbox row blocked behind a locked row instead of using SKIP LOCKED.'
      )
    } finally {
      releaseLock.resolve(undefined)
      await lockTransaction
      if (skipLockedClaimPromise) {
        await skipLockedClaimPromise.catch(() => {})
      }
    }

    assert(skipLockedClaim.status === 'claimed', 'Expected the unlocked second row to be claimed')
    assert(
      skipLockedClaim.event.id === ids.secondEventId,
      `Expected SKIP LOCKED claim to choose ${ids.secondEventId}, received ${skipLockedClaim.event.id}`
    )

    const secondProcessing = await getOutboxRow(sql, ids.secondEventId)
    assert(secondProcessing.status === 'processing', 'Expected second row to be processing')
    assert(secondProcessing.locked_at instanceof Date, 'Expected second row to have a real lock')

    const staleCompleteEvent = {
      ...skipLockedClaim.event,
      lockedAt: new Date(skipLockedClaim.event.lockedAt.getTime() - 1_000),
    }
    const staleCompleteResult =
      await completeMothershipBillingCallbackOutboxEvent(staleCompleteEvent)
    assert(staleCompleteResult === false, 'Expected complete with a stale lease to be rejected')

    const afterStaleComplete = await getOutboxRow(sql, ids.secondEventId)
    assert(
      afterStaleComplete.status === 'processing',
      'Expected stale complete attempt to leave second row processing'
    )

    const completed = await completeMothershipBillingCallbackOutboxEvent(skipLockedClaim.event)
    assert(completed === true, 'Expected complete with the current lease to succeed')

    const completedRow = await getOutboxRow(sql, ids.secondEventId)
    assert(completedRow.status === 'completed', 'Expected second row to be completed')
    assert(completedRow.locked_at === null, 'Expected completed row lock to be cleared')
    assert(completedRow.processed_at instanceof Date, 'Expected completed row processed_at')

    const firstClaim = await claimNextMothershipBillingCallbackOutboxEvent()
    assert(firstClaim.status === 'claimed', 'Expected first row to be claimable after lock release')
    assert(
      firstClaim.event.id === ids.lockedFirstEventId,
      `Expected first claim to choose ${ids.lockedFirstEventId}, received ${firstClaim.event.id}`
    )

    const staleRetryEvent = {
      ...firstClaim.event,
      lockedAt: new Date(firstClaim.event.lockedAt.getTime() - 1_000),
    }
    const staleRetryResult = await recordMothershipBillingCallbackOutboxFailure(
      staleRetryEvent,
      new Error('stale lease smoke')
    )
    assert(
      staleRetryResult.status === 'lease_lost',
      `Expected stale retry to return lease_lost, received ${staleRetryResult.status}`
    )

    const afterStaleRetry = await getOutboxRow(sql, ids.lockedFirstEventId)
    assert(
      afterStaleRetry.status === 'processing',
      'Expected stale retry attempt to leave first row processing'
    )
    assert(afterStaleRetry.attempts === 0, 'Expected stale retry attempt not to increment attempts')

    const retryResult = await recordMothershipBillingCallbackOutboxFailure(
      firstClaim.event,
      new Error('retry smoke')
    )
    assert(
      retryResult.status === 'pending',
      `Expected retry to reschedule, got ${retryResult.status}`
    )
    assert(retryResult.attempts === 1, 'Expected retry to increment attempts once')

    const retriedRow = await getOutboxRow(sql, ids.lockedFirstEventId)
    assert(retriedRow.status === 'pending', 'Expected first row to be pending after retry')
    assert(retriedRow.attempts === 1, 'Expected first row attempts to be 1')
    assert(retriedRow.locked_at === null, 'Expected retried row lock to be cleared')
    assert(retriedRow.last_error === 'retry smoke', 'Expected retried row to persist last_error')
    assert(retriedRow.available_at > new Date(), 'Expected retried row to be delayed')

    smokeResult = {
      completedEventId: ids.secondEventId,
      retriedEventId: ids.lockedFirstEventId,
    }
  } catch (error) {
    smokeError = error
  }

  let cleanupError: unknown
  try {
    await cleanupOutboxRows(sql, ids)
  } catch (error) {
    cleanupError = error
  }
  await sql.end({ timeout: 5 })
  await lockSql.end({ timeout: 5 })

  if (cleanupError) {
    if (smokeError) {
      logger.error('Failed to clean up Mothership billing callback outbox smoke rows', cleanupError)
    } else {
      throw cleanupError
    }
  }
  if (smokeError) throw smokeError

  assert(smokeResult, 'Expected smoke result after successful cleanup')
  logger.info('Mothership billing callback outbox concurrency smoke passed', smokeResult)
}

main().catch((error) => {
  logger.error('Mothership billing callback outbox concurrency smoke failed', error)
  process.exit(1)
})
