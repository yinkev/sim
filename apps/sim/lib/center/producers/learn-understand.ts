import { filterUndefined } from '@sim/utils/object'
import type { CenterProducerImportPacket } from '@/lib/center/producer-import'

export const LEARN_PRODUCER_ID = 'learn'
export const UNDERSTAND_PRODUCER_ID = 'understand'
const LEARN_CAPABILITY_IDS = [
  'emit.learn_learning_gap',
  'emit.learn_practice_task',
  'emit.learn_review_evidence',
] as const
const UNDERSTAND_CAPABILITY_IDS = [
  'emit.understand_system_map',
  'emit.understand_dependency_observation',
  'emit.understand_risk_evidence',
] as const

export type CenterLearnUnderstandRecord =
  | CenterLearningGapRecord
  | CenterPracticeTaskRecord
  | CenterReviewEvidenceRecord
  | CenterSystemMapRecord
  | CenterDependencyObservationRecord
  | CenterRiskEvidenceRecord

export interface CenterLearnUnderstandSnapshot {
  sourcePath: string
  records: CenterLearnUnderstandRecord[]
}

export interface CenterLearningGapRecord {
  kind: 'learning_gap'
  gapId: string
  topic: string
  title: string
  severity: string
  detectedAt: string
  source?: string
  url?: string
}

export interface CenterPracticeTaskRecord {
  kind: 'practice_task'
  taskId: string
  topic: string
  title: string
  status: string
  createdAt: string
  dueAt?: string
  url?: string
}

export interface CenterReviewEvidenceRecord {
  kind: 'review_evidence'
  evidenceId: string
  topic: string
  title: string
  result: string
  reviewedAt: string
  score?: number
  url?: string
}

export interface CenterSystemMapRecord {
  kind: 'system_map'
  mapId: string
  scope: string
  title: string
  generatedAt: string
  edgeCount?: number
  nodeCount?: number
  url?: string
}

export interface CenterDependencyObservationRecord {
  kind: 'dependency_observation'
  observationId: string
  scope: string
  from: string
  to: string
  relation: string
  observedAt: string
  risk?: string
  url?: string
}

export interface CenterRiskEvidenceRecord {
  kind: 'risk_evidence'
  riskId: string
  scope: string
  title: string
  severity: string
  detectedAt: string
  area?: string
  url?: string
}

type PacketObservation = CenterProducerImportPacket['observations'][number]

interface LoopProjection {
  key: string
  title: string
  domain: string
  evidenceRefs: Set<string>
  blockers: string[]
  nextAction?: string
}

export function buildLearnUnderstandImportPackets(
  snapshot: CenterLearnUnderstandSnapshot
): CenterProducerImportPacket[] {
  const learnPacket = createPacket(LEARN_PRODUCER_ID, 'Learn')
  const understandPacket = createPacket(UNDERSTAND_PRODUCER_ID, 'Understand')
  const learnLoops = new Map<string, LoopProjection>()
  const understandLoops = new Map<string, LoopProjection>()

  for (const record of snapshot.records) {
    if (record.kind === 'learning_gap') {
      addLearningGap(learnPacket, ensureLearnLoop(learnLoops, record.topic), record)
    } else if (record.kind === 'practice_task') {
      addPracticeTask(learnPacket, ensureLearnLoop(learnLoops, record.topic), record)
    } else if (record.kind === 'review_evidence') {
      addReviewEvidence(learnPacket, ensureLearnLoop(learnLoops, record.topic), record)
    } else if (record.kind === 'system_map') {
      addSystemMap(understandPacket, ensureUnderstandLoop(understandLoops, record.scope), record)
    } else if (record.kind === 'dependency_observation') {
      addDependencyObservation(
        understandPacket,
        ensureUnderstandLoop(understandLoops, record.scope),
        record
      )
    } else {
      addRiskEvidence(understandPacket, ensureUnderstandLoop(understandLoops, record.scope), record)
    }
  }

  addLoops(learnPacket, learnLoops)
  addLoops(understandPacket, understandLoops)
  return [learnPacket, understandPacket].filter(
    (packet) => packet.rawEvents.length > 0 || packet.evidence.length > 0
  )
}

function createPacket(producerId: string, displayName: string): CenterProducerImportPacket {
  return {
    producerId,
    producerDisplayName: displayName,
    capabilityIds:
      producerId === LEARN_PRODUCER_ID ? [...LEARN_CAPABILITY_IDS] : [...UNDERSTAND_CAPABILITY_IDS],
    actor: {
      kind: 'system',
      displayName,
    },
    evidence: [],
    rawEvents: [],
    observations: [],
    loops: [],
    recommendations: [],
    actionProposals: [],
  }
}

function addLearningGap(
  packet: CenterProducerImportPacket,
  loop: LoopProjection,
  record: CenterLearningGapRecord
) {
  const evidenceRef = `learn:gap:${record.gapId}:evidence`
  const eventRef = `learn:gap:${record.gapId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'learning-gap',
    subjectId: record.gapId,
    kind: 'source',
    title: `Learning gap ${record.title}`,
    uri: record.url,
    payload: payload({
      gapId: record.gapId,
      topic: record.topic,
      severity: record.severity,
      source: record.source,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.detectedAt,
    eventType: 'learn.learning_gap.detected',
    subjectType: 'learning-gap',
    subjectId: record.gapId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      topic: record.topic,
      title: record.title,
      severity: record.severity,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.detectedAt,
      observationType: 'learning.gap_detected',
      subjectType: 'learning-gap',
      subjectId: record.gapId,
      sourceEventRefs: [eventRef],
      payload: payload({
        topic: record.topic,
        summary: `Learning gap detected: ${record.title}`,
        title: record.title,
        severity: record.severity,
        url: record.url,
      }),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
  if (isHighSeverity(record.severity)) {
    addBlocker(loop, `Learning gap is ${record.severity}: ${record.title}`)
    loop.nextAction = `Practice weak topic: ${record.title}`
  } else if (!loop.nextAction) {
    loop.nextAction = `Review learning gap: ${record.title}`
  }
}

function addPracticeTask(
  packet: CenterProducerImportPacket,
  loop: LoopProjection,
  record: CenterPracticeTaskRecord
) {
  const evidenceRef = `learn:practice:${record.taskId}:evidence`
  const eventRef = `learn:practice:${record.taskId}`
  const open = !isDoneStatus(record.status)
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'practice-task',
    subjectId: record.taskId,
    kind: 'receipt',
    title: `Practice task ${record.title}`,
    uri: record.url,
    payload: payload({
      taskId: record.taskId,
      topic: record.topic,
      status: record.status,
      dueAt: record.dueAt,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.createdAt,
    eventType: 'learn.practice_task.created',
    subjectType: 'practice-task',
    subjectId: record.taskId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      topic: record.topic,
      title: record.title,
      status: record.status,
      dueAt: record.dueAt,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.createdAt,
      observationType: open ? 'learning.practice_task_open' : 'learning.practice_task_done',
      subjectType: 'practice-task',
      subjectId: record.taskId,
      sourceEventRefs: [eventRef],
      payload: payload({
        topic: record.topic,
        summary: `Practice task ${record.status}: ${record.title}`,
        title: record.title,
        status: record.status,
        url: record.url,
      }),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
  if (open) loop.nextAction = `Complete practice task: ${record.title}`
}

function addReviewEvidence(
  packet: CenterProducerImportPacket,
  loop: LoopProjection,
  record: CenterReviewEvidenceRecord
) {
  const evidenceRef = `learn:review:${record.evidenceId}:evidence`
  const eventRef = `learn:review:${record.evidenceId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'learning-review',
    subjectId: record.evidenceId,
    kind: 'test',
    title: `Learning review ${record.title}`,
    uri: record.url,
    payload: payload({
      evidenceId: record.evidenceId,
      topic: record.topic,
      result: record.result,
      score: record.score,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.reviewedAt,
    eventType: 'learn.review_evidence.recorded',
    subjectType: 'learning-review',
    subjectId: record.evidenceId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      topic: record.topic,
      title: record.title,
      result: record.result,
      score: record.score,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.reviewedAt,
      observationType: 'learning.review_completed',
      subjectType: 'learning-review',
      subjectId: record.evidenceId,
      sourceEventRefs: [eventRef],
      payload: payload({
        topic: record.topic,
        summary: `Learning review ${record.result}: ${record.title}`,
        result: record.result,
        score: record.score,
        url: record.url,
      }),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
}

function addSystemMap(
  packet: CenterProducerImportPacket,
  loop: LoopProjection,
  record: CenterSystemMapRecord
) {
  const evidenceRef = `understand:system-map:${record.mapId}:evidence`
  const eventRef = `understand:system-map:${record.mapId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'system-map',
    subjectId: record.mapId,
    kind: 'artifact',
    title: `System map ${record.title}`,
    uri: record.url,
    payload: payload({
      mapId: record.mapId,
      scope: record.scope,
      nodeCount: record.nodeCount,
      edgeCount: record.edgeCount,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.generatedAt,
    eventType: 'understand.system_map.generated',
    subjectType: 'system-map',
    subjectId: record.mapId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      scope: record.scope,
      title: record.title,
      nodeCount: record.nodeCount,
      edgeCount: record.edgeCount,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.generatedAt,
      observationType: 'understanding.system_mapped',
      subjectType: 'system-map',
      subjectId: record.mapId,
      sourceEventRefs: [eventRef],
      payload: payload({
        scope: record.scope,
        summary: `System map generated: ${record.title}`,
        title: record.title,
        url: record.url,
      }),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
}

function addDependencyObservation(
  packet: CenterProducerImportPacket,
  loop: LoopProjection,
  record: CenterDependencyObservationRecord
) {
  const evidenceRef = `understand:dependency:${record.observationId}:evidence`
  const eventRef = `understand:dependency:${record.observationId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'dependency-observation',
    subjectId: record.observationId,
    kind: 'source',
    title: `Dependency ${record.from} -> ${record.to}`,
    uri: record.url,
    payload: payload({
      observationId: record.observationId,
      scope: record.scope,
      from: record.from,
      to: record.to,
      relation: record.relation,
      risk: record.risk,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.observedAt,
    eventType: 'understand.dependency_observed',
    subjectType: 'dependency-observation',
    subjectId: record.observationId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      scope: record.scope,
      from: record.from,
      to: record.to,
      relation: record.relation,
      risk: record.risk,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.observedAt,
      observationType: 'understanding.dependency_observed',
      subjectType: 'dependency-observation',
      subjectId: record.observationId,
      sourceEventRefs: [eventRef],
      payload: payload({
        scope: record.scope,
        summary: `${record.from} ${record.relation} ${record.to}`,
        from: record.from,
        to: record.to,
        relation: record.relation,
        risk: record.risk,
        url: record.url,
      }),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
}

function addRiskEvidence(
  packet: CenterProducerImportPacket,
  loop: LoopProjection,
  record: CenterRiskEvidenceRecord
) {
  const evidenceRef = `understand:risk:${record.riskId}:evidence`
  const eventRef = `understand:risk:${record.riskId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'system-risk',
    subjectId: record.riskId,
    kind: 'source',
    title: `Risk ${record.title}`,
    uri: record.url,
    payload: payload({
      riskId: record.riskId,
      scope: record.scope,
      title: record.title,
      severity: record.severity,
      area: record.area,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.detectedAt,
    eventType: 'understand.risk_detected',
    subjectType: 'system-risk',
    subjectId: record.riskId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      scope: record.scope,
      title: record.title,
      severity: record.severity,
      area: record.area,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.detectedAt,
      observationType: 'understanding.risk_detected',
      subjectType: 'system-risk',
      subjectId: record.riskId,
      sourceEventRefs: [eventRef],
      payload: payload({
        scope: record.scope,
        summary: `System risk detected: ${record.title}`,
        title: record.title,
        severity: record.severity,
        area: record.area,
        url: record.url,
      }),
    })
  )
  loop.evidenceRefs.add(evidenceRef)
  if (isHighSeverity(record.severity)) {
    addBlocker(loop, `System risk is ${record.severity}: ${record.title}`)
    loop.nextAction = `Review system risk: ${record.title}`
  } else if (!loop.nextAction) {
    loop.nextAction = `Review system observation: ${record.title}`
  }
}

function addLoops(packet: CenterProducerImportPacket, loops: Map<string, LoopProjection>) {
  for (const loop of [...loops.values()].sort((left, right) => left.key.localeCompare(right.key))) {
    packet.loops.push({
      sourceRef: `${packet.producerId}:loop:${loop.key}`,
      title: loop.title,
      domain: loop.domain,
      status: loop.blockers.length > 0 ? 'blocked' : 'active',
      nextAction: loop.nextAction,
      blockedBy: loop.blockers.length > 0 ? loop.blockers : undefined,
      evidenceRefs: [...loop.evidenceRefs].slice(0, 10),
    })
  }
}

function ensureLearnLoop(loops: Map<string, LoopProjection>, topic: string): LoopProjection {
  const key = normalizeKey(topic)
  const existing = loops.get(key)
  if (existing) return existing
  const next: LoopProjection = {
    key,
    title: `Learn ${topic}`,
    domain: 'learning',
    evidenceRefs: new Set(),
    blockers: [],
  }
  loops.set(key, next)
  return next
}

function ensureUnderstandLoop(loops: Map<string, LoopProjection>, scope: string): LoopProjection {
  const key = normalizeKey(scope)
  const existing = loops.get(key)
  if (existing) return existing
  const next: LoopProjection = {
    key,
    title: `Understand ${scope}`,
    domain: 'system-comprehension',
    evidenceRefs: new Set(),
    blockers: [],
  }
  loops.set(key, next)
  return next
}

function observation(item: PacketObservation): PacketObservation {
  return { confidence: 1, ...item }
}

function addBlocker(loop: LoopProjection, blocker: string) {
  if (!loop.blockers.includes(blocker)) loop.blockers.push(blocker)
}

function payload(input: Record<string, unknown>): Record<string, unknown> {
  return filterUndefined(input) as Record<string, unknown>
}

function isHighSeverity(severity: string): boolean {
  const normalized = severity.trim().toLowerCase()
  return normalized === 'high' || normalized === 'critical'
}

function isDoneStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  return normalized === 'done' || normalized === 'completed' || normalized === 'mastered'
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
