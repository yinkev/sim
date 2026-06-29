---
id: center-index
type: index
project: center
status: active
updated: 2026-06-29
links:
  - ai-bridge-projects-index
  - center-interfaces
  - center-roadmap-v1
  - center-phase-0-12-integration-audit-20260629
  - RP-20260629-003
  - RP-20260629-004
---

# Center Project

## Objective

Build Center as the daily operating surface inside Sim: loops, observations, evidence, predictions, agents, blockers, and next actions.

## Current position

Center roadmap Phase 0-12 is implemented. Center should not be a workflow editor clone or dashboard. It is the operating surface. Workflow remains a feature module.

Next gate:

```text
.ai-bridge/projects/center/reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md
.ai-bridge/projects/center/reviews/RP-20260629-004-pre-dogfood-overnight-hardening.md
```

Resolve that dogfood-readiness review before live integrations or autonomous worker execution.

## Dependency boundaries

Center may depend on project interfaces from:

- `ms2scheduler-integration/` for study observations, recovery proposals, and evidence receipts.
- `cpu-ram-stabilization/` for hot-path import constraints.
- `pro-review-workflow/` for review packets and decision governance.
- `github-producer/`, `plane-producer/`, `learn-understand-producers/`, and `worker-lane/` for producer input shapes.

Center should not depend on random internal notes from those projects.

## Read first

- `interfaces.md`
- `roadmap.md`
- `audits/phase-0-12-integration-audit-20260629.md`
- `reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md`
- `reviews/RP-20260629-004-pre-dogfood-overnight-hardening.md`
- `phase-12-implementation.md`

## Near-term build constraint

Do not start a new feature phase until RP-20260629-003 is resolved.
