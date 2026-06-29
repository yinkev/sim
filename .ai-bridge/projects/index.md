---
id: ai-bridge-projects-index
type: index
status: active
updated: 2026-06-28
links:
  - ai-bridge-index
  - center-index
  - cpu-ram-stabilization-index
  - ms2scheduler-integration-index
  - pro-review-workflow-index
---

# Projects Index

## Purpose

This folder separates durable project context by mission so `current-plan.md` can stay focused on the one active executable task.

## Active projects

| Project | Status | Purpose |
|---|---:|---|
| `center/` | active | The daily operating surface: loops, observations, evidence, predictions, agents, and next actions. |
| `cpu-ram-stabilization/` | active | Make Sim locally usable before Center implementation. |
| `ms2scheduler-integration/` | active | Reuse MS2Scheduler as the first mature producer/module feeding Center. |
| `pro-review-workflow/` | active | Review packets, governor loop, decision capture, and cross-model relay. |
| `daily-cockpit/` | legacy-active | Older working folder. Keep as source material until contents are migrated. |

## Rule

Use project folders for durable context.

Use root `.ai-bridge/current-plan.md` for the one active execution plan.

Do not let project folders become execution targets unless `current-plan.md` points to them.
