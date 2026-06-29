---
id: center-phase-6-implementation
type: implementation-record
project: center
status: implemented
updated: 2026-06-29
links:
  - center-roadmap-v1
  - center-interfaces
  - current-plan
---

# Phase 6 Implementation - Baseline Prediction

## Decision

The first prediction implementation is deterministic and local. It derives a transparent profile-level `loop_drift` summary from Center data and does not call an LLM or claim calibrated probability.

## Implemented files

```text
apps/sim/lib/center/baseline-prediction.ts
apps/sim/lib/center/baseline-prediction.test.ts
apps/sim/lib/center/types.ts
apps/sim/lib/center/local-spine.ts
apps/sim/app/center/[workspaceId]/center-surface.tsx
```

## Model

```text
modelVersion: center-baseline-v1
predictionType: loop_drift
targetType: profile
```

Signals:

```text
raw_event_count_30d
observation_count_30d
active_loop_count
blocked_loop_count
open_action_proposal_count
evidence_count_30d
study_completion_count_30d
outcome_count
```

Data sufficiency:

```text
none -> confidence 0
low -> confidence 0.2
medium -> confidence 0.45
high -> confidence 0.65
```

The baseline may emit a coarse risk score only when status is `baseline`; the UI explicitly labels it as a heuristic, not a calibrated probability.

## Verification

```text
bun --cwd apps/sim test lib/center/local-spine.test.ts lib/center/baseline-prediction.test.ts lib/center/producer-import.test.ts lib/center/producers/ms2scheduler.test.ts
bun --cwd apps/sim type-check
bun run check:api-validation
bun run check:center-boundary
bun run check:boundaries
git diff --check
```

Browser smoke:

```text
/workspace/local-test/center
create profile
prediction shows Insufficient data and confidence 0%
save three manual events
prediction shows Baseline loop drift, confidence 45%, and 8 feature refs
localStorage contains 3 raw events and 3 observations
```
