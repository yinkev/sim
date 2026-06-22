import { db } from '@sim/db'
import { copilotRunEvents } from '@sim/db/schema'
import { isRecordLike, sortObjectKeysDeep } from '@sim/utils/object'
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm'

export interface MothershipStreamEventEnvelope {
  v: 1
  seq: number
  type: string
  stream: {
    streamId: string
    cursor?: string
    [key: string]: unknown
  }
  trace?: {
    requestId?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface MothershipRunEventRecord {
  id: string
  runId: string
  streamId: string
  seq: number
  cursor: string
  eventType: string
  requestId: string | null
  envelope: MothershipStreamEventEnvelope
  createdAt: Date
}

export interface AppendMothershipRunEventsInput {
  runId: string
  streamId: string
  events: MothershipStreamEventEnvelope[]
}

export interface ReadMothershipRunEventsInput {
  streamId: string
  afterSeq?: number
  limit?: number
}

type MothershipDbClient = Pick<typeof db, 'insert' | 'select'>
type InsertedSeq = { seq: number }
type MothershipRunEventDbRow = Omit<MothershipRunEventRecord, 'envelope'> & { envelope: unknown }

function validateEvent(streamId: string, event: MothershipStreamEventEnvelope): void {
  if (event.stream.streamId !== streamId) {
    throw new Error(
      `Mothership stream event ${event.seq} belongs to stream ${event.stream.streamId}, expected ${streamId}`
    )
  }

  if (!Number.isInteger(event.seq) || event.seq <= 0) {
    throw new Error(`Mothership stream event has invalid seq ${event.seq}`)
  }

  if (!event.type.trim()) {
    throw new Error(`Mothership stream event ${event.seq} is missing type`)
  }
}

function eventCursor(event: MothershipStreamEventEnvelope): string {
  return event.stream.cursor ?? String(event.seq)
}

function eventRequestId(event: MothershipStreamEventEnvelope): string | null {
  const requestId = event.trace?.requestId
  return typeof requestId === 'string' && requestId.trim() ? requestId : null
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(sortObjectKeysDeep(left)) === JSON.stringify(sortObjectKeysDeep(right))
  } catch {
    return Object.is(left, right)
  }
}

function normalizeEnvelopeForIdempotency(envelope: MothershipStreamEventEnvelope): unknown {
  const normalized = sortObjectKeysDeep(envelope)
  if (!isRecordLike(normalized)) return normalized

  const { ts: _ignoredTs, trace: rawTrace, ...copy } = normalized

  if (isRecordLike(rawTrace)) {
    const { requestId: _ignoredRequestId, ...trace } = rawTrace
    if (Object.keys(trace).length > 0) {
      copy.trace = trace
    }
  }

  return copy
}

function parseStoredEnvelope(value: unknown): MothershipStreamEventEnvelope {
  if (!isRecordLike(value)) {
    throw new Error('Stored Mothership stream event envelope is not an object')
  }
  if (value.v !== 1 || !Number.isInteger(value.seq) || typeof value.type !== 'string') {
    throw new Error('Stored Mothership stream event envelope has invalid envelope fields')
  }
  if (!isRecordLike(value.stream) || typeof value.stream.streamId !== 'string') {
    throw new Error('Stored Mothership stream event envelope has invalid stream fields')
  }
  return value as unknown as MothershipStreamEventEnvelope
}

function mapEventRows(rows: MothershipRunEventDbRow[]): MothershipRunEventRecord[] {
  return rows.map((row) => ({
    ...row,
    envelope: parseStoredEnvelope(row.envelope),
  }))
}

async function readEventsBySeq(
  streamId: string,
  seqs: number[],
  client: MothershipDbClient
): Promise<MothershipRunEventRecord[]> {
  if (seqs.length === 0) return []

  const rows = await client
    .select({
      id: copilotRunEvents.id,
      runId: copilotRunEvents.runId,
      streamId: copilotRunEvents.streamId,
      seq: copilotRunEvents.seq,
      cursor: copilotRunEvents.cursor,
      eventType: copilotRunEvents.eventType,
      requestId: copilotRunEvents.requestId,
      envelope: copilotRunEvents.envelope,
      createdAt: copilotRunEvents.createdAt,
    })
    .from(copilotRunEvents)
    .where(and(eq(copilotRunEvents.streamId, streamId), inArray(copilotRunEvents.seq, seqs)))

  return mapEventRows(rows)
}

function resolvePersistedEvents(
  streamId: string,
  events: MothershipStreamEventEnvelope[],
  insertedSeqs: Set<number>,
  storedRows: MothershipRunEventRecord[]
): MothershipStreamEventEnvelope[] {
  const storedBySeq = new Map(storedRows.map((row) => [row.seq, row.envelope]))

  return events.map((event) => {
    if (insertedSeqs.has(event.seq)) return event

    const stored = storedBySeq.get(event.seq)
    if (
      !stored ||
      !jsonValuesEqual(
        normalizeEnvelopeForIdempotency(stored),
        normalizeEnvelopeForIdempotency(event)
      )
    ) {
      throw new Error(`Mothership stream event conflict for stream ${streamId} seq ${event.seq}`)
    }
    return stored
  })
}

export async function appendMothershipRunEvents(
  input: AppendMothershipRunEventsInput,
  client: MothershipDbClient = db
): Promise<MothershipStreamEventEnvelope[]> {
  if (input.events.length === 0) return []

  for (const event of input.events) {
    validateEvent(input.streamId, event)
  }

  const inserted = (await client
    .insert(copilotRunEvents)
    .values(
      input.events.map((event) => ({
        runId: input.runId,
        streamId: input.streamId,
        seq: event.seq,
        cursor: eventCursor(event),
        eventType: event.type,
        requestId: eventRequestId(event),
        envelope: event,
      }))
    )
    .onConflictDoNothing({
      target: [copilotRunEvents.streamId, copilotRunEvents.seq],
    })
    .returning({ seq: copilotRunEvents.seq })) as InsertedSeq[]

  const insertedSeqs = new Set(inserted.map((row) => row.seq))
  const conflictedEvents = input.events.filter((event) => !insertedSeqs.has(event.seq))
  if (conflictedEvents.length === 0) return input.events

  const storedRows = await readEventsBySeq(
    input.streamId,
    conflictedEvents.map((event) => event.seq),
    client
  )
  return resolvePersistedEvents(input.streamId, input.events, insertedSeqs, storedRows)
}

export async function getLatestMothershipRunEventSeq(
  input: { streamId: string },
  client: MothershipDbClient = db
): Promise<number> {
  const [row] = await client
    .select({ seq: copilotRunEvents.seq })
    .from(copilotRunEvents)
    .where(eq(copilotRunEvents.streamId, input.streamId))
    .orderBy(desc(copilotRunEvents.seq))
    .limit(1)

  return row?.seq ?? 0
}

export async function readMothershipRunEvents(
  input: ReadMothershipRunEventsInput,
  client: MothershipDbClient = db
): Promise<MothershipRunEventRecord[]> {
  const afterSeq = input.afterSeq ?? 0
  if (!Number.isInteger(afterSeq) || afterSeq < 0) {
    throw new Error(`Invalid Mothership stream cursor seq ${afterSeq}`)
  }

  const query = client
    .select({
      id: copilotRunEvents.id,
      runId: copilotRunEvents.runId,
      streamId: copilotRunEvents.streamId,
      seq: copilotRunEvents.seq,
      cursor: copilotRunEvents.cursor,
      eventType: copilotRunEvents.eventType,
      requestId: copilotRunEvents.requestId,
      envelope: copilotRunEvents.envelope,
      createdAt: copilotRunEvents.createdAt,
    })
    .from(copilotRunEvents)
    .where(and(eq(copilotRunEvents.streamId, input.streamId), gt(copilotRunEvents.seq, afterSeq)))
    .orderBy(asc(copilotRunEvents.seq))

  const rows = input.limit ? await query.limit(input.limit) : await query
  return mapEventRows(rows)
}
