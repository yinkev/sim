import { db } from '@sim/db'
import { type CopilotRunStatus, copilotRuns } from '@sim/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

const ABORTABLE_RUN_STATUSES = [
  'active',
  'paused_waiting_for_tool',
  'resuming',
] as const satisfies readonly CopilotRunStatus[]

const FAILABLE_RUN_STATUSES = [
  'active',
  'paused_waiting_for_tool',
  'resuming',
  'error',
] as const satisfies readonly CopilotRunStatus[]

const COMPLETABLE_RUN_STATUSES = [
  'active',
  'paused_waiting_for_tool',
  'resuming',
] as const satisfies readonly CopilotRunStatus[]

const PAUSABLE_RUN_STATUSES = ['active', 'resuming'] as const satisfies readonly CopilotRunStatus[]

export interface MothershipRunLookup {
  streamId: string
  userId: string
}

export interface MothershipRunRecord {
  id: string
  executionId: string
  parentRunId: string | null
  chatId: string
  streamId: string
  userId: string
  status: CopilotRunStatus
  completedAt: Date | null
  error: string | null
}

export interface MothershipRuntimeRunInput {
  runId: string
  executionId: string
  parentRunId?: string | null
  chatId: string
  userId: string
  workflowId?: string | null
  workspaceId?: string | null
  streamId: string
  model?: string | null
  provider?: string | null
  requestContext?: Record<string, unknown>
}

export type ClaimMothershipRuntimeRunResult =
  | { status: 'ready'; run: MothershipRunRecord }
  | { status: 'run_identity_conflict'; run: MothershipRunRecord }
  | { status: 'run_terminal'; run: MothershipRunRecord }
  | { status: 'stream_conflict'; run: MothershipRunRecord }

function selectRunFields() {
  return {
    id: copilotRuns.id,
    executionId: copilotRuns.executionId,
    parentRunId: copilotRuns.parentRunId,
    chatId: copilotRuns.chatId,
    streamId: copilotRuns.streamId,
    userId: copilotRuns.userId,
    status: copilotRuns.status,
    completedAt: copilotRuns.completedAt,
    error: copilotRuns.error,
  }
}

export async function getMothershipRunByStream(
  input: MothershipRunLookup
): Promise<MothershipRunRecord | null> {
  const [run] = await db
    .select(selectRunFields())
    .from(copilotRuns)
    .where(and(eq(copilotRuns.streamId, input.streamId), eq(copilotRuns.userId, input.userId)))
    .limit(1)

  return run ?? null
}

async function getMothershipRunByStreamId(streamId: string): Promise<MothershipRunRecord | null> {
  const [run] = await db
    .select(selectRunFields())
    .from(copilotRuns)
    .where(eq(copilotRuns.streamId, streamId))
    .limit(1)

  return run ?? null
}

export async function claimMothershipRuntimeRun(
  input: MothershipRuntimeRunInput
): Promise<ClaimMothershipRuntimeRunResult> {
  const existing = await getMothershipRunByStreamId(input.streamId)
  if (existing) {
    return classifyClaimedRuntimeRun(existing, input)
  }

  const now = new Date()
  const [inserted] = await db
    .insert(copilotRuns)
    .values({
      id: input.runId,
      executionId: input.executionId,
      parentRunId: input.parentRunId ?? null,
      chatId: input.chatId,
      userId: input.userId,
      workflowId: input.workflowId ?? null,
      workspaceId: input.workspaceId ?? null,
      streamId: input.streamId,
      model: input.model ?? null,
      provider: input.provider ?? null,
      requestContext: input.requestContext ?? {},
      status: 'active',
      startedAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: copilotRuns.streamId })
    .returning(selectRunFields())

  const run = inserted ?? (await getMothershipRunByStreamId(input.streamId))
  if (!run) {
    throw new Error(`Failed to claim Mothership runtime run for stream ${input.streamId}`)
  }

  return classifyClaimedRuntimeRun(run, input)
}

function classifyClaimedRuntimeRun(
  run: MothershipRunRecord,
  input: MothershipRuntimeRunInput
): ClaimMothershipRuntimeRunResult {
  const existingParentRunId = run.parentRunId ?? null
  const claimedParentRunId = input.parentRunId ?? null
  if (run.userId !== input.userId) {
    return { status: 'stream_conflict', run }
  }
  if (
    run.id !== input.runId ||
    run.executionId !== input.executionId ||
    existingParentRunId !== claimedParentRunId ||
    run.chatId !== input.chatId
  ) {
    return { status: 'run_identity_conflict', run }
  }
  if (run.status === 'complete' || run.status === 'cancelled' || run.status === 'error') {
    return { status: 'run_terminal', run }
  }
  return { status: 'ready', run }
}

export async function markMothershipRunCancelled(
  input: MothershipRunLookup & { reason?: string }
): Promise<MothershipRunRecord | null> {
  const now = new Date()
  const [run] = await db
    .update(copilotRuns)
    .set({
      status: 'cancelled',
      completedAt: now,
      updatedAt: now,
      error: input.reason ?? 'explicit_abort',
    })
    .where(
      and(
        eq(copilotRuns.streamId, input.streamId),
        eq(copilotRuns.userId, input.userId),
        inArray(copilotRuns.status, ABORTABLE_RUN_STATUSES)
      )
    )
    .returning(selectRunFields())

  return run ?? null
}

export async function markMothershipRunFailed(input: {
  runId: string
  error: string
}): Promise<MothershipRunRecord | null> {
  const now = new Date()
  const [run] = await db
    .update(copilotRuns)
    .set({
      status: 'error',
      completedAt: now,
      updatedAt: now,
      error: input.error,
    })
    .where(and(eq(copilotRuns.id, input.runId), inArray(copilotRuns.status, FAILABLE_RUN_STATUSES)))
    .returning(selectRunFields())

  return run ?? null
}

export async function markMothershipRunComplete(input: {
  runId: string
}): Promise<MothershipRunRecord | null> {
  const now = new Date()
  const [run] = await db
    .update(copilotRuns)
    .set({
      status: 'complete',
      completedAt: now,
      updatedAt: now,
      error: null,
    })
    .where(
      and(eq(copilotRuns.id, input.runId), inArray(copilotRuns.status, COMPLETABLE_RUN_STATUSES))
    )
    .returning(selectRunFields())

  return run ?? null
}

export async function markMothershipRunPausedForTool(input: {
  runId: string
}): Promise<MothershipRunRecord | null> {
  const [run] = await db
    .update(copilotRuns)
    .set({
      status: 'paused_waiting_for_tool',
      updatedAt: new Date(),
    })
    .where(and(eq(copilotRuns.id, input.runId), inArray(copilotRuns.status, PAUSABLE_RUN_STATUSES)))
    .returning(selectRunFields())

  return run ?? null
}
