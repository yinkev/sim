# Center Ontology And Local Spine

## Purpose

This document describes the runtime Center ontology and the local spine that stores it.

Repository path: `apps/sim/docs/center/ontology-and-local-spine.md`  
Owning project: Center  
Owner: Sim maintainers  
Current status: Runtime data model and local spine are implemented in `apps/sim/lib/center/`.

## Canonical Implementation

Runtime type definitions:

```text
apps/sim/lib/center/types.ts
```

Local write API:

```text
apps/sim/lib/center/local-spine.ts
```

Tests:

```text
apps/sim/lib/center/local-spine.test.ts
```

Governance freeze record:

```text
.ai-bridge/ontology/freeze-v1.md
```

The implementation files are canonical for exact field names. The governance file records the approved primitive split and freeze rule.

## Runtime Dataset

`CenterDataset` contains:

- `profiles`
- `actors`
- `rawEvents`
- `evidence`
- `observations`
- `loops`
- `decisions`
- `recommendations`
- `actionProposals`
- `featureProjections`
- `predictionSummaries`
- `outcomes`
- `reviewPackets`

The local spine treats profile isolation as a hard invariant. Every profile-scoped write validates the profile exists. Cross-record references are checked against the same profile where the runtime currently supports that reference.

## Primitives

### Profile

Runtime type: `CenterProfile`  
Purpose: isolated local data container for one user or tester.  
Important fields: `id`, `displayName`, `createdAt`, `status`, `storageMode`, `telemetry`.

Current storage modes are declared as:

```text
local-server | browser-local | workspace
```

Implemented storage adapters today:

- `createMemoryCenterStorage()` for tests.
- `createBrowserCenterStorage()` for local UI use.

`local-server` and `workspace` are declared storage modes, not implemented user-facing adapters.

### Actor

Runtime type: `CenterActor`  
Purpose: entity that performed, asserted, inferred, reviewed, or executed something.

Actor kinds:

```text
human
system
scheduler
workflow
agent
integration
prediction-model
reviewer
```

### Raw Event

Runtime type: `CenterRawEvent`  
Purpose: append-only fact that happened.

Raw events are producer-emitted facts. They are not semantic interpretations. Observations reference raw event ids through `sourceEventRefs`.

### Evidence

Runtime type: `CenterEvidence`  
Purpose: proof, artifact, source, log, test, diff, receipt, screenshot, output, or trace.

Evidence kinds:

```text
log
diff
test
artifact
screenshot
note
source
run-output
receipt
```

### Observation

Runtime type: `CenterObservation`  
Purpose: semantic interpretation derived from raw events.

The local spine requires referenced raw events to belong to the same profile.

### Loop

Runtime type: `CenterLoop`  
Purpose: ongoing domain of work requiring state, action, review, and evidence.

Loop statuses:

```text
active
paused
blocked
done
archived
```

Loops are first-class UI records in Center.

### Decision

Runtime type: `CenterDecision`  
Purpose: accepted choice with actor, reason, evidence, consequence, and revisit condition.

Decisions are runtime records in Center and governance records in `.ai-bridge` when they change project truth.

### Recommendation

Runtime type: `CenterRecommendation`  
Purpose: suggested next move, usually derived from observations, predictions, policy, and evidence.

### Action Proposal

Runtime type: `CenterActionProposal`  
Purpose: reviewable proposed mutation or execution.

Current statuses:

```text
proposed
approved
executed
rejected
superseded
```

### Feature Projection

Runtime type: `CenterFeatureProjection`  
Purpose: deterministic derived signal from events and observations.

Baseline prediction currently creates stable feature ids with model version `center-baseline-v1`.

### Prediction Summary

Runtime type: `CenterPredictionSummary`  
Purpose: probabilistic or heuristic estimate with data sufficiency, confidence, drivers, feature refs, and model version.

Current implementation is baseline only. It reports `insufficient-data` when evidence is too thin and avoids fake precision.

### Outcome

Runtime type: `CenterOutcome`  
Purpose: observed result after a prediction, recommendation, action, loop, or task.

Outcome scoring is not implemented beyond storing outcome records.

### Review Packet

Runtime type: `CenterReviewPacket`  
Purpose: visible governance record with status, approval state, worker gate, round count, evidence refs, and decision refs.

Source records come from:

```text
.ai-bridge/projects/center/reviews/*.md
```

## Governance-Only Or Separate Primitives

These approved primitives are not stored as ordinary `CenterDataset` arrays today:

- Policy: governed by `.ai-bridge/protocols/execution-authority.md` and future Center policy work.
- Capability: registered as metadata under `.ai-bridge/capabilities/*.json` and explained in `apps/sim/docs/center/capability-system.md`.
- Producer: represented by producer ids, import packet builders, route contracts, and capability metadata.

## Local Spine Operations

`CenterLocalSpine` supports:

- `createProfile`
- `createActor`
- `appendRawEvent`
- `attachEvidence`
- `deriveObservation`
- `createLoop`
- `recordDecision`
- `createRecommendation`
- `createActionProposal`
- `createFeatureProjection`
- `createPredictionSummary`
- `recordOutcome`
- `createReviewPacket`
- `exportProfile`
- `deleteProfile`

## Export And Delete Contract

`exportProfile(profileId)` returns only records owned by that profile.

`deleteProfile(profileId)` removes profile-scoped records for:

- profile
- actors
- raw events
- evidence
- observations
- loops
- decisions
- recommendations
- action proposals
- feature projections
- prediction summaries
- outcomes
- review packets

This is implemented in `apps/sim/lib/center/local-spine.ts` and tested in `apps/sim/lib/center/local-spine.test.ts`.

## Extension Rules

Add new runtime primitives only when two implementers would otherwise diverge or when a producer cannot be represented by existing records.

When adding fields:

- Update `apps/sim/lib/center/types.ts`.
- Update `apps/sim/lib/center/local-spine.ts` if the field affects writes or invariants.
- Update `apps/sim/lib/api/contracts/center.ts` if it crosses an HTTP boundary.
- Update producer import tests.
- Record the decision in `.ai-bridge/projects/center/decisions.md` if project truth changes.

## Related Documents

- `apps/sim/docs/center/architecture.md`
- `apps/sim/docs/center/producer-model.md`
- `apps/sim/docs/center/capability-system.md`
- `.ai-bridge/ontology/freeze-v1.md`
- `.ai-bridge/projects/center/decisions.md`
