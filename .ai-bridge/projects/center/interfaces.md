---
id: center-interfaces
type: interface
project: center
status: active
updated: 2026-06-28
links:
  - center-index
  - RP-20260628-002
  - ms2scheduler-integration-interfaces
---

# Center Interfaces

## Purpose

This file defines the core contracts Center owns or consumes.

Center is the operating surface. Producers emit data into Center through stable contracts. Center must not depend on producer internals.

## Frozen primitive split

Fundamental primitives:

```text
Profile
Actor
RawEvent
Evidence
Decision
Policy
Capability
```

Derived primitives:

```text
Producer
Observation
Loop
FeatureProjection
PredictionSummary
Recommendation
ActionProposal
Outcome
```

## Profile

Isolated local data container for one user/tester.

```ts
type CenterProfile = {
  id: string
  displayName: string
  createdAt: string
  storageMode: 'local-server' | 'browser-local' | 'workspace'
  exportable: boolean
  telemetry: 'off' | 'explicit-opt-in'
}
```

## Actor

Who performed, asserted, inferred, or executed something.

```ts
type CenterActor = {
  id: string
  profileId?: string
  type: 'human' | 'system' | 'scheduler' | 'workflow' | 'agent' | 'integration' | 'prediction-model' | 'reviewer'
  displayName: string
  producerId?: string
}
```

## Capability

Declared ability a producer/module can provide.

```ts
type CenterCapability = {
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

type SchemaRef = {
  id: string
  version?: string
  uri?: string
}
```

## Producer

Implementation/source that emits events or executes capabilities. Producer is derived from capability + implementation.

```ts
type CenterProducer = {
  id: string
  implementationKind: 'manual' | 'scheduler' | 'workflow' | 'agent' | 'github' | 'plane' | 'calendar' | 'learn' | 'understand' | 'system'
  displayName: string
  capabilityIds: string[]
  lifecycle: 'draft' | 'registered' | 'available' | 'connected' | 'disabled' | 'deprecated' | 'removed'
}
```

## Raw Event

Append-only fact that happened. Raw events should not be edited in place.

```ts
type CenterRawEvent = {
  id: string
  profileId: string
  occurredAt: string
  recordedAt: string
  producerId: string
  actorId?: string
  eventType: string
  subjectType: string
  subjectId: string
  payload: Record<string, unknown>
  evidenceRefs: string[]
  quality?: number
  confidence?: number
}
```

## Observation

Semantic interpretation derived from one or more raw events.

```ts
type CenterObservation = {
  id: string
  profileId: string
  observedAt: string
  producerId: string
  actorId?: string
  subjectType: 'loop' | 'task' | 'session' | 'agent-run' | 'workflow-run' | 'evidence' | 'review' | 'external-ref'
  subjectId: string
  observationType: string
  sourceEventRefs: string[]
  payload: Record<string, unknown>
  confidence?: number
  quality?: number
  sourceRef?: string
}
```

## Evidence

Proof or trace attached to a loop, task, workflow, agent run, prediction, recommendation, action, outcome, or decision.

```ts
type CenterEvidence = {
  id: string
  profileId: string
  subjectType: string
  subjectId: string
  kind: 'log' | 'diff' | 'test' | 'artifact' | 'screenshot' | 'note' | 'source' | 'run-output' | 'receipt'
  title: string
  uri?: string
  payload?: Record<string, unknown>
  createdAt: string
  sourceRef?: string
  quality?: number
}
```

## Loop

Ongoing domain of work/study/life requiring state, action, review, and evidence.

```ts
type CenterLoop = {
  id: string
  profileId: string
  title: string
  domain: string
  status: 'active' | 'paused' | 'blocked' | 'done' | 'archived'
  health?: number
  momentum?: number
  entropy?: number
  nextAction?: string
  blockedBy?: string[]
  evidenceRefs: string[]
  updatedAt: string
}
```

## Decision

Accepted choice with rationale, actor, and evidence.

```ts
type CenterDecision = {
  id: string
  profileId?: string
  projectId?: string
  title: string
  decision: string
  reason: string
  actorId: string
  evidenceRefs: string[]
  status: 'active' | 'superseded' | 'rejected'
  decidedAt: string
  revisitIf?: string
}
```

## Feature Projection

Deterministic derived signal from raw events and observations. First implementation can compute on demand; a separate feature store can come later.

```ts
type CenterFeatureProjection = {
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
```

## Prediction Summary

Transparent, uncertainty-aware estimate. LLMs may explain but do not own the prediction source of truth.

```ts
type CenterPredictionSummary = {
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
```

## Recommendation

Suggested next move based on observations, features, predictions, policy, and evidence.

```ts
type CenterRecommendation = {
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
```

## Action Proposal

Reviewable change before execution.

```ts
type CenterActionProposal = {
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
```

## Outcome

Observed result after a recommendation/action/prediction.

```ts
type CenterOutcome = {
  id: string
  profileId: string
  subjectType: 'prediction' | 'recommendation' | 'action' | 'loop' | 'task'
  subjectId: string
  outcomeType: string
  observedAt: string
  payload: Record<string, unknown>
  evidenceRefs: string[]
}
```

## Policy

Local privacy and read/write/export/delete rules.

```ts
type CenterPolicy = {
  id: string
  profileId: string
  scope: 'profile' | 'producer' | 'loop' | 'evidence' | 'prediction'
  rule: string
  effect: 'allow' | 'deny' | 'require-approval'
  createdAt: string
}
```

## Recovery Proposal

A specialized action proposal produced when a plan/loop diverges.

```ts
type CenterRecoveryProposal = {
  id: string
  profileId: string
  loopId: string
  producerId: string
  createdAt: string
  reason: string
  changes: Array<Record<string, unknown>>
  evidenceRefs: string[]
  status: 'proposed' | 'approved' | 'rejected' | 'superseded'
}
```

## Producer interface

First implementation should define the interface, not a full SDK.

```ts
type CenterProducerAdapter = {
  id: string
  displayName: string
  sync?: () => Promise<CenterRawEvent[]>
  normalize: (events: CenterRawEvent[]) => Promise<CenterObservation[]>
}
```

## Hard boundary

Center must not require the full Sim workflow editor/block registry in its default route.

Heavy modules must be lazy-loaded behind explicit user action.

Center route should not top-level import:

- workflow editor stores
- block registry
- connector registry
- Monaco
- mermaid
- document parsers
- execution sandbox
- provider SDK registries
