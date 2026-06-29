---
id: center-ontology-schema-v1
type: schema
status: draft
updated: 2026-06-28
links:
  - center-ontology-freeze-v1
  - capability-metadata-contract-v1
---

# Center Ontology Schema v1

These are implementation-facing schema shapes for the frozen ontology. They are not code yet.

```ts
type Profile = {
  id: string
  displayName: string
  createdAt: string
  status: 'active' | 'archived' | 'deleted'
  storageMode: 'local-server' | 'browser-local' | 'workspace'
  telemetry: 'off' | 'explicit-opt-in'
}

type Actor = {
  id: string
  profileId?: string
  kind: 'human' | 'system' | 'scheduler' | 'workflow' | 'agent' | 'integration' | 'prediction-model' | 'reviewer'
  displayName: string
  producerId?: string
}

type RawEvent = {
  id: string
  profileId: string
  producerId: string
  actorId?: string
  occurredAt: string
  recordedAt: string
  eventType: string
  subjectType: string
  subjectId: string
  payload: Record<string, unknown>
  evidenceRefs: string[]
}

type Evidence = {
  id: string
  profileId: string
  producerId?: string
  subjectType: string
  subjectId: string
  kind: 'log' | 'diff' | 'test' | 'artifact' | 'screenshot' | 'note' | 'source' | 'run-output' | 'receipt'
  title: string
  uri?: string
  payload?: Record<string, unknown>
  createdAt: string
}

type Decision = {
  id: string
  profileId?: string
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

type Policy = {
  id: string
  profileId?: string
  scope: 'profile' | 'producer' | 'loop' | 'evidence' | 'prediction' | 'capability'
  rule: string
  effect: 'allow' | 'deny' | 'require-approval'
  createdAt: string
}

type Capability = {
  id: string
  version: string
  producerId: string
  kind: 'emit' | 'read' | 'write' | 'run' | 'predict' | 'summarize' | 'review'
  inputs: SchemaRef[]
  outputs: SchemaRef[]
  authorityRequired: 'A0' | 'A1' | 'A2' | 'A3' | 'A4'
  truthImpact: 'T0' | 'T1' | 'T2' | 'T3' | 'T4'
  policyRequirements: string[]
  evidenceProduced: string[]
  failureModes: string[]
}

type Producer = {
  id: string
  displayName: string
  implementationKind: 'manual' | 'scheduler' | 'workflow' | 'agent' | 'github' | 'plane' | 'calendar' | 'learn' | 'understand' | 'system'
  capabilityIds: string[]
  status: 'available' | 'connected' | 'disabled' | 'error'
}

type Observation = {
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
}

type Loop = {
  id: string
  profileId: string
  title: string
  domain: string
  status: 'active' | 'paused' | 'blocked' | 'done' | 'archived'
  nextAction?: string
  blockedBy?: string[]
  evidenceRefs: string[]
  updatedAt: string
}

type FeatureProjection = {
  id: string
  profileId: string
  targetType: string
  targetId: string
  featureName: string
  value: number | string | boolean | null
  window?: string
  sourceObservationRefs: string[]
  computedAt: string
  version: string
}

type PredictionSummary = {
  id: string
  profileId: string
  targetType: string
  targetId: string
  predictionType: string
  status: 'insufficient-data' | 'baseline' | 'calibrated'
  probability?: number
  score?: number
  confidence: number
  dataSufficiency: 'none' | 'low' | 'medium' | 'high'
  drivers: Array<{ name: string; direction: 'up' | 'down'; weight?: number }>
  featureRefs: string[]
  generatedAt: string
  modelVersion: string
}

type Recommendation = {
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
}

type ActionProposal = {
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
}

type Outcome = {
  id: string
  profileId: string
  subjectType: 'prediction' | 'recommendation' | 'action' | 'loop' | 'task' | 'decision'
  subjectId: string
  outcomeType: string
  observedAt: string
  payload: Record<string, unknown>
  evidenceRefs: string[]
}
```
