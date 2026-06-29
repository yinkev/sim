---
id: center-ontology-freeze-v1
type: ontology-freeze
status: frozen
updated: 2026-06-29
links:
  - center-interfaces
  - ai-bridge-global-decisions
---

# Center Ontology Freeze v1

## Final vision

Center is the local-first operating surface for personal execution.

It is not a dashboard, chatbot, workflow editor, scheduler, or generic task manager.

It answers:

- What is happening?
- What changed?
- What matters?
- What is blocked?
- What evidence exists?
- What should happen next?
- What decision is needed?
- What did we learn?

## Mature system roles

```text
Sim = host platform
Center = operating surface
Workflow = automation feature
MS2Scheduler = first mature producer
Hermes / Codex / workers = execution producers
GitHub / Plane / Calendar / etc. = external state producers
repository docs = stable project/system documentation
.ai-bridge = governance/evolution system
```

Canonical Center system documentation:

```text
apps/sim/docs/center/README.md
```

## Long-term flow

```text
Capabilities / Producers
  -> Raw Events
  -> Observations
  -> Evidence
  -> Loops
  -> Feature Projections
  -> Predictions
  -> Recommendations
  -> Action Proposals
  -> Decisions
  -> Outcomes
  -> New Events
```

The architecture must survive replacing Sim, GitHub, Plane, MS2Scheduler, or the LLM provider.

## Fundamental primitives

### Profile

Definition: isolated local data container for one human/tester.

Ownership: Center.

Lifecycle: create -> use -> export/delete/archive.

Why fundamental: prevents cross-user leakage and enables dogfooding by others.

Relationship: owns events, observations, evidence, loops, policies, predictions.

### Actor

Definition: entity that performed, asserted, inferred, reviewed, or executed something.

Examples: human, system, scheduler, workflow, agent, integration, prediction-model, reviewer.

Ownership: Center identity/provenance layer.

Why fundamental: trust requires knowing who/what acted.

### Raw Event

Definition: append-only fact that happened.

Ownership: producer emits; Center stores.

Lifecycle: append -> referenced -> archived/exported/deleted with profile.

Why fundamental: immutable factual substrate.

Not the same as Observation.

### Evidence

Definition: proof, artifact, source, log, test, diff, receipt, screenshot, output, or trace.

Ownership: producer creates; Center indexes.

Why fundamental: trust is impossible without receipts.

### Decision

Definition: accepted choice with actor, reason, evidence, and consequence.

Ownership: Center / `.ai-bridge`.

Why fundamental: the system must learn judgment, not only behavior.

### Policy

Definition: rule controlling read/write/export/delete/sync/privacy/approval.

Ownership: Center governance layer.

Why fundamental: local-first is meaningless without enforceable policy.

### Capability

Definition: declared ability a producer/module can provide.

Examples: emit.study_activity, emit.github_commit, emit.recovery_proposal, read.calendar_events, write.plane_issue, run.worker_task, predict.loop_drift, summarize.evidence.

Ownership: capability registry.

Classification: architectural primitive, not world primitive.

Why needed: prevents bespoke integrations.

## Derived primitives

### Producer

Definition: implementation/source that emits events or executes capabilities.

Derived from capability + implementation.

Examples: MS2Scheduler, GitHub, Plane, Hermes, CodexPro, Calendar, Manual capture.

### Observation

Definition: semantic interpretation derived from raw events.

Example: Raw Event `task_start at 09:02`; Observation `Kevin began planned Cardio review 12 minutes after recommended start.`

### Loop

Definition: ongoing domain of work/life/study requiring state, action, review, and evidence.

Derived/projected from observations, decisions, actions, and outcomes.

Still first-class in Center UI.

### Feature Projection

Definition: deterministic derived signal from events/observations.

Examples: start_latency_7d_mean, completion_rate_by_time_bucket, loop_stall_days, recovery_acceptance_rate.

### Prediction

Definition: probabilistic estimate with uncertainty, data sufficiency, drivers, and model version.

Derived from features.

### Recommendation

Definition: suggested next move.

Derived from observations, predictions, policy, and evidence.

### Action Proposal

Definition: reviewable proposed mutation/execution.

Derived from recommendations or producer requests.

### Outcome

Definition: observed result after an action, recommendation, prediction, or decision.

Derived but stored because it closes the learning loop.

## Freeze rule

This file is frozen as ontology v1. Do not silently mutate these definitions. If implementation evidence requires a change, create a new decision that supersedes v1 and state the migration impact.

This file is a governance freeze record. Runtime schema and local-spine documentation live in `apps/sim/docs/center/ontology-and-local-spine.md`.
