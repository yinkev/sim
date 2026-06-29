export type CenterStorageMode = 'local-server' | 'browser-local' | 'workspace'

export type CenterActorKind =
  | 'human'
  | 'system'
  | 'scheduler'
  | 'workflow'
  | 'agent'
  | 'integration'
  | 'prediction-model'
  | 'reviewer'

export type CenterEvidenceKind =
  | 'log'
  | 'diff'
  | 'test'
  | 'artifact'
  | 'screenshot'
  | 'note'
  | 'source'
  | 'run-output'
  | 'receipt'

export interface CenterProfile {
  id: string
  displayName: string
  createdAt: string
  status: 'active' | 'archived' | 'deleted'
  storageMode: CenterStorageMode
  telemetry: 'off' | 'explicit-opt-in'
}

export interface CenterActor {
  id: string
  profileId?: string
  kind: CenterActorKind
  displayName: string
  producerId?: string
}

export interface CenterRawEvent {
  id: string
  profileId: string
  producerId: string
  actorId?: string
  sourceRef?: string
  occurredAt: string
  recordedAt: string
  eventType: string
  subjectType: string
  subjectId: string
  payload: Record<string, unknown>
  evidenceRefs: string[]
}

export interface CenterEvidence {
  id: string
  profileId: string
  producerId?: string
  subjectType: string
  subjectId: string
  kind: CenterEvidenceKind
  title: string
  uri?: string
  payload?: Record<string, unknown>
  createdAt: string
  sourceRef?: string
}

export interface CenterObservation {
  id: string
  profileId: string
  producerId: string
  actorId?: string
  observedAt: string
  observationType: string
  subjectType: string
  subjectId: string
  sourceEventRefs: string[]
  payload: Record<string, unknown>
  confidence?: number
  sourceRef?: string
}

export interface CenterLoop {
  id: string
  profileId: string
  title: string
  domain: string
  status: 'active' | 'paused' | 'blocked' | 'done' | 'archived'
  nextAction?: string
  blockedBy?: string[]
  evidenceRefs: string[]
  updatedAt: string
  sourceRef?: string
}

export interface CenterDecision {
  id: string
  profileId: string
  projectId?: string
  actorId: string
  title: string
  decision: string
  reason: string
  consequence: string
  evidenceRefs: string[]
  status: 'active' | 'superseded' | 'rejected'
  decidedAt: string
  revisitIf?: string
}

export interface CenterRecommendation {
  id: string
  profileId: string
  targetType: string
  targetId: string
  title: string
  reason: string
  predictionRefs: string[]
  evidenceRefs: string[]
  createdAt: string
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded'
  sourceRef?: string
}

export interface CenterActionProposal {
  id: string
  profileId: string
  recommendationId?: string
  producerId?: string
  actionType: string
  targetType: string
  targetId: string
  payload: Record<string, unknown>
  evidenceRefs: string[]
  status: 'proposed' | 'approved' | 'executed' | 'rejected' | 'superseded'
  createdAt: string
  sourceRef?: string
}

export interface CenterDataset {
  profiles: CenterProfile[]
  actors: CenterActor[]
  rawEvents: CenterRawEvent[]
  evidence: CenterEvidence[]
  observations: CenterObservation[]
  loops: CenterLoop[]
  decisions: CenterDecision[]
  recommendations: CenterRecommendation[]
  actionProposals: CenterActionProposal[]
}
