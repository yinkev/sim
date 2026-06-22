import { getErrorMessage } from '@sim/utils/errors'
import {
  appendMothershipRunEvents,
  getLatestMothershipRunEventSeq,
  type MothershipStreamEventEnvelope,
} from '@/state/stream-event-store'

export interface ResumeContinuationStreamOptions {
  checkpointId: string
  requestId: string
  runId: string
  startSeq?: number
  streamId: string
}

export interface UnsupportedRuntimeStreamOptions {
  afterPersist?: (envelope: MothershipStreamEventEnvelope) => Promise<void>
  code: string
  message: string
  model?: string
  provider?: string
  requestId: string
  route: string
  runId: string
  startSeq?: number
  streamId: string
}

export interface ReplayStreamOptions {
  events: MothershipStreamEventEnvelope[]
  requestId: string
}

const encoder = new TextEncoder()
const TERMINAL_EVENT_TYPES = new Set(['complete', 'error'])

export class MothershipStreamPersistenceError extends Error {
  constructor(error: unknown) {
    super(getErrorMessage(error, 'Mothership stream event persistence failed'))
    this.name = 'MothershipStreamPersistenceError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isTerminalEnvelope(envelope: MothershipStreamEventEnvelope): boolean {
  if (TERMINAL_EVENT_TYPES.has(envelope.type)) return true
  return (
    envelope.type === 'run' &&
    isRecord(envelope.payload) &&
    envelope.payload.kind === 'checkpoint_pause'
  )
}

function encodeSseEnvelope(envelope: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(envelope)}\n\n`)
}

export interface MothershipStreamWriterOptions {
  requestId: string
  runId: string
  startSeq?: number
  streamId: string
}

export interface MothershipStreamEventInput {
  afterPersist?: (envelope: MothershipStreamEventEnvelope) => Promise<void>
  scope?: {
    lane: 'subagent'
    agentId?: string
    parentToolCallId?: string
    spanId?: string
    parentSpanId?: string
  }
  type: string
  payload: unknown
}

export class MothershipStreamWriter {
  private nextSeq = 0
  private sawTerminal = false

  constructor(
    private readonly options: MothershipStreamWriterOptions,
    private readonly controller: ReadableStreamDefaultController<Uint8Array>,
    startSeq: number
  ) {
    this.nextSeq = startSeq
  }

  async publish(event: MothershipStreamEventInput): Promise<void> {
    const envelope = this.createEnvelope(event)
    this.validateEnvelope(envelope)
    const [persistedEnvelope] = await appendMothershipRunEvents({
      runId: this.options.runId,
      streamId: this.options.streamId,
      events: [envelope],
    }).catch((error: unknown) => {
      throw new MothershipStreamPersistenceError(error)
    })
    const envelopeToStream = persistedEnvelope ?? envelope
    await event.afterPersist?.(envelopeToStream)
    this.controller.enqueue(encodeSseEnvelope(envelopeToStream))
    if (isTerminalEnvelope(envelopeToStream)) {
      this.sawTerminal = true
    }
  }

  close(): void {
    if (!this.sawTerminal) {
      throw new Error(`Mothership stream ${this.options.streamId} closed without a terminal event`)
    }
    this.controller.close()
  }

  private createEnvelope(event: MothershipStreamEventInput): MothershipStreamEventEnvelope {
    const seq = ++this.nextSeq
    return {
      v: 1,
      seq,
      ts: new Date().toISOString(),
      stream: {
        streamId: this.options.streamId,
        cursor: String(seq),
      },
      trace: {
        requestId: this.options.requestId,
      },
      ...(event.scope ? { scope: event.scope } : {}),
      type: event.type,
      payload: event.payload,
    }
  }

  private validateEnvelope(envelope: MothershipStreamEventEnvelope): void {
    if (isTerminalEnvelope(envelope) && this.sawTerminal) {
      throw new Error(
        `Mothership stream ${this.options.streamId} already published a terminal event`
      )
    }
  }
}

function streamHeaders(requestId: string): HeadersInit {
  return {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'content-encoding': 'none',
    'x-request-id': requestId,
  }
}

export function mothershipStreamResponse(
  options: MothershipStreamWriterOptions,
  produce: (writer: MothershipStreamWriter) => Promise<void>
): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startSeq =
        options.startSeq ??
        (await getLatestMothershipRunEventSeq({
          streamId: options.streamId,
        }))
      const writer = new MothershipStreamWriter(options, controller, startSeq)
      try {
        await produce(writer)
        writer.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(body, {
    status: 200,
    headers: streamHeaders(options.requestId),
  })
}

export function resumeContinuationNotImplementedStream(
  options: ResumeContinuationStreamOptions
): Response {
  return mothershipStreamResponse(options, async (writer) => {
    await writer.publish({
      type: 'run',
      payload: {
        kind: 'resumed',
      },
    })
    await writer.publish({
      type: 'error',
      payload: {
        code: 'resume_continuation_not_implemented',
        message: 'Owned Mothership resume continuation is not implemented yet.',
        data: {
          checkpointId: options.checkpointId,
        },
      },
    })
  })
}

export function unsupportedRuntimeStream(options: UnsupportedRuntimeStreamOptions): Response {
  return mothershipStreamResponse(options, async (writer) => {
    await writer.publish({
      type: 'error',
      payload: {
        code: options.code,
        message: options.message,
        displayMessage: options.message,
        ...(options.provider ? { provider: options.provider } : {}),
        data: {
          route: options.route,
          ...(options.model ? { model: options.model } : {}),
        },
      },
      afterPersist: options.afterPersist,
    })
  })
}

export function replayStreamResponse(options: ReplayStreamOptions): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of options.events) {
        controller.enqueue(encodeSseEnvelope(event))
      }
      controller.close()
    },
  })

  return new Response(body, {
    status: 200,
    headers: streamHeaders(options.requestId),
  })
}
