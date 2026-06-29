---
id: center-phase-10-implementation
type: implementation-record
project: center
status: implemented
updated: 2026-06-29
links:
  - center-roadmap-v1
  - learn-understand-producers-index
  - capability-metadata-contract-v1
  - emit.learn_learning_gap
  - emit.learn_practice_task
  - emit.learn_review_evidence
  - emit.understand_system_map
  - emit.understand_dependency_observation
  - emit.understand_risk_evidence
  - current-plan
---

# Phase 10 Implementation - Learn / Understand Producers

## Decision

Learn and Understand enter Center through producer import packets. Center does not import the existing Understand route, tool registry, workflow blocks, or analysis pipeline.

## Implemented files

```text
apps/sim/lib/center/producers/learn-understand.ts
apps/sim/lib/center/producers/learn-understand-files.ts
apps/sim/app/api/center/learn-understand/import/route.ts
apps/sim/lib/api/contracts/center.ts
apps/sim/app/center/[workspaceId]/center-surface.tsx
.ai-bridge/capabilities/emit.learn_learning_gap.json
.ai-bridge/capabilities/emit.learn_practice_task.json
.ai-bridge/capabilities/emit.learn_review_evidence.json
.ai-bridge/capabilities/emit.understand_system_map.json
.ai-bridge/capabilities/emit.understand_dependency_observation.json
.ai-bridge/capabilities/emit.understand_risk_evidence.json
.ai-bridge/projects/learn-understand-producers/index.md
.ai-bridge/projects/learn-understand-producers/sample-events.json
```

## Mapping

```text
learning_gap -> learn packet -> RawEvent learn.learning_gap.detected -> Observation learning.gap_detected -> Evidence source
practice_task -> learn packet -> RawEvent learn.practice_task.created -> Observation learning.practice_task_* -> Evidence receipt
review_evidence -> learn packet -> RawEvent learn.review_evidence.recorded -> Observation learning.review_completed -> Evidence test
system_map -> understand packet -> RawEvent understand.system_map.generated -> Observation understanding.system_mapped -> Evidence artifact
dependency_observation -> understand packet -> RawEvent understand.dependency_observed -> Observation understanding.dependency_observed -> Evidence source
risk_evidence -> understand packet -> RawEvent understand.risk_detected -> Observation understanding.risk_detected -> Evidence source
topic/scope projection -> Center Loop with next action and blocker state
```

## Verified source

```text
.ai-bridge/projects/learn-understand-producers/sample-events.json
```

Live import expectation:

```text
records: 6
packets: 2
evidence: 6
raw events: 6
observations: 6
loops: 2
```

## Verification

```text
bun --cwd apps/sim test lib/center/producers/learn-understand.test.ts lib/center/producers/plane.test.ts lib/center/producer-import.test.ts
bun --cwd apps/sim type-check
bun run check:api-validation
bun run check:center-boundary
bun run check:boundaries
git diff --check
```

Capability schema validation:

```text
.ai-bridge/capabilities/emit.learn_learning_gap.json
.ai-bridge/capabilities/emit.learn_practice_task.json
.ai-bridge/capabilities/emit.learn_review_evidence.json
.ai-bridge/capabilities/emit.understand_system_map.json
.ai-bridge/capabilities/emit.understand_dependency_observation.json
.ai-bridge/capabilities/emit.understand_risk_evidence.json
```

Route smoke:

```text
GET /api/center/learn-understand/import
recordCount: 6
packets: learn, understand
evidence: 6
rawEvents: 6
observations: 6
loops: 2
learn loop: Learn Cardiology, blocked, Complete practice task: Complete 10 hemodynamics cards
understand loop: Understand Center, blocked, Review system risk: Producer fixture can drift from live API
```

Browser smoke:

```text
/workspace/local-test/center
create profile
click Import Learn/Understand
localStorage contains 6 evidence, 6 raw events, 6 observations, and 2 blocked loops
Knowledge State renders learning and understanding observations
Next Actions renders Complete practice task: Complete 10 hemodynamics cards
Next Actions renders Review system risk: Producer fixture can drift from live API
```
