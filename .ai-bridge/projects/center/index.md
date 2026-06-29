---
id: center-index
type: index
project: center
status: active
updated: 2026-06-28
links:
  - ai-bridge-projects-index
  - center-interfaces
---

# Center Project

## Objective

Build Center as the daily operating surface inside Sim: loops, observations, evidence, predictions, agents, blockers, and next actions.

## Current position

Center should not be a workflow editor clone or dashboard. It is the operating surface. Workflow remains a feature module.

## Dependency boundaries

Center may depend on project interfaces from:

- `ms2scheduler-integration/` for study observations, recovery proposals, and evidence receipts.
- `cpu-ram-stabilization/` for hot-path import constraints.
- `pro-review-workflow/` for review packets and decision governance.

Center should not depend on random internal notes from those projects.

## Read first

- `interfaces.md`
- `.ai-bridge/projects/daily-cockpit/plans/dogfoodable-alpha-spec.md` until migrated
- `.ai-bridge/projects/daily-cockpit/reviews/RP-20260628-001-v1.md`
- `.ai-bridge/projects/daily-cockpit/research/existing-assets-map.md`

## Near-term build constraint

Do not start Center implementation until CPU/RAM stabilization is addressed or explicitly waived.
