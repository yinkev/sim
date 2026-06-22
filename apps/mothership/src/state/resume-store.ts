import { db } from '@sim/db'
import {
  type CopilotAsyncToolStatus,
  type CopilotRunStatus,
  copilotAsyncToolCalls,
  copilotRunCheckpoints,
  copilotRuns,
} from '@sim/db/schema'
import type { ResumeToolsBody } from '@sim/mothership-contracts/routes'
import { generateId } from '@sim/utils/id'
import { isRecordLike, sortObjectKeysDeep } from '@sim/utils/object'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { getLatestMothershipRunEventSeq } from '@/state/stream-event-store'

type MothershipDbClient = Pick<typeof db, 'insert' | 'select' | 'update'>
type ResumeToolResult = ResumeToolsBody['results'][number]

const RESUMABLE_RUN_STATUSES = [
  'paused_waiting_for_tool',
] as const satisfies readonly CopilotRunStatus[]

const MUTABLE_TOOL_STATUSES = [
  'pending',
  'running',
] as const satisfies readonly CopilotAsyncToolStatus[]
const TERMINAL_TOOL_STATUSES = [
  'completed',
  'failed',
  'cancelled',
] as const satisfies readonly CopilotAsyncToolStatus[]
const RESUMABLE_RUN_STATUS_SET = new Set<CopilotRunStatus>(RESUMABLE_RUN_STATUSES)
const TERMINAL_TOOL_STATUS_SET = new Set<CopilotAsyncToolStatus>(TERMINAL_TOOL_STATUSES)

class ResumeStoreRollback extends Error {
  constructor(readonly result: RecordResumeResultsResult) {
    super('Mothership resume store rollback')
    this.name = 'ResumeStoreRollback'
  }
}

export interface MothershipResumeLookup {
  streamId: string
  checkpointId: string
  userId: string
  workspaceId?: string
}

export interface MothershipResumeCheckpointRecord {
  checkpointId: string
  runId: string
  streamId: string
  userId: string
  workspaceId: string | null
  runStatus: CopilotRunStatus
  pendingToolCallId: string
  conversationSnapshot: unknown
  agentState: unknown
  providerRequest: unknown
  resumeEventStartSeq: number | null
  toolCalls: MothershipResumeToolCallRecord[]
}

export interface MothershipResumeToolCallRecord {
  id: string
  runId: string
  checkpointId: string | null
  toolCallId: string
  toolName: string
  status: CopilotAsyncToolStatus
  result: unknown
  error: string | null
  completedAt: Date | null
}

export interface CreateMothershipToolCheckpointInput {
  runId: string
  pendingToolCalls: Array<{
    args: Record<string, unknown>
    toolCallId: string
    toolName: string
  }>
  conversationSnapshot?: unknown
  agentState?: unknown
  providerRequest: unknown
}

export type CreateMothershipToolCheckpointResult =
  | {
      status: 'ready'
      checkpointId: string
      pendingToolCallIds: string[]
    }
  | { status: 'missing_tool_calls' }
  | { status: 'run_not_checkpointable' }

export type RecordResumeResultsResult =
  | {
      status: 'ready'
      checkpoint: MothershipResumeCheckpointRecord
      recordedResults: MothershipResumeToolCallRecord[]
      resumeEventStartSeq: number
    }
  | { status: 'missing_checkpoint' }
  | {
      status: 'run_not_resumable'
      checkpoint: MothershipResumeCheckpointRecord
      runStatus: CopilotRunStatus
    }
  | {
      status: 'invalid_results'
      checkpoint: MothershipResumeCheckpointRecord
      reason: 'duplicate_result' | 'unknown_tool_call' | 'missing_tool_result' | 'missing_tool_rows'
      toolCallIds: string[]
    }
  | {
      status: 'checkpoint_already_consumed'
      checkpoint: MothershipResumeCheckpointRecord
      toolCallIds: string[]
    }
  | {
      status: 'result_conflict'
      checkpoint: MothershipResumeCheckpointRecord
      toolCallIds: string[]
    }

function isResumableRunStatus(status: CopilotRunStatus): boolean {
  return RESUMABLE_RUN_STATUS_SET.has(status)
}

function isTerminalToolStatus(status: CopilotAsyncToolStatus): boolean {
  return TERMINAL_TOOL_STATUS_SET.has(status)
}

function resultStatus(
  result: ResumeToolResult
): Extract<CopilotAsyncToolStatus, 'completed' | 'failed' | 'cancelled'> {
  if (result.success) return 'completed'
  if (isRecordLike(result.data) && result.data.cancelled === true) return 'cancelled'
  return 'failed'
}

function resultError(result: ResumeToolResult): string | null {
  if (result.success) return null
  if (typeof result.data === 'string' && result.data.trim()) return result.data
  if (isRecordLike(result.data)) {
    if (typeof result.data.error === 'string' && result.data.error.trim()) return result.data.error
    if (typeof result.data.message === 'string' && result.data.message.trim())
      return result.data.message
    if (result.data.cancelled === true) return 'Tool cancelled'
  }
  return 'tool_result_failed'
}

function storedResultFor(result: ResumeToolResult): unknown {
  return result.data ?? null
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(sortObjectKeysDeep(left)) === JSON.stringify(sortObjectKeysDeep(right))
  } catch {
    return Object.is(left, right)
  }
}

function terminalResultMatches(
  tool: MothershipResumeToolCallRecord,
  result: ResumeToolResult
): boolean {
  return (
    tool.status === resultStatus(result) &&
    jsonValuesEqual(tool.result ?? null, storedResultFor(result)) &&
    (tool.error ?? null) === resultError(result)
  )
}

function duplicateCallIds(results: ResumeToolResult[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const result of results) {
    if (seen.has(result.callId)) duplicates.add(result.callId)
    seen.add(result.callId)
  }
  return [...duplicates]
}

async function listCheckpointToolCalls(
  checkpointId: string,
  client: MothershipDbClient
): Promise<MothershipResumeToolCallRecord[]> {
  return client
    .select({
      id: copilotAsyncToolCalls.id,
      runId: copilotAsyncToolCalls.runId,
      checkpointId: copilotAsyncToolCalls.checkpointId,
      toolCallId: copilotAsyncToolCalls.toolCallId,
      toolName: copilotAsyncToolCalls.toolName,
      status: copilotAsyncToolCalls.status,
      result: copilotAsyncToolCalls.result,
      error: copilotAsyncToolCalls.error,
      completedAt: copilotAsyncToolCalls.completedAt,
    })
    .from(copilotAsyncToolCalls)
    .where(eq(copilotAsyncToolCalls.checkpointId, checkpointId))
}

export async function getMothershipResumeCheckpoint(
  input: MothershipResumeLookup,
  client: MothershipDbClient = db
): Promise<MothershipResumeCheckpointRecord | null> {
  const conditions = [
    eq(copilotRunCheckpoints.id, input.checkpointId),
    eq(copilotRuns.streamId, input.streamId),
    eq(copilotRuns.userId, input.userId),
  ]
  if (input.workspaceId) {
    conditions.push(eq(copilotRuns.workspaceId, input.workspaceId))
  }

  const [checkpoint] = await client
    .select({
      checkpointId: copilotRunCheckpoints.id,
      runId: copilotRunCheckpoints.runId,
      streamId: copilotRuns.streamId,
      userId: copilotRuns.userId,
      workspaceId: copilotRuns.workspaceId,
      runStatus: copilotRuns.status,
      pendingToolCallId: copilotRunCheckpoints.pendingToolCallId,
      conversationSnapshot: copilotRunCheckpoints.conversationSnapshot,
      agentState: copilotRunCheckpoints.agentState,
      providerRequest: copilotRunCheckpoints.providerRequest,
      resumeEventStartSeq: copilotRunCheckpoints.resumeEventStartSeq,
    })
    .from(copilotRunCheckpoints)
    .innerJoin(copilotRuns, eq(copilotRunCheckpoints.runId, copilotRuns.id))
    .where(and(...conditions))
    .limit(1)

  if (!checkpoint) return null

  return {
    ...checkpoint,
    toolCalls: await listCheckpointToolCalls(checkpoint.checkpointId, client),
  }
}

async function markRunResuming(runId: string, client: MothershipDbClient): Promise<boolean> {
  const [run] = await client
    .update(copilotRuns)
    .set({
      status: 'resuming',
      updatedAt: new Date(),
    })
    .where(and(eq(copilotRuns.id, runId), inArray(copilotRuns.status, RESUMABLE_RUN_STATUSES)))
    .returning({ id: copilotRuns.id })

  return !!run
}

export async function createMothershipToolCheckpoint(
  input: CreateMothershipToolCheckpointInput
): Promise<CreateMothershipToolCheckpointResult> {
  if (input.pendingToolCalls.length === 0) return { status: 'missing_tool_calls' }

  return db.transaction(async (tx) => {
    const checkpointId = generateId()
    const primaryToolCallId = input.pendingToolCalls[0]!.toolCallId
    const now = new Date()

    const [checkpoint] = await tx
      .insert(copilotRunCheckpoints)
      .values({
        id: checkpointId,
        runId: input.runId,
        pendingToolCallId: primaryToolCallId,
        conversationSnapshot: input.conversationSnapshot ?? {},
        agentState: input.agentState ?? {},
        providerRequest: input.providerRequest,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [copilotRunCheckpoints.runId, copilotRunCheckpoints.pendingToolCallId],
      })
      .returning({ id: copilotRunCheckpoints.id })

    if (!checkpoint) return { status: 'run_not_checkpointable' }

    await tx
      .insert(copilotAsyncToolCalls)
      .values(
        input.pendingToolCalls.map((toolCall) => ({
          id: generateId(),
          runId: input.runId,
          checkpointId,
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          args: toolCall.args,
          status: 'running' as const,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .onConflictDoNothing({ target: copilotAsyncToolCalls.toolCallId })

    return {
      status: 'ready',
      checkpointId,
      pendingToolCallIds: input.pendingToolCalls.map((toolCall) => toolCall.toolCallId),
    }
  })
}

export async function getOrSetMothershipResumeEventStartSeq(
  input: {
    checkpointId: string
    runId: string
    proposedStartSeq: number
  },
  client: MothershipDbClient = db
): Promise<number> {
  if (!Number.isInteger(input.proposedStartSeq) || input.proposedStartSeq < 0) {
    throw new Error(`Invalid Mothership resume start seq ${input.proposedStartSeq}`)
  }

  const [updated] = await client
    .update(copilotRunCheckpoints)
    .set({
      resumeEventStartSeq: input.proposedStartSeq,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(copilotRunCheckpoints.id, input.checkpointId),
        eq(copilotRunCheckpoints.runId, input.runId),
        isNull(copilotRunCheckpoints.resumeEventStartSeq)
      )
    )
    .returning({ resumeEventStartSeq: copilotRunCheckpoints.resumeEventStartSeq })

  if (typeof updated?.resumeEventStartSeq === 'number') {
    return updated.resumeEventStartSeq
  }

  const [checkpoint] = await client
    .select({ resumeEventStartSeq: copilotRunCheckpoints.resumeEventStartSeq })
    .from(copilotRunCheckpoints)
    .where(
      and(
        eq(copilotRunCheckpoints.id, input.checkpointId),
        eq(copilotRunCheckpoints.runId, input.runId)
      )
    )
    .limit(1)

  if (typeof checkpoint?.resumeEventStartSeq === 'number') {
    return checkpoint.resumeEventStartSeq
  }

  throw new Error(`Mothership resume checkpoint ${input.checkpointId} is missing start seq`)
}

async function recordToolResult(
  checkpointId: string,
  result: ResumeToolResult,
  client: MothershipDbClient
): Promise<MothershipResumeToolCallRecord | null> {
  const status = resultStatus(result)
  const [row] = await client
    .update(copilotAsyncToolCalls)
    .set({
      status,
      result: storedResultFor(result),
      error: resultError(result),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(copilotAsyncToolCalls.checkpointId, checkpointId),
        eq(copilotAsyncToolCalls.toolCallId, result.callId),
        inArray(copilotAsyncToolCalls.status, MUTABLE_TOOL_STATUSES)
      )
    )
    .returning({
      id: copilotAsyncToolCalls.id,
      runId: copilotAsyncToolCalls.runId,
      checkpointId: copilotAsyncToolCalls.checkpointId,
      toolCallId: copilotAsyncToolCalls.toolCallId,
      toolName: copilotAsyncToolCalls.toolName,
      status: copilotAsyncToolCalls.status,
      result: copilotAsyncToolCalls.result,
      error: copilotAsyncToolCalls.error,
      completedAt: copilotAsyncToolCalls.completedAt,
    })

  return row ?? null
}

export async function recordMothershipResumeToolResults(
  input: MothershipResumeLookup & { results: ResumeToolResult[] }
): Promise<RecordResumeResultsResult> {
  try {
    return await db.transaction(async (tx) => {
      const checkpoint = await getMothershipResumeCheckpoint(input, tx)
      if (!checkpoint) return { status: 'missing_checkpoint' }

      if (!isResumableRunStatus(checkpoint.runStatus)) {
        return {
          status: 'run_not_resumable',
          checkpoint,
          runStatus: checkpoint.runStatus,
        }
      }

      if (checkpoint.toolCalls.length === 0) {
        return {
          status: 'invalid_results',
          checkpoint,
          reason: 'missing_tool_rows',
          toolCallIds: [checkpoint.pendingToolCallId],
        }
      }

      const duplicates = duplicateCallIds(input.results)
      if (duplicates.length > 0) {
        return {
          status: 'invalid_results',
          checkpoint,
          reason: 'duplicate_result',
          toolCallIds: duplicates,
        }
      }

      const resultsById = new Map(input.results.map((result) => [result.callId, result]))
      const toolsById = new Map(checkpoint.toolCalls.map((tool) => [tool.toolCallId, tool]))
      const unknownToolIds = input.results
        .map((result) => result.callId)
        .filter((toolCallId) => !toolsById.has(toolCallId))
      if (unknownToolIds.length > 0) {
        return {
          status: 'invalid_results',
          checkpoint,
          reason: 'unknown_tool_call',
          toolCallIds: unknownToolIds,
        }
      }

      const missingToolIds = checkpoint.toolCalls
        .map((tool) => tool.toolCallId)
        .filter((toolCallId) => !resultsById.has(toolCallId))
      if (missingToolIds.length > 0) {
        return {
          status: 'invalid_results',
          checkpoint,
          reason: 'missing_tool_result',
          toolCallIds: missingToolIds,
        }
      }

      const deliveredToolIds = checkpoint.toolCalls
        .filter((tool) => tool.status === 'delivered')
        .map((tool) => tool.toolCallId)
      if (deliveredToolIds.length > 0) {
        return {
          status: 'checkpoint_already_consumed',
          checkpoint,
          toolCallIds: deliveredToolIds,
        }
      }

      const conflictingToolIds = checkpoint.toolCalls
        .filter((tool) => {
          const result = resultsById.get(tool.toolCallId)
          return (
            !!result && isTerminalToolStatus(tool.status) && !terminalResultMatches(tool, result)
          )
        })
        .map((tool) => tool.toolCallId)
      if (conflictingToolIds.length > 0) {
        return {
          status: 'result_conflict',
          checkpoint,
          toolCallIds: conflictingToolIds,
        }
      }

      const runUpdated = await markRunResuming(checkpoint.runId, tx)
      if (!runUpdated) {
        return {
          status: 'run_not_resumable',
          checkpoint,
          runStatus: checkpoint.runStatus,
        }
      }

      const recordedResults: MothershipResumeToolCallRecord[] = []
      for (const result of input.results) {
        const existing = toolsById.get(result.callId)
        if (!existing) continue
        if (isTerminalToolStatus(existing.status)) {
          recordedResults.push(existing)
          continue
        }

        const recorded = await recordToolResult(checkpoint.checkpointId, result, tx)
        if (!recorded) {
          throw new ResumeStoreRollback({
            status: 'result_conflict',
            checkpoint,
            toolCallIds: [result.callId],
          })
        }
        recordedResults.push(recorded)
      }

      const proposedStartSeq = await getLatestMothershipRunEventSeq(
        { streamId: input.streamId },
        tx
      )
      const resumeEventStartSeq = await getOrSetMothershipResumeEventStartSeq(
        {
          checkpointId: checkpoint.checkpointId,
          runId: checkpoint.runId,
          proposedStartSeq,
        },
        tx
      )

      return {
        status: 'ready',
        checkpoint: {
          ...checkpoint,
          resumeEventStartSeq,
        },
        recordedResults,
        resumeEventStartSeq,
      }
    })
  } catch (error) {
    if (error instanceof ResumeStoreRollback) return error.result
    throw error
  }
}

export async function markMothershipResumeToolResultDelivered(
  input: {
    checkpointId: string
    toolCallId: string
  },
  client: MothershipDbClient = db
): Promise<MothershipResumeToolCallRecord | null> {
  const [row] = await client
    .update(copilotAsyncToolCalls)
    .set({
      status: 'delivered',
      claimedAt: null,
      claimedBy: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(copilotAsyncToolCalls.checkpointId, input.checkpointId),
        eq(copilotAsyncToolCalls.toolCallId, input.toolCallId),
        inArray(copilotAsyncToolCalls.status, TERMINAL_TOOL_STATUSES)
      )
    )
    .returning({
      id: copilotAsyncToolCalls.id,
      runId: copilotAsyncToolCalls.runId,
      checkpointId: copilotAsyncToolCalls.checkpointId,
      toolCallId: copilotAsyncToolCalls.toolCallId,
      toolName: copilotAsyncToolCalls.toolName,
      status: copilotAsyncToolCalls.status,
      result: copilotAsyncToolCalls.result,
      error: copilotAsyncToolCalls.error,
      completedAt: copilotAsyncToolCalls.completedAt,
    })

  return row ?? null
}
