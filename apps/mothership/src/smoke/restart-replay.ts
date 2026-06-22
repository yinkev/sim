import type { Server } from 'node:http'
import { MOTHERSHIP_RUNTIME_KEY_HEADER } from '@sim/mothership-contracts'
import { generateId, generateShortId } from '@sim/utils/id'
import postgres from 'postgres'
import { createMothershipApp, createMothershipNodeServer } from '@/server'

const RUNTIME_SECRET = 'runtime-secret-at-least-16'
const ADMIN_SECRET = 'admin-secret-at-least-16'

type SmokeServer = {
  baseUrl: string
  server: Server
}

type SmokeIds = {
  userId: string
  workspaceId: string
  chatId: string
  runId: string
  executionId: string
  streamId: string
  requestId: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the Mothership restart replay smoke')
  }
  return databaseUrl
}

function createIds(): SmokeIds {
  const suffix = generateShortId()
  return {
    userId: `mship-smoke-user-${suffix}`,
    workspaceId: `mship-smoke-workspace-${suffix}`,
    chatId: generateId(),
    runId: generateId(),
    executionId: `mship-smoke-exec-${suffix}`,
    streamId: `mship-smoke-stream-${suffix}`,
    requestId: `mship-smoke-request-${suffix}`,
  }
}

async function assertReplaySchemaExists(sql: postgres.Sql): Promise<void> {
  const [row] = await sql`
    select to_regclass('public.copilot_run_events') as events_table
  `
  assert(
    row?.events_table === 'copilot_run_events',
    'copilot_run_events is missing. Run packages/db migrations against this DATABASE_URL first.'
  )
}

function createTextEnvelope(ids: SmokeIds) {
  return {
    v: 1,
    seq: 1,
    ts: '2026-06-21T00:00:00.000Z',
    type: 'text',
    stream: {
      streamId: ids.streamId,
      cursor: '1',
    },
    trace: {
      requestId: ids.requestId,
    },
    payload: {
      channel: 'assistant',
      text: 'restart replay smoke',
    },
  }
}

function createCompleteEnvelope(ids: SmokeIds) {
  return {
    v: 1,
    seq: 2,
    ts: '2026-06-21T00:00:01.000Z',
    type: 'complete',
    stream: {
      streamId: ids.streamId,
      cursor: '2',
    },
    trace: {
      requestId: ids.requestId,
    },
    payload: {
      status: 'complete',
    },
  }
}

async function seedReplayRun(sql: postgres.Sql, ids: SmokeIds): Promise<void> {
  const textEnvelope = createTextEnvelope(ids)
  const completeEnvelope = createCompleteEnvelope(ids)

  await sql.begin(async (tx) => {
    await tx`
      insert into "user" (
        id,
        name,
        email,
        normalized_email,
        email_verified,
        created_at,
        updated_at
      )
      values (
        ${ids.userId},
        'Mothership Smoke User',
        ${`${ids.userId}@example.test`},
        ${`${ids.userId}@example.test`},
        true,
        now(),
        now()
      )
    `
    await tx`
      insert into workspace (
        id,
        name,
        owner_id,
        billed_account_user_id,
        created_at,
        updated_at
      )
      values (
        ${ids.workspaceId},
        'Mothership Smoke Workspace',
        ${ids.userId},
        ${ids.userId},
        now(),
        now()
      )
    `
    await tx`
      insert into copilot_chats (
        id,
        user_id,
        workspace_id,
        type,
        title,
        conversation_id,
        created_at,
        updated_at
      )
      values (
        ${ids.chatId},
        ${ids.userId},
        ${ids.workspaceId},
        'copilot',
        'Mothership restart replay smoke',
        ${ids.streamId},
        now(),
        now()
      )
    `
    await tx`
      insert into copilot_runs (
        id,
        execution_id,
        chat_id,
        user_id,
        workspace_id,
        stream_id,
        status,
        request_context,
        started_at,
        completed_at,
        created_at,
        updated_at
      )
      values (
        ${ids.runId},
        ${ids.executionId},
        ${ids.chatId},
        ${ids.userId},
        ${ids.workspaceId},
        ${ids.streamId},
        'complete',
        ${tx.json({ requestId: ids.requestId })},
        now(),
        now(),
        now(),
        now()
      )
    `
    await tx`
      insert into copilot_run_events (
        run_id,
        stream_id,
        seq,
        cursor,
        event_type,
        request_id,
        envelope
      )
      values
        (
          ${ids.runId},
          ${ids.streamId},
          1,
          '1',
          'text',
          ${ids.requestId},
          ${tx.json(textEnvelope)}
        ),
        (
          ${ids.runId},
          ${ids.streamId},
          2,
          '2',
          'complete',
          ${ids.requestId},
          ${tx.json(completeEnvelope)}
        )
    `
  })
}

async function cleanupReplayRun(sql: postgres.Sql, ids: SmokeIds): Promise<void> {
  await sql`delete from workspace where id = ${ids.workspaceId}`.catch(() => {})
  await sql`delete from "user" where id = ${ids.userId}`.catch(() => {})
}

async function startServer(): Promise<SmokeServer> {
  const app = createMothershipApp({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 0,
    SIM_TO_MOTHERSHIP_API_KEY: RUNTIME_SECRET,
    MOTHERSHIP_ADMIN_API_KEY: ADMIN_SECRET,
  })
  const server = createMothershipNodeServer(app)

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  assert(address && typeof address === 'object', 'Mothership smoke server did not bind to a port')
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  }
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

async function replayBatch(baseUrl: string, ids: SmokeIds, after: string): Promise<unknown> {
  const url = new URL('/api/streams/replay', baseUrl)
  url.searchParams.set('streamId', ids.streamId)
  url.searchParams.set('userId', ids.userId)
  url.searchParams.set('after', after)
  url.searchParams.set('batch', 'true')

  const response = await fetch(url, {
    headers: {
      [MOTHERSHIP_RUNTIME_KEY_HEADER]: RUNTIME_SECRET,
    },
  })
  if (!response.ok) {
    throw new Error(`Replay batch failed with ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

function assertBatchPayload(payload: unknown, expectedEventCount: number): void {
  assert(payload && typeof payload === 'object', 'Replay payload is not an object')
  const record = payload as { events?: unknown[]; status?: unknown }
  assert(Array.isArray(record.events), 'Replay payload events is not an array')
  assert(
    record.events.length === expectedEventCount,
    `Expected ${expectedEventCount} replay events, received ${record.events.length}`
  )
  assert(record.status === 'complete', `Expected run status complete, received ${record.status}`)
}

async function main(): Promise<void> {
  const databaseUrl = requireDatabaseUrl()
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 5 })
  const ids = createIds()

  try {
    await assertReplaySchemaExists(sql)
    await seedReplayRun(sql, ids)

    const firstServer = await startServer()
    try {
      assertBatchPayload(await replayBatch(firstServer.baseUrl, ids, '0'), 2)
    } finally {
      await stopServer(firstServer.server)
    }

    const restartedServer = await startServer()
    try {
      assertBatchPayload(await replayBatch(restartedServer.baseUrl, ids, '1'), 1)
    } finally {
      await stopServer(restartedServer.server)
    }

    console.log('Mothership restart replay smoke passed')
  } finally {
    await cleanupReplayRun(sql, ids)
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
