import { generateId } from '@sim/utils/id'
import type { CenterStorageAdapter } from '@/lib/center/local-spine'
import type {
  CenterActionProposal,
  CenterActor,
  CenterActorKind,
  CenterDataset,
  CenterEvidence,
  CenterEvidenceKind,
  CenterLoop,
  CenterObservation,
  CenterRawEvent,
  CenterRecommendation,
} from '@/lib/center/types'

interface CenterProducerImportActor {
  kind: CenterActorKind
  displayName: string
}

interface CenterProducerImportEvidence {
  sourceRef: string
  subjectType: string
  subjectId: string
  kind: CenterEvidenceKind
  title: string
  uri?: string
  payload?: Record<string, unknown>
}

interface CenterProducerImportRawEvent {
  sourceRef: string
  occurredAt: string
  eventType: string
  subjectType: string
  subjectId: string
  payload?: Record<string, unknown>
  evidenceRefs?: string[]
}

interface CenterProducerImportObservation {
  sourceRef: string
  observedAt?: string
  observationType: string
  subjectType: string
  subjectId: string
  sourceEventRefs: string[]
  payload?: Record<string, unknown>
  confidence?: number
}

interface CenterProducerImportLoop {
  sourceRef: string
  title: string
  domain: string
  status?: CenterLoop['status']
  nextAction?: string
  blockedBy?: string[]
  evidenceRefs?: string[]
}

interface CenterProducerImportRecommendation {
  sourceRef: string
  targetType: string
  targetId: string
  title: string
  reason: string
  predictionRefs?: string[]
  evidenceRefs?: string[]
}

interface CenterProducerImportActionProposal {
  sourceRef: string
  recommendationRef?: string
  actionType: string
  targetType: string
  targetId: string
  payload?: Record<string, unknown>
  evidenceRefs?: string[]
}

export interface CenterProducerImportPacket {
  producerId: string
  producerDisplayName: string
  actor: CenterProducerImportActor
  evidence: CenterProducerImportEvidence[]
  rawEvents: CenterProducerImportRawEvent[]
  observations: CenterProducerImportObservation[]
  loops: CenterProducerImportLoop[]
  recommendations: CenterProducerImportRecommendation[]
  actionProposals: CenterProducerImportActionProposal[]
}

export interface CenterProducerImportSummary {
  evidenceAdded: number
  rawEventsAdded: number
  observationsAdded: number
  loopsAdded: number
  recommendationsAdded: number
  actionProposalsAdded: number
  skippedExisting: number
}

const EMPTY_SUMMARY: CenterProducerImportSummary = {
  evidenceAdded: 0,
  rawEventsAdded: 0,
  observationsAdded: 0,
  loopsAdded: 0,
  recommendationsAdded: 0,
  actionProposalsAdded: 0,
  skippedExisting: 0,
}

export async function applyCenterProducerImport(
  storage: CenterStorageAdapter,
  profileId: string,
  packet: CenterProducerImportPacket
): Promise<CenterProducerImportSummary> {
  const dataset = await storage.load()
  assertProfileExists(dataset, profileId)

  const summary = { ...EMPTY_SUMMARY }
  const actor = ensureProducerActor(dataset, profileId, packet)
  const evidenceIds = buildSourceRefIndex(dataset.evidence, profileId)
  const rawEventIds = buildSourceRefIndex(dataset.rawEvents, profileId)
  const recommendationIds = buildSourceRefIndex(dataset.recommendations, profileId)

  for (const item of packet.evidence) {
    if (evidenceIds.has(item.sourceRef)) {
      summary.skippedExisting += 1
      continue
    }
    const evidence: CenterEvidence = {
      id: generateId(),
      profileId,
      producerId: packet.producerId,
      subjectType: item.subjectType,
      subjectId: item.subjectId,
      kind: item.kind,
      title: item.title,
      uri: item.uri,
      payload: item.payload,
      createdAt: new Date().toISOString(),
      sourceRef: item.sourceRef,
    }
    dataset.evidence.push(evidence)
    evidenceIds.set(item.sourceRef, evidence.id)
    summary.evidenceAdded += 1
  }

  for (const item of packet.rawEvents) {
    if (rawEventIds.has(item.sourceRef)) {
      summary.skippedExisting += 1
      continue
    }
    const rawEvent: CenterRawEvent = {
      id: generateId(),
      profileId,
      producerId: packet.producerId,
      actorId: actor.id,
      sourceRef: item.sourceRef,
      occurredAt: item.occurredAt,
      recordedAt: new Date().toISOString(),
      eventType: item.eventType,
      subjectType: item.subjectType,
      subjectId: item.subjectId,
      payload: item.payload ?? {},
      evidenceRefs: resolveRefs(item.evidenceRefs, evidenceIds),
    }
    dataset.rawEvents.push(rawEvent)
    rawEventIds.set(item.sourceRef, rawEvent.id)
    summary.rawEventsAdded += 1
  }

  for (const item of packet.observations) {
    if (hasSourceRef(dataset.observations, profileId, item.sourceRef)) {
      summary.skippedExisting += 1
      continue
    }
    const sourceEventRefs = resolveRefs(item.sourceEventRefs, rawEventIds)
    if (sourceEventRefs.length === 0) continue
    const observation: CenterObservation = {
      id: generateId(),
      profileId,
      producerId: packet.producerId,
      actorId: actor.id,
      observedAt: item.observedAt ?? new Date().toISOString(),
      observationType: item.observationType,
      subjectType: item.subjectType,
      subjectId: item.subjectId,
      sourceEventRefs,
      payload: item.payload ?? {},
      confidence: item.confidence,
      sourceRef: item.sourceRef,
    }
    dataset.observations.push(observation)
    summary.observationsAdded += 1
  }

  for (const item of packet.loops) {
    if (hasSourceRef(dataset.loops, profileId, item.sourceRef)) {
      summary.skippedExisting += 1
      continue
    }
    const loop: CenterLoop = {
      id: generateId(),
      profileId,
      title: item.title,
      domain: item.domain,
      status: item.status ?? 'active',
      nextAction: item.nextAction,
      blockedBy: item.blockedBy,
      evidenceRefs: resolveRefs(item.evidenceRefs, evidenceIds),
      updatedAt: new Date().toISOString(),
      sourceRef: item.sourceRef,
    }
    dataset.loops.push(loop)
    summary.loopsAdded += 1
  }

  for (const item of packet.recommendations) {
    if (recommendationIds.has(item.sourceRef)) {
      summary.skippedExisting += 1
      continue
    }
    const recommendation: CenterRecommendation = {
      id: generateId(),
      profileId,
      targetType: item.targetType,
      targetId: item.targetId,
      title: item.title,
      reason: item.reason,
      predictionRefs: item.predictionRefs ?? [],
      evidenceRefs: resolveRefs(item.evidenceRefs, evidenceIds),
      createdAt: new Date().toISOString(),
      status: 'proposed',
      sourceRef: item.sourceRef,
    }
    dataset.recommendations.push(recommendation)
    recommendationIds.set(item.sourceRef, recommendation.id)
    summary.recommendationsAdded += 1
  }

  for (const item of packet.actionProposals) {
    if (hasSourceRef(dataset.actionProposals, profileId, item.sourceRef)) {
      summary.skippedExisting += 1
      continue
    }
    const actionProposal: CenterActionProposal = {
      id: generateId(),
      profileId,
      recommendationId: item.recommendationRef
        ? recommendationIds.get(item.recommendationRef)
        : undefined,
      producerId: packet.producerId,
      actionType: item.actionType,
      targetType: item.targetType,
      targetId: item.targetId,
      payload: item.payload ?? {},
      evidenceRefs: resolveRefs(item.evidenceRefs, evidenceIds),
      status: 'proposed',
      createdAt: new Date().toISOString(),
      sourceRef: item.sourceRef,
    }
    dataset.actionProposals.push(actionProposal)
    summary.actionProposalsAdded += 1
  }

  await storage.save(dataset)
  return summary
}

function ensureProducerActor(
  dataset: CenterDataset,
  profileId: string,
  packet: CenterProducerImportPacket
): CenterActor {
  const existing = dataset.actors.find(
    (actor) =>
      actor.profileId === profileId &&
      actor.producerId === packet.producerId &&
      actor.kind === packet.actor.kind
  )
  if (existing) return existing

  const actor: CenterActor = {
    id: generateId(),
    profileId,
    kind: packet.actor.kind,
    displayName: packet.actor.displayName,
    producerId: packet.producerId,
  }
  dataset.actors.push(actor)
  return actor
}

function buildSourceRefIndex<T extends { profileId: string; id: string; sourceRef?: string }>(
  items: T[],
  profileId: string
): Map<string, string> {
  const index = new Map<string, string>()
  for (const item of items) {
    if (item.profileId === profileId && item.sourceRef) index.set(item.sourceRef, item.id)
  }
  return index
}

function hasSourceRef<T extends { profileId: string; sourceRef?: string }>(
  items: T[],
  profileId: string,
  sourceRef: string
): boolean {
  return items.some((item) => item.profileId === profileId && item.sourceRef === sourceRef)
}

function resolveRefs(sourceRefs: string[] | undefined, index: Map<string, string>): string[] {
  if (!sourceRefs) return []
  return sourceRefs.map((sourceRef) => index.get(sourceRef)).filter((id): id is string => !!id)
}

function assertProfileExists(dataset: CenterDataset, profileId: string) {
  if (!dataset.profiles.some((profile) => profile.id === profileId)) {
    throw new Error(`Center profile not found: ${profileId}`)
  }
}
