import { type Context, context as otelContext, type Span, trace } from '@opentelemetry/api'
import { createLogger } from '@sim/logger'
import { streamReplayBatchContract } from '@sim/mothership-contracts/routes'
import { getErrorMessage } from '@sim/utils/errors'
import { sleep } from '@sim/utils/helpers'
import { type NextRequest, NextResponse } from 'next/server'
import { copilotChatStreamContract } from '@/lib/api/contracts/copilot'
import { parseRequest } from '@/lib/api/server'
import { getLatestRunForStream } from '@/lib/copilot/async-runs/repository'
import {
  MothershipStreamV1CompletionStatus,
  MothershipStreamV1EventType,
} from '@/lib/copilot/generated/mothership-stream-v1'
import {
  CopilotResumeOutcome,
  CopilotTransport,
} from '@/lib/copilot/generated/trace-attribute-values-v1'
import { TraceAttr } from '@/lib/copilot/generated/trace-attributes-v1'
import { TraceSpan } from '@/lib/copilot/generated/trace-spans-v1'
import { contextFromRequestHeaders } from '@/lib/copilot/request/go/propagation'
import { authenticateCopilotRequestSessionOnly } from '@/lib/copilot/request/http'
import { getCopilotTracer, markSpanForError } from '@/lib/copilot/request/otel'
import {
  checkForReplayGap,
  createEvent,
  encodeSSEComment,
  encodeSSEEnvelope,
  parsePersistedStreamEventEnvelope,
  readEvents,
  readFilePreviewSessions,
  SSE_RESPONSE_HEADERS,
} from '@/lib/copilot/request/session'
import type { StreamBatchEvent } from '@/lib/copilot/request/session/types'
import { toStreamBatchEvent } from '@/lib/copilot/request/session/types'
import { getMothershipBaseURL } from '@/lib/copilot/server/agent-url'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { requestMothershipRuntime } from '@/lib/mothership/client'
import { getMothershipRuntimeHeaderMode } from '@/lib/mothership/service-auth'

export const maxDuration = 3600

const logger = createLogger('CopilotChatStreamAPI')
const POLL_INTERVAL_MS = 250
const REPLAY_KEEPALIVE_INTERVAL_MS = 15_000
const MAX_STREAM_MS = 60 * 60 * 1000
const OWNED_REPLAY_PAGE_LIMIT = 1000

function extractCanonicalRequestId(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : ''
}

function extractRunRequestId(run: { requestContext?: unknown } | null | undefined): string {
  if (!run || typeof run.requestContext !== 'object' || run.requestContext === null) {
    return ''
  }
  const requestContext = run.requestContext as Record<string, unknown>
  return (
    extractCanonicalRequestId(requestContext.requestId) ||
    extractCanonicalRequestId(requestContext.simRequestId)
  )
}

function extractEnvelopeRequestId(envelope: { trace?: { requestId?: unknown } }): string {
  return extractCanonicalRequestId(envelope.trace?.requestId)
}

function isTerminalStatus(
  status: string | null | undefined
): status is MothershipStreamV1CompletionStatus {
  return (
    status === MothershipStreamV1CompletionStatus.complete ||
    status === MothershipStreamV1CompletionStatus.error ||
    status === MothershipStreamV1CompletionStatus.cancelled
  )
}

function buildResumeTerminalEnvelopes(options: {
  streamId: string
  afterCursor: string
  status: MothershipStreamV1CompletionStatus
  message?: string
  code: string
  reason?: string
  requestId?: string
}) {
  const baseSeq = Number(options.afterCursor || '0')
  const seq = Number.isFinite(baseSeq) ? baseSeq : 0
  const envelopes: ReturnType<typeof createEvent>[] = []
  const rid = options.requestId ?? ''

  if (options.status === MothershipStreamV1CompletionStatus.error) {
    envelopes.push(
      createEvent({
        streamId: options.streamId,
        cursor: String(seq + 1),
        seq: seq + 1,
        requestId: rid,
        type: MothershipStreamV1EventType.error,
        payload: {
          message: options.message || 'Stream recovery failed before completion.',
          code: options.code,
        },
      })
    )
  }

  envelopes.push(
    createEvent({
      streamId: options.streamId,
      cursor: String(seq + envelopes.length + 1),
      seq: seq + envelopes.length + 1,
      requestId: rid,
      type: MothershipStreamV1EventType.complete,
      payload: {
        status: options.status,
        ...(options.reason ? { reason: options.reason } : {}),
      },
    })
  )

  return envelopes
}

function shouldUseOwnedReplay(): boolean {
  return getMothershipRuntimeHeaderMode() === 'strict'
}

async function readReplayBatch(options: {
  streamId: string
  userId: string
  afterCursor: string
  rootContext: Context
}): Promise<{
  events: StreamBatchEvent[]
  status?: string
  chatId?: string
  source: 'local' | 'owned'
}> {
  const after = options.afterCursor || '0'

  if (!shouldUseOwnedReplay()) {
    const events = await readEvents(options.streamId, after)
    return {
      events: events.map(toStreamBatchEvent),
      source: 'local',
    }
  }

  const mothershipBaseURL = await getMothershipBaseURL({ userId: options.userId })
  const events: StreamBatchEvent[] = []
  let cursor = after
  let replayStatus: string | undefined
  let replayChatId: string | undefined

  for (;;) {
    const replay = await requestMothershipRuntime({
      contract: streamReplayBatchContract,
      baseUrl: mothershipBaseURL,
      input: {
        query: {
          streamId: options.streamId,
          userId: options.userId,
          after: cursor,
          batch: 'true',
          limit: OWNED_REPLAY_PAGE_LIMIT,
        },
      },
      spanName: 'sim -> mothership stream replay batch',
      operation: 'stream_replay_batch',
      userId: options.userId,
      otelContext: options.rootContext,
      attributes: {
        [TraceAttr.StreamId]: options.streamId,
        [TraceAttr.CopilotResumeAfterCursor]: cursor,
      },
    })

    replayStatus = replay.status
    replayChatId = replay.chatId

    let sawTerminalEvent = false
    let lastSeq = Number(cursor || '0')
    for (const event of replay.events) {
      const parsed = parsePersistedStreamEventEnvelope(event.event)
      if (!parsed.ok) {
        throw new Error(`Owned Mothership replay returned invalid stream event: ${parsed.message}`)
      }
      events.push({
        eventId: event.eventId,
        streamId: event.streamId,
        event: parsed.event,
      })
      lastSeq = parsed.event.seq
      if (parsed.event.type === MothershipStreamV1EventType.complete) {
        sawTerminalEvent = true
      }
    }

    if (replay.events.length < OWNED_REPLAY_PAGE_LIMIT || sawTerminalEvent) {
      break
    }

    const previousCursor = Number(cursor || '0')
    if (!Number.isFinite(previousCursor) || lastSeq <= previousCursor) {
      throw new Error('Owned Mothership replay did not advance its cursor')
    }
    cursor = String(lastSeq)
  }

  return {
    events,
    ...(replayStatus ? { status: replayStatus } : {}),
    ...(replayChatId ? { chatId: replayChatId } : {}),
    source: 'owned',
  }
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const { userId: authenticatedUserId, isAuthenticated } =
    await authenticateCopilotRequestSessionOnly()

  if (!isAuthenticated || !authenticatedUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseRequest(copilotChatStreamContract, request, {})
  if (!parsed.success) return parsed.response
  const { streamId, after: afterCursor, batch: batchMode } = parsed.data.query

  if (!streamId) {
    return NextResponse.json({ error: 'streamId is required' }, { status: 400 })
  }

  // Root span for the whole resume/reconnect request. In stream mode the
  // work happens inside `ReadableStream.start`, which the Node runtime
  // invokes after this function returns and OUTSIDE the AsyncLocalStorage
  // scope installed by `startActiveSpan`. We therefore start the span
  // manually, capture its context, and re-enter that context inside the
  // stream callback so every nested `withCopilotSpan` / `withDbSpan` call
  // attaches to this root.
  //
  // `contextFromRequestHeaders` extracts the W3C `traceparent` the
  // client echoed (set via `streamTraceparentRef` on Sim's chat POST
  // response), so the resume span becomes a child of the original
  // chat's `gen_ai.agent.execute` trace instead of a disconnected
  // new root. On reconnects after page reload (client ref was wiped)
  // the header is absent and extraction leaves the ambient context
  // alone → the resume span becomes its own root. Same as pre-
  // linking behavior; no regression.
  const incomingContext = contextFromRequestHeaders(request.headers)
  const rootSpan = getCopilotTracer().startSpan(
    TraceSpan.CopilotResumeRequest,
    {
      attributes: {
        [TraceAttr.CopilotTransport]: batchMode ? CopilotTransport.Batch : CopilotTransport.Stream,
        [TraceAttr.StreamId]: streamId,
        [TraceAttr.UserId]: authenticatedUserId,
        [TraceAttr.CopilotResumeAfterCursor]: afterCursor || '0',
      },
    },
    incomingContext
  )
  const rootContext = trace.setSpan(incomingContext, rootSpan)

  try {
    return await otelContext.with(rootContext, () =>
      handleResumeRequestBody({
        request,
        streamId,
        afterCursor,
        batchMode,
        authenticatedUserId,
        rootSpan,
        rootContext,
      })
    )
  } catch (err) {
    markSpanForError(rootSpan, err)
    rootSpan.end()
    throw err
  }
})

async function handleResumeRequestBody({
  request,
  streamId,
  afterCursor,
  batchMode,
  authenticatedUserId,
  rootSpan,
  rootContext,
}: {
  request: NextRequest
  streamId: string
  afterCursor: string
  batchMode: boolean
  authenticatedUserId: string
  rootSpan: Span
  rootContext: Context
}) {
  const run = await getLatestRunForStream(streamId, authenticatedUserId).catch((err) => {
    logger.warn('Failed to fetch latest run for stream', {
      streamId,
      error: getErrorMessage(err),
    })
    return null
  })
  logger.info('[Resume] Stream lookup', {
    streamId,
    afterCursor,
    batchMode,
    hasRun: !!run,
    runStatus: run?.status,
  })
  if (!run) {
    rootSpan.setAttribute(TraceAttr.CopilotResumeOutcome, CopilotResumeOutcome.StreamNotFound)
    rootSpan.end()
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
  }
  const streamRun = run
  rootSpan.setAttribute(TraceAttr.CopilotRunStatus, streamRun.status)

  if (batchMode) {
    const afterSeq = afterCursor || '0'
    const [replay, previewSessions] = await Promise.all([
      readReplayBatch({
        streamId,
        userId: authenticatedUserId,
        afterCursor: afterSeq,
        rootContext,
      }),
      readFilePreviewSessions(streamId).catch((error) => {
        logger.warn('Failed to read preview sessions for stream batch', {
          streamId,
          error: getErrorMessage(error),
        })
        return []
      }),
    ])
    const batchEvents = replay.events
    logger.info('[Resume] Batch response', {
      streamId,
      afterCursor: afterSeq,
      eventCount: batchEvents.length,
      previewSessionCount: previewSessions.length,
      runStatus: replay.status ?? streamRun.status,
      replaySource: replay.source,
    })
    rootSpan.setAttributes({
      [TraceAttr.CopilotResumeOutcome]: CopilotResumeOutcome.BatchDelivered,
      [TraceAttr.CopilotResumeEventCount]: batchEvents.length,
      [TraceAttr.CopilotResumePreviewSessionCount]: previewSessions.length,
    })
    rootSpan.end()
    return NextResponse.json({
      success: true,
      events: batchEvents,
      previewSessions,
      status: replay.status ?? streamRun.status,
      ...(replay.chatId || streamRun.chatId ? { chatId: replay.chatId ?? streamRun.chatId } : {}),
    })
  }

  const startTime = Date.now()
  let totalEventsFlushed = 0
  let pollIterations = 0

  const stream = new ReadableStream({
    async start(controller) {
      // Re-enter the root OTel context so any `withCopilotSpan` call below
      // (inside flushEvents/checkForReplayGap/etc.) parents under
      // copilot.resume.request instead of becoming an orphan.
      return otelContext.with(rootContext, () => startInner(controller))
    },
  })

  async function startInner(controller: ReadableStreamDefaultController) {
    let cursor = afterCursor || '0'
    let controllerClosed = false
    let sawTerminalEvent = false
    let currentRequestId = extractRunRequestId(run)
    let latestReplayStatus: string | null | undefined = streamRun.status
    let lastWriteTime = Date.now()
    // Stamp the logical request id + chat id on the resume root as soon
    // as we resolve them from the run row, so TraceQL joins work on
    // resume legs the same way they do on the original POST.
    if (currentRequestId) {
      rootSpan.setAttribute(TraceAttr.RequestId, currentRequestId)
      rootSpan.setAttribute(TraceAttr.SimRequestId, currentRequestId)
    }
    if (streamRun.chatId) {
      rootSpan.setAttribute(TraceAttr.ChatId, streamRun.chatId)
    }

    const closeController = () => {
      if (controllerClosed) return
      controllerClosed = true
      try {
        controller.close()
      } catch {
        // Controller already closed by runtime/client
      }
    }

    const enqueueEvent = (payload: unknown) => {
      if (controllerClosed) return false
      try {
        controller.enqueue(encodeSSEEnvelope(payload))
        lastWriteTime = Date.now()
        return true
      } catch {
        controllerClosed = true
        return false
      }
    }

    const enqueueComment = (comment: string) => {
      if (controllerClosed) return false
      try {
        controller.enqueue(encodeSSEComment(comment))
        lastWriteTime = Date.now()
        return true
      } catch {
        controllerClosed = true
        return false
      }
    }

    const abortListener = () => {
      controllerClosed = true
    }
    request.signal.addEventListener('abort', abortListener, { once: true })

    const flushEvents = async () => {
      const replay = await readReplayBatch({
        streamId,
        userId: authenticatedUserId,
        afterCursor: cursor,
        rootContext,
      })
      const events = replay.events.map((event) => event.event)
      latestReplayStatus = replay.status ?? latestReplayStatus
      if (events.length > 0) {
        logger.debug('[Resume] Flushing events', {
          streamId,
          afterCursor: cursor,
          eventCount: events.length,
          replaySource: replay.source,
        })
      }
      for (const envelope of events) {
        if (!enqueueEvent(envelope)) {
          break
        }
        totalEventsFlushed += 1
        cursor = envelope.stream.cursor ?? String(envelope.seq)
        currentRequestId = extractEnvelopeRequestId(envelope) || currentRequestId
        if (envelope.type === MothershipStreamV1EventType.complete) {
          sawTerminalEvent = true
        }
      }
    }

    const emitTerminalIfMissing = (
      status: MothershipStreamV1CompletionStatus,
      options?: { message?: string; code: string; reason?: string }
    ) => {
      if (controllerClosed || sawTerminalEvent) {
        return
      }
      for (const envelope of buildResumeTerminalEnvelopes({
        streamId,
        afterCursor: cursor,
        status,
        message: options?.message,
        code: options?.code ?? 'resume_terminal',
        reason: options?.reason,
        requestId: currentRequestId,
      })) {
        if (!enqueueEvent(envelope)) {
          break
        }
        cursor = envelope.stream.cursor ?? String(envelope.seq)
        if (envelope.type === MothershipStreamV1EventType.complete) {
          sawTerminalEvent = true
        }
      }
    }

    try {
      enqueueComment('accepted')

      const gap = shouldUseOwnedReplay()
        ? null
        : await checkForReplayGap(streamId, afterCursor, currentRequestId)
      if (gap) {
        for (const envelope of gap.envelopes) {
          if (!enqueueEvent(envelope)) {
            break
          }
          cursor = envelope.stream.cursor ?? String(envelope.seq)
          currentRequestId = extractEnvelopeRequestId(envelope) || currentRequestId
          if (envelope.type === MothershipStreamV1EventType.complete) {
            sawTerminalEvent = true
          }
        }
        return
      }

      await flushEvents()
      if (sawTerminalEvent) {
        return
      }

      while (!controllerClosed && Date.now() - startTime < MAX_STREAM_MS) {
        pollIterations += 1
        const currentRun = await getLatestRunForStream(streamId, authenticatedUserId).catch(
          (err) => {
            logger.warn('Failed to poll latest run for stream', {
              streamId,
              error: getErrorMessage(err),
            })
            return null
          }
        )
        if (!currentRun) {
          emitTerminalIfMissing(MothershipStreamV1CompletionStatus.error, {
            message: 'The stream could not be recovered because its run metadata is unavailable.',
            code: 'resume_run_unavailable',
            reason: 'run_unavailable',
          })
          break
        }

        currentRequestId = extractRunRequestId(currentRun) || currentRequestId

        await flushEvents()

        if (controllerClosed) {
          break
        }
        if (sawTerminalEvent) {
          break
        }

        const terminalStatus = isTerminalStatus(latestReplayStatus)
          ? latestReplayStatus
          : isTerminalStatus(currentRun.status)
            ? currentRun.status
            : null
        if (terminalStatus) {
          emitTerminalIfMissing(terminalStatus, {
            message:
              terminalStatus === MothershipStreamV1CompletionStatus.error
                ? typeof currentRun.error === 'string'
                  ? currentRun.error
                  : 'The recovered stream ended with an error.'
                : undefined,
            code: 'resume_terminal_status',
            reason: 'terminal_status',
          })
          break
        }

        if (request.signal.aborted) {
          controllerClosed = true
          break
        }

        if (Date.now() - lastWriteTime >= REPLAY_KEEPALIVE_INTERVAL_MS) {
          enqueueComment('keepalive')
        }

        await sleep(POLL_INTERVAL_MS)
      }
      if (!controllerClosed && Date.now() - startTime >= MAX_STREAM_MS) {
        emitTerminalIfMissing(MothershipStreamV1CompletionStatus.error, {
          message: 'The stream recovery timed out before completion.',
          code: 'resume_timeout',
          reason: 'timeout',
        })
      }
    } catch (error) {
      if (!controllerClosed && !request.signal.aborted) {
        logger.warn('Stream replay failed', {
          streamId,
          error: getErrorMessage(error),
        })
        emitTerminalIfMissing(MothershipStreamV1CompletionStatus.error, {
          message: 'The stream replay failed before completion.',
          code: 'resume_internal',
          reason: 'stream_replay_failed',
        })
      }
      markSpanForError(rootSpan, error)
    } finally {
      request.signal.removeEventListener('abort', abortListener)
      closeController()
      rootSpan.setAttributes({
        [TraceAttr.CopilotResumeOutcome]: sawTerminalEvent
          ? CopilotResumeOutcome.TerminalDelivered
          : controllerClosed
            ? CopilotResumeOutcome.ClientDisconnected
            : CopilotResumeOutcome.EndedWithoutTerminal,
        [TraceAttr.CopilotResumeEventCount]: totalEventsFlushed,
        [TraceAttr.CopilotResumePollIterations]: pollIterations,
        [TraceAttr.CopilotResumeDurationMs]: Date.now() - startTime,
      })
      rootSpan.end()
    }
  }

  return new Response(stream, { headers: SSE_RESPONSE_HEADERS })
}
