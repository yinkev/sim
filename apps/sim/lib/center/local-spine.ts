import { generateId } from '@sim/utils/id'
import type {
  CenterActor,
  CenterActorKind,
  CenterDataset,
  CenterDecision,
  CenterEvidence,
  CenterEvidenceKind,
  CenterLoop,
  CenterObservation,
  CenterProfile,
  CenterRawEvent,
  CenterStorageMode,
} from '@/lib/center/types'

const EMPTY_DATASET: CenterDataset = {
  profiles: [],
  actors: [],
  rawEvents: [],
  evidence: [],
  observations: [],
  loops: [],
  decisions: [],
}

const DEFAULT_STORAGE_KEY = 'sim.center.local-spine.v1'

export interface CenterStorageAdapter {
  load(): Promise<CenterDataset>
  save(dataset: CenterDataset): Promise<void>
}

export interface CreateCenterProfileInput {
  displayName: string
  storageMode?: CenterStorageMode
}

export interface CreateCenterActorInput {
  profileId?: string
  kind: CenterActorKind
  displayName: string
  producerId?: string
}

export interface AppendCenterRawEventInput {
  profileId: string
  producerId: string
  actorId?: string
  occurredAt?: string
  eventType: string
  subjectType: string
  subjectId: string
  payload?: Record<string, unknown>
  evidenceRefs?: string[]
}

export interface AttachCenterEvidenceInput {
  profileId: string
  producerId?: string
  subjectType: string
  subjectId: string
  kind: CenterEvidenceKind
  title: string
  uri?: string
  payload?: Record<string, unknown>
}

export interface DeriveCenterObservationInput {
  profileId: string
  producerId: string
  actorId?: string
  observationType: string
  subjectType: string
  subjectId: string
  sourceEventRefs: string[]
  payload?: Record<string, unknown>
  confidence?: number
}

export interface CreateCenterLoopInput {
  profileId: string
  title: string
  domain: string
  status?: CenterLoop['status']
  nextAction?: string
  blockedBy?: string[]
  evidenceRefs?: string[]
}

export interface RecordCenterDecisionInput {
  profileId: string
  projectId?: string
  actorId: string
  title: string
  decision: string
  reason: string
  consequence: string
  evidenceRefs?: string[]
  revisitIf?: string
}

export function createMemoryCenterStorage(initialDataset?: CenterDataset): CenterStorageAdapter {
  let dataset = cloneDataset(initialDataset ?? EMPTY_DATASET)

  return {
    async load() {
      return cloneDataset(dataset)
    },
    async save(nextDataset) {
      dataset = cloneDataset(nextDataset)
    },
  }
}

export function createBrowserCenterStorage(
  storage: Storage = window.localStorage,
  key = DEFAULT_STORAGE_KEY
): CenterStorageAdapter {
  return {
    async load() {
      const raw = storage.getItem(key)
      if (!raw) return cloneDataset(EMPTY_DATASET)
      return normalizeDataset(JSON.parse(raw) as Partial<CenterDataset>)
    },
    async save(dataset) {
      storage.setItem(key, JSON.stringify(dataset))
    },
  }
}

export class CenterLocalSpine {
  constructor(private readonly storage: CenterStorageAdapter) {}

  async createProfile(input: CreateCenterProfileInput): Promise<CenterProfile> {
    const now = new Date().toISOString()
    const profile: CenterProfile = {
      id: generateId(),
      displayName: input.displayName,
      createdAt: now,
      status: 'active',
      storageMode: input.storageMode ?? 'browser-local',
      telemetry: 'off',
    }

    await this.update((dataset) => {
      dataset.profiles.push(profile)
    })

    return profile
  }

  async createActor(input: CreateCenterActorInput): Promise<CenterActor> {
    const actor: CenterActor = {
      id: generateId(),
      profileId: input.profileId,
      kind: input.kind,
      displayName: input.displayName,
      producerId: input.producerId,
    }

    await this.update((dataset) => {
      if (actor.profileId) assertProfileExists(dataset, actor.profileId)
      dataset.actors.push(actor)
    })

    return actor
  }

  async appendRawEvent(input: AppendCenterRawEventInput): Promise<CenterRawEvent> {
    const now = new Date().toISOString()
    const rawEvent: CenterRawEvent = {
      id: generateId(),
      profileId: input.profileId,
      producerId: input.producerId,
      actorId: input.actorId,
      occurredAt: input.occurredAt ?? now,
      recordedAt: now,
      eventType: input.eventType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      payload: input.payload ?? {},
      evidenceRefs: input.evidenceRefs ?? [],
    }

    await this.update((dataset) => {
      assertProfileExists(dataset, input.profileId)
      assertActorBelongsToProfile(dataset, input.actorId, input.profileId)
      assertEvidenceBelongsToProfile(dataset, rawEvent.evidenceRefs, input.profileId)
      dataset.rawEvents.push(rawEvent)
    })

    return rawEvent
  }

  async attachEvidence(input: AttachCenterEvidenceInput): Promise<CenterEvidence> {
    const evidence: CenterEvidence = {
      id: generateId(),
      profileId: input.profileId,
      producerId: input.producerId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      kind: input.kind,
      title: input.title,
      uri: input.uri,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    }

    await this.update((dataset) => {
      assertProfileExists(dataset, input.profileId)
      dataset.evidence.push(evidence)
    })

    return evidence
  }

  async deriveObservation(input: DeriveCenterObservationInput): Promise<CenterObservation> {
    const observation: CenterObservation = {
      id: generateId(),
      profileId: input.profileId,
      producerId: input.producerId,
      actorId: input.actorId,
      observedAt: new Date().toISOString(),
      observationType: input.observationType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      sourceEventRefs: input.sourceEventRefs,
      payload: input.payload ?? {},
      confidence: input.confidence,
    }

    await this.update((dataset) => {
      assertProfileExists(dataset, input.profileId)
      assertActorBelongsToProfile(dataset, input.actorId, input.profileId)
      assertRawEventsBelongToProfile(dataset, input.sourceEventRefs, input.profileId)
      dataset.observations.push(observation)
    })

    return observation
  }

  async createLoop(input: CreateCenterLoopInput): Promise<CenterLoop> {
    const loop: CenterLoop = {
      id: generateId(),
      profileId: input.profileId,
      title: input.title,
      domain: input.domain,
      status: input.status ?? 'active',
      nextAction: input.nextAction,
      blockedBy: input.blockedBy,
      evidenceRefs: input.evidenceRefs ?? [],
      updatedAt: new Date().toISOString(),
    }

    await this.update((dataset) => {
      assertProfileExists(dataset, input.profileId)
      assertEvidenceBelongsToProfile(dataset, loop.evidenceRefs, input.profileId)
      dataset.loops.push(loop)
    })

    return loop
  }

  async recordDecision(input: RecordCenterDecisionInput): Promise<CenterDecision> {
    const decision: CenterDecision = {
      id: generateId(),
      profileId: input.profileId,
      projectId: input.projectId,
      actorId: input.actorId,
      title: input.title,
      decision: input.decision,
      reason: input.reason,
      consequence: input.consequence,
      evidenceRefs: input.evidenceRefs ?? [],
      status: 'active',
      decidedAt: new Date().toISOString(),
      revisitIf: input.revisitIf,
    }

    await this.update((dataset) => {
      assertProfileExists(dataset, input.profileId)
      assertActorBelongsToProfile(dataset, input.actorId, input.profileId)
      assertEvidenceBelongsToProfile(dataset, decision.evidenceRefs, input.profileId)
      dataset.decisions.push(decision)
    })

    return decision
  }

  async exportProfile(profileId: string): Promise<CenterDataset> {
    const dataset = await this.storage.load()
    assertProfileExists(dataset, profileId)
    return filterDatasetByProfile(dataset, profileId)
  }

  async deleteProfile(profileId: string): Promise<void> {
    await this.update((dataset) => {
      assertProfileExists(dataset, profileId)
      dataset.profiles = dataset.profiles.filter((profile) => profile.id !== profileId)
      dataset.actors = dataset.actors.filter((actor) => actor.profileId !== profileId)
      dataset.rawEvents = dataset.rawEvents.filter((event) => event.profileId !== profileId)
      dataset.evidence = dataset.evidence.filter((evidence) => evidence.profileId !== profileId)
      dataset.observations = dataset.observations.filter(
        (observation) => observation.profileId !== profileId
      )
      dataset.loops = dataset.loops.filter((loop) => loop.profileId !== profileId)
      dataset.decisions = dataset.decisions.filter((decision) => decision.profileId !== profileId)
    })
  }

  private async update(mutator: (dataset: CenterDataset) => void): Promise<void> {
    const dataset = await this.storage.load()
    mutator(dataset)
    await this.storage.save(dataset)
  }
}

function assertProfileExists(dataset: CenterDataset, profileId: string) {
  if (!dataset.profiles.some((profile) => profile.id === profileId)) {
    throw new Error(`Center profile not found: ${profileId}`)
  }
}

function assertActorBelongsToProfile(
  dataset: CenterDataset,
  actorId: string | undefined,
  profileId: string
) {
  if (!actorId) return
  const actor = dataset.actors.find((candidate) => candidate.id === actorId)
  if (!actor || actor.profileId !== profileId) {
    throw new Error(`Center actor ${actorId} does not belong to profile ${profileId}`)
  }
}

function assertEvidenceBelongsToProfile(
  dataset: CenterDataset,
  evidenceRefs: string[],
  profileId: string
) {
  const invalidRef = evidenceRefs.find((evidenceId) => {
    const evidence = dataset.evidence.find((candidate) => candidate.id === evidenceId)
    return !evidence || evidence.profileId !== profileId
  })

  if (invalidRef) {
    throw new Error(`Center evidence ${invalidRef} does not belong to profile ${profileId}`)
  }
}

function assertRawEventsBelongToProfile(
  dataset: CenterDataset,
  eventRefs: string[],
  profileId: string
) {
  if (eventRefs.length === 0) {
    throw new Error('Center observation requires at least one source event')
  }

  const invalidRef = eventRefs.find((eventId) => {
    const event = dataset.rawEvents.find((candidate) => candidate.id === eventId)
    return !event || event.profileId !== profileId
  })

  if (invalidRef) {
    throw new Error(`Center raw event ${invalidRef} does not belong to profile ${profileId}`)
  }
}

function filterDatasetByProfile(dataset: CenterDataset, profileId: string): CenterDataset {
  return {
    profiles: dataset.profiles.filter((profile) => profile.id === profileId),
    actors: dataset.actors.filter((actor) => actor.profileId === profileId),
    rawEvents: dataset.rawEvents.filter((event) => event.profileId === profileId),
    evidence: dataset.evidence.filter((evidence) => evidence.profileId === profileId),
    observations: dataset.observations.filter((observation) => observation.profileId === profileId),
    loops: dataset.loops.filter((loop) => loop.profileId === profileId),
    decisions: dataset.decisions.filter((decision) => decision.profileId === profileId),
  }
}

function cloneDataset(dataset: CenterDataset): CenterDataset {
  return structuredClone(dataset)
}

function normalizeDataset(dataset: Partial<CenterDataset>): CenterDataset {
  return {
    profiles: dataset.profiles ?? [],
    actors: dataset.actors ?? [],
    rawEvents: dataset.rawEvents ?? [],
    evidence: dataset.evidence ?? [],
    observations: dataset.observations ?? [],
    loops: dataset.loops ?? [],
    decisions: dataset.decisions ?? [],
  }
}
