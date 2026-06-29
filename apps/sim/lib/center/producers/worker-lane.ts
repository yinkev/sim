import { filterUndefined } from '@sim/utils/object'
import type { CenterProducerImportPacket } from '@/lib/center/producer-import'

export const WORKER_LANE_PRODUCER_ID = 'worker-lane'

export type CenterWorkerLaneRecord =
  | CenterWorkerRunStartedRecord
  | CenterWorkerRunCompletedRecord
  | CenterWorkerFailureRecord
  | CenterWorkerDiffRecord
  | CenterWorkerTestResultRecord
  | CenterWorkerArtifactRecord
  | CenterWorkerReviewNeededRecord

export interface CenterWorkerLaneSnapshot {
  sourcePath: string
  records: CenterWorkerLaneRecord[]
}

interface CenterWorkerBaseRecord {
  producerId: string
  producerDisplayName?: string
  runId: string
  loopKey: string
  loopTitle: string
  taskTitle: string
  url?: string
}

export interface CenterWorkerRunStartedRecord extends CenterWorkerBaseRecord {
  kind: 'run_started'
  startedAt: string
  command?: string
}

export interface CenterWorkerRunCompletedRecord extends CenterWorkerBaseRecord {
  kind: 'run_completed'
  completedAt: string
  status: string
  durationMs?: number
}

export interface CenterWorkerFailureRecord extends CenterWorkerBaseRecord {
  kind: 'failure'
  failureId: string
  title: string
  failedAt: string
  severity: string
  message?: string
}

export interface CenterWorkerDiffRecord extends CenterWorkerBaseRecord {
  kind: 'diff'
  diffId: string
  title: string
  changedAt: string
  filesChanged?: number
  insertions?: number
  deletions?: number
}

export interface CenterWorkerTestResultRecord extends CenterWorkerBaseRecord {
  kind: 'test_result'
  testId: string
  title: string
  status: string
  finishedAt: string
  passed?: number
  failed?: number
}

export interface CenterWorkerArtifactRecord extends CenterWorkerBaseRecord {
  kind: 'artifact'
  artifactId: string
  title: string
  artifactKind: string
  createdAt: string
}

export interface CenterWorkerReviewNeededRecord extends CenterWorkerBaseRecord {
  kind: 'review_needed'
  reviewId: string
  title: string
  reason: string
  requestedAt: string
  authorityRequired?: string
}

type PacketObservation = CenterProducerImportPacket['observations'][number]

interface WorkerLoopProjection {
  key: string
  title: string
  evidenceRefs: Set<string>
  blockers: string[]
  nextAction?: string
}

export function buildWorkerLaneImportPacket(
  snapshot: CenterWorkerLaneSnapshot
): CenterProducerImportPacket {
  const packet: CenterProducerImportPacket = {
    producerId: WORKER_LANE_PRODUCER_ID,
    producerDisplayName: 'Worker Lane',
    actor: {
      kind: 'agent',
      displayName: 'Worker Lane',
    },
    evidence: [],
    rawEvents: [],
    observations: [],
    loops: [],
    recommendations: [],
    actionProposals: [],
  }
  const loops = new Map<string, WorkerLoopProjection>()

  for (const record of snapshot.records) {
    const loop = ensureLoop(loops, record)
    if (record.kind === 'run_started') {
      addRunStarted(packet, loop, record)
    } else if (record.kind === 'run_completed') {
      addRunCompleted(packet, loop, record)
    } else if (record.kind === 'failure') {
      addFailure(packet, loop, record)
    } else if (record.kind === 'diff') {
      addDiff(packet, loop, record)
    } else if (record.kind === 'test_result') {
      addTestResult(packet, loop, record)
    } else if (record.kind === 'artifact') {
      addArtifact(packet, loop, record)
    } else {
      addReviewNeeded(packet, loop, record)
    }
  }

  for (const loop of [...loops.values()].sort((left, right) => left.key.localeCompare(right.key))) {
    packet.loops.push({
      sourceRef: `worker-lane:loop:${loop.key}`,
      title: loop.title,
      domain: 'agent-execution',
      status: loop.blockers.length > 0 ? 'blocked' : 'active',
      nextAction: loop.nextAction,
      blockedBy: loop.blockers.length > 0 ? loop.blockers : undefined,
      evidenceRefs: [...loop.evidenceRefs].slice(0, 10),
    })
  }

  return packet
}

function addRunStarted(
  packet: CenterProducerImportPacket,
  loop: WorkerLoopProjection,
  record: CenterWorkerRunStartedRecord
) {
  const evidenceRef = `worker-lane:run-started:${record.producerId}:${record.runId}:evidence`
  const eventRef = `worker-lane:run-started:${record.producerId}:${record.runId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'agent-run',
    subjectId: record.runId,
    kind: 'log',
    title: `${displayName(record)} run started: ${record.taskTitle}`,
    uri: record.url,
    payload: payload(basePayload(record, { command: record.command })),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.startedAt,
    eventType: 'agent.run.started',
    subjectType: 'agent-run',
    subjectId: record.runId,
    evidenceRefs: [evidenceRef],
    payload: payload(basePayload(record, { command: record.command })),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.startedAt,
      observationType: 'agent.run_started',
      subjectType: 'agent-run',
      subjectId: record.runId,
      sourceEventRefs: [eventRef],
      payload: payload(
        basePayload(record, {
          summary: `${displayName(record)} started: ${record.taskTitle}`,
          command: record.command,
        })
      ),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
  if (!loop.nextAction) loop.nextAction = `Track worker run: ${record.taskTitle}`
}

function addRunCompleted(
  packet: CenterProducerImportPacket,
  loop: WorkerLoopProjection,
  record: CenterWorkerRunCompletedRecord
) {
  const evidenceRef = `worker-lane:run-completed:${record.producerId}:${record.runId}:evidence`
  const eventRef = `worker-lane:run-completed:${record.producerId}:${record.runId}`
  const failed = isFailedStatus(record.status)
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'agent-run',
    subjectId: record.runId,
    kind: 'run-output',
    title: `${displayName(record)} run ${record.status}: ${record.taskTitle}`,
    uri: record.url,
    payload: payload(basePayload(record, { status: record.status, durationMs: record.durationMs })),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.completedAt,
    eventType: failed ? 'agent.run.failed' : 'agent.run.completed',
    subjectType: 'agent-run',
    subjectId: record.runId,
    evidenceRefs: [evidenceRef],
    payload: payload(basePayload(record, { status: record.status, durationMs: record.durationMs })),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.completedAt,
      observationType: failed ? 'agent.run_failed' : 'agent.run_completed',
      subjectType: 'agent-run',
      subjectId: record.runId,
      sourceEventRefs: [eventRef],
      payload: payload(
        basePayload(record, {
          summary: `${displayName(record)} run ${record.status}: ${record.taskTitle}`,
          status: record.status,
          durationMs: record.durationMs,
        })
      ),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
  if (failed) {
    addBlocker(loop, `${displayName(record)} run ${record.status}: ${record.taskTitle}`)
    loop.nextAction = `Inspect failed worker run: ${record.taskTitle}`
  } else if (!loop.nextAction) {
    loop.nextAction = `Review worker output: ${record.taskTitle}`
  }
}

function addFailure(
  packet: CenterProducerImportPacket,
  loop: WorkerLoopProjection,
  record: CenterWorkerFailureRecord
) {
  const evidenceRef = `worker-lane:failure:${record.producerId}:${record.failureId}:evidence`
  const eventRef = `worker-lane:failure:${record.producerId}:${record.failureId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'agent-failure',
    subjectId: record.failureId,
    kind: 'log',
    title: `Worker failure ${record.title}`,
    uri: record.url,
    payload: payload(
      basePayload(record, {
        failureId: record.failureId,
        title: record.title,
        severity: record.severity,
        message: record.message,
      })
    ),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.failedAt,
    eventType: 'agent.failure.recorded',
    subjectType: 'agent-failure',
    subjectId: record.failureId,
    evidenceRefs: [evidenceRef],
    payload: payload(
      basePayload(record, {
        failureId: record.failureId,
        title: record.title,
        severity: record.severity,
        message: record.message,
      })
    ),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.failedAt,
      observationType: 'agent.failure',
      subjectType: 'agent-failure',
      subjectId: record.failureId,
      sourceEventRefs: [eventRef],
      payload: payload(
        basePayload(record, {
          summary: `${displayName(record)} failure: ${record.title}`,
          severity: record.severity,
          message: record.message,
        })
      ),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
  addBlocker(loop, `${displayName(record)} failure is ${record.severity}: ${record.title}`)
  loop.nextAction = `Inspect failure: ${record.title}`
}

function addDiff(
  packet: CenterProducerImportPacket,
  loop: WorkerLoopProjection,
  record: CenterWorkerDiffRecord
) {
  const evidenceRef = `worker-lane:diff:${record.producerId}:${record.diffId}:evidence`
  const eventRef = `worker-lane:diff:${record.producerId}:${record.diffId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'agent-diff',
    subjectId: record.diffId,
    kind: 'diff',
    title: `Worker diff ${record.title}`,
    uri: record.url,
    payload: payload(
      basePayload(record, {
        diffId: record.diffId,
        title: record.title,
        filesChanged: record.filesChanged,
        insertions: record.insertions,
        deletions: record.deletions,
      })
    ),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.changedAt,
    eventType: 'agent.diff.produced',
    subjectType: 'agent-diff',
    subjectId: record.diffId,
    evidenceRefs: [evidenceRef],
    payload: payload(
      basePayload(record, {
        diffId: record.diffId,
        title: record.title,
        filesChanged: record.filesChanged,
        insertions: record.insertions,
        deletions: record.deletions,
      })
    ),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.changedAt,
      observationType: 'agent.diff_ready',
      subjectType: 'agent-diff',
      subjectId: record.diffId,
      sourceEventRefs: [eventRef],
      payload: payload(
        basePayload(record, {
          summary: `${displayName(record)} produced diff: ${record.title}`,
          filesChanged: record.filesChanged,
          insertions: record.insertions,
          deletions: record.deletions,
        })
      ),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
  loop.nextAction = `Review diff: ${record.title}`
}

function addTestResult(
  packet: CenterProducerImportPacket,
  loop: WorkerLoopProjection,
  record: CenterWorkerTestResultRecord
) {
  const evidenceRef = `worker-lane:test:${record.producerId}:${record.testId}:evidence`
  const eventRef = `worker-lane:test:${record.producerId}:${record.testId}`
  const failed = isFailedStatus(record.status) || (record.failed ?? 0) > 0
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'agent-test-result',
    subjectId: record.testId,
    kind: 'test',
    title: `Worker test ${record.title}`,
    uri: record.url,
    payload: payload(
      basePayload(record, {
        testId: record.testId,
        title: record.title,
        status: record.status,
        passed: record.passed,
        failed: record.failed,
      })
    ),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.finishedAt,
    eventType: failed ? 'agent.test.failed' : 'agent.test.passed',
    subjectType: 'agent-test-result',
    subjectId: record.testId,
    evidenceRefs: [evidenceRef],
    payload: payload(
      basePayload(record, {
        testId: record.testId,
        title: record.title,
        status: record.status,
        passed: record.passed,
        failed: record.failed,
      })
    ),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.finishedAt,
      observationType: failed ? 'agent.test_failed' : 'agent.test_passed',
      subjectType: 'agent-test-result',
      subjectId: record.testId,
      sourceEventRefs: [eventRef],
      payload: payload(
        basePayload(record, {
          summary: `${displayName(record)} test ${record.status}: ${record.title}`,
          status: record.status,
          passed: record.passed,
          failed: record.failed,
        })
      ),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
  if (failed) {
    addBlocker(loop, `${displayName(record)} test failed: ${record.title}`)
    loop.nextAction = `Fix failing worker test: ${record.title}`
  }
}

function addArtifact(
  packet: CenterProducerImportPacket,
  loop: WorkerLoopProjection,
  record: CenterWorkerArtifactRecord
) {
  const evidenceRef = `worker-lane:artifact:${record.producerId}:${record.artifactId}:evidence`
  const eventRef = `worker-lane:artifact:${record.producerId}:${record.artifactId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'agent-artifact',
    subjectId: record.artifactId,
    kind: 'artifact',
    title: `Worker artifact ${record.title}`,
    uri: record.url,
    payload: payload(
      basePayload(record, {
        artifactId: record.artifactId,
        title: record.title,
        artifactKind: record.artifactKind,
      })
    ),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.createdAt,
    eventType: 'agent.artifact.created',
    subjectType: 'agent-artifact',
    subjectId: record.artifactId,
    evidenceRefs: [evidenceRef],
    payload: payload(
      basePayload(record, {
        artifactId: record.artifactId,
        title: record.title,
        artifactKind: record.artifactKind,
      })
    ),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.createdAt,
      observationType: 'agent.artifact_ready',
      subjectType: 'agent-artifact',
      subjectId: record.artifactId,
      sourceEventRefs: [eventRef],
      payload: payload(
        basePayload(record, {
          summary: `${displayName(record)} artifact ready: ${record.title}`,
          artifactKind: record.artifactKind,
        })
      ),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
}

function addReviewNeeded(
  packet: CenterProducerImportPacket,
  loop: WorkerLoopProjection,
  record: CenterWorkerReviewNeededRecord
) {
  const evidenceRef = `worker-lane:review:${record.producerId}:${record.reviewId}:evidence`
  const eventRef = `worker-lane:review:${record.producerId}:${record.reviewId}`
  const recommendationRef = `worker-lane:review:${record.producerId}:${record.reviewId}:recommendation`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'agent-review-needed',
    subjectId: record.reviewId,
    kind: 'source',
    title: `Worker review needed ${record.title}`,
    uri: record.url,
    payload: payload(
      basePayload(record, {
        reviewId: record.reviewId,
        title: record.title,
        reason: record.reason,
        authorityRequired: record.authorityRequired,
      })
    ),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.requestedAt,
    eventType: 'agent.review.requested',
    subjectType: 'agent-review-needed',
    subjectId: record.reviewId,
    evidenceRefs: [evidenceRef],
    payload: payload(
      basePayload(record, {
        reviewId: record.reviewId,
        title: record.title,
        reason: record.reason,
        authorityRequired: record.authorityRequired,
      })
    ),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.requestedAt,
      observationType: 'agent.review_needed',
      subjectType: 'agent-review-needed',
      subjectId: record.reviewId,
      sourceEventRefs: [eventRef],
      payload: payload(
        basePayload(record, {
          summary: `${displayName(record)} needs review: ${record.title}`,
          reason: record.reason,
          authorityRequired: record.authorityRequired,
        })
      ),
    })
  )
  packet.recommendations.push({
    sourceRef: recommendationRef,
    targetType: 'agent-run',
    targetId: record.runId,
    title: `Review worker output: ${record.title}`,
    reason: record.reason,
    evidenceRefs: [evidenceRef],
  })
  packet.actionProposals.push({
    sourceRef: `worker-lane:review:${record.producerId}:${record.reviewId}:proposal`,
    recommendationRef,
    actionType: 'review.agent_work',
    targetType: 'agent-run',
    targetId: record.runId,
    evidenceRefs: [evidenceRef],
    payload: payload(
      basePayload(record, {
        reviewId: record.reviewId,
        authorityRequired: record.authorityRequired,
      })
    ),
  })
  loop.evidenceRefs.add(evidenceRef)
  addBlocker(loop, `Agent review required: ${record.title}`)
  loop.nextAction = `Review worker output: ${record.title}`
}

function ensureLoop(
  loops: Map<string, WorkerLoopProjection>,
  record: CenterWorkerBaseRecord
): WorkerLoopProjection {
  const key = normalizeKey(record.loopKey)
  const existing = loops.get(key)
  if (existing) return existing
  const next: WorkerLoopProjection = {
    key,
    title: record.loopTitle,
    evidenceRefs: new Set(),
    blockers: [],
  }
  loops.set(key, next)
  return next
}

function observation(item: PacketObservation): PacketObservation {
  return { confidence: 1, ...item }
}

function addBlocker(loop: WorkerLoopProjection, blocker: string) {
  if (!loop.blockers.includes(blocker)) loop.blockers.push(blocker)
}

function basePayload(
  record: CenterWorkerBaseRecord,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return {
    producerId: record.producerId,
    producerDisplayName: displayName(record),
    runId: record.runId,
    loopKey: record.loopKey,
    loopTitle: record.loopTitle,
    taskTitle: record.taskTitle,
    url: record.url,
    ...extra,
  }
}

function payload(input: Record<string, unknown>): Record<string, unknown> {
  return filterUndefined(input) as Record<string, unknown>
}

function displayName(record: CenterWorkerBaseRecord): string {
  return record.producerDisplayName ?? record.producerId
}

function isFailedStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  return normalized === 'failed' || normalized === 'failure' || normalized === 'error'
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
