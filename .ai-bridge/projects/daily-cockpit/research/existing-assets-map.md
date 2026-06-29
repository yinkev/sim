---
id: daily-cockpit-existing-assets-map
type: research
project: daily-cockpit
status: active
updated: 2026-06-28
links:
  - daily-cockpit-dogfoodable-alpha-spec
  - RP-20260628-001
---

# Existing Assets Map — Sim + MS2Scheduler

## Summary

Center should reuse existing mature pieces instead of rebuilding them.

The strongest discovery: MS2Scheduler already contains many of the Center spine concepts under different names: deterministic planning, activity capture, calibration, recovery, receipts, trust governance, app surfaces, and a local-first philosophy.

## Sim assets

Workspace:

```text
/Users/kyin/Projects/sim
```

Git state observed:

```text
main...upstream/main [ahead 14, behind 97]
```

Relevant existing pieces:

- `apps/sim/app/workspace/[workspaceId]/home/` — Mothership chat/home surface.
- `apps/sim/app/workspace/[workspaceId]/mothership/` — Mothership control panel.
- `apps/sim/app/workspace/[workspaceId]/understand/` — existing Understand route.
- `apps/sim/app/workspace/[workspaceId]/scheduled-tasks/` — schedule substrate.
- `apps/sim/app/workspace/[workspaceId]/knowledge/` — knowledge bases/connectors.
- `apps/sim/app/workspace/[workspaceId]/files/` — files/documents.
- `apps/sim/app/workspace/[workspaceId]/tables/` — structured data.
- `apps/sim/app/workspace/[workspaceId]/logs/` — execution logs and observability.
- `apps/sim/app/workspace/[workspaceId]/settings/components/mcp/` — MCP settings.
- `apps/sim/lib/workspace-events/` — existing workspace event trigger infrastructure.
- `apps/sim/connectors/github/` and GitHub trigger entries — GitHub integration exists.
- `.agents/skills/` — workspace-local capability/skill system exists and CodexPro now exposes it.

Important risk:

- Existing workspace route graph is heavy.
- Documented chain: workspace shell/layout imports workflow stores, which import `getBlock`, which pulls block registry and many block modules.
- Center must avoid importing workflow editor/block registry on the hot path.

## Sim skills exposed by CodexPro

CodexPro discovered workspace skills from `.agents/skills/`, including:

- `memory-load-check`
- `emcn-design-review`
- `react-query-best-practices`
- `db-migrate`
- `add-connector`
- `add-integration`
- `add-tools`
- `add-trigger`
- `validate-connector`
- `validate-integration`
- `cleanup`
- `council`

Implication:

Use existing Sim skills for review/build work. Do not recreate capability prompts manually.

## MS2Scheduler assets

Workspace:

```text
/Users/kyin/Projects/MS2Scheduler
```

Git state observed:

```text
main...origin/main [ahead 5]
```

Important files:

- `docs/MS2Scheduler-product-thesis.md`
- `docs/VISION.md`
- `docs/wiki/Architecture.md`
- `docs/wiki/The-Engine.md`
- `docs/wiki/Surfaces.md`
- `engine/README.md`
- `app/README.md`
- `app/capture.py`
- `app/calibrate.py`
- `app/evidence.py`
- `app/recovery.py`
- `app/tank.py`
- `engine/leveler.py`
- `engine/flow.py`
- `engine/resilience.py`

## MS2Scheduler maturity assessment

MS2Scheduler is not an immature side prototype. It already has:

- deterministic scheduler engine
- pure planning contract
- max-flow infeasibility oracle
- resilience/recovery kernel
- activity capture
- calibration from actual minutes
- evidence/receipts concepts
- Today and Recovery surfaces
- QA reports and many tests
- ADRs and wiki documentation

Relevant existing claims from docs:

- Engine is pure: no I/O, no wall-clock, no randomness, no third-party deps in core planning modules.
- Same inputs produce identical plans.
- PlanResult includes reason strings and input hash.
- Activity capture writes start/pause/resume/end events to append-only JSONL.
- Calibration observes actual minutes and updates task estimates.
- Recovery is first-class and shame-free.
- Receipts/proof-of-work are core to trust.

## Architecture implication

Do not rebuild Scheduler inside Center.

Instead:

```text
MS2Scheduler = first mature producer/module for Center
Center = operating surface + cross-domain observation/loop/evidence layer
```

MS2Scheduler should feed Center with:

- study loops
- planned tasks
- actual activity observations
- calibration updates
- recovery proposals
- evidence/receipts
- schedule health / divergence state

## Missing Center pieces after inspecting both repos

Still needed:

1. Center route/surface inside Sim.
2. Profile isolation for dogfooding multiple users locally.
3. Center-level observation schema that can accept MS2Scheduler outputs and future GitHub/Plane/worker outputs.
4. Loop model generalized beyond study.
5. Evidence model generalized beyond scheduler receipts.
6. Lightweight visual Center surface that avoids workflow editor imports.
7. Review-packet import/update workflow for Pro responses.
8. Privacy/export/delete profile workflow.
9. Simple prediction summaries with insufficient-data states.
10. Adapter boundary between MS2Scheduler and Center.

## Recommended reuse strategy

Use MS2Scheduler as the model for:

- deterministic engine boundaries
- no-LLM authority rule
- receipts over rationale
- shame-free recovery language
- observation-backed calibration
- recovery diff before mutation
- local-first, git/file-backed trust model

Use Sim as the host for:

- UI shell
- Mothership
- Understand
- knowledge/files/tables/logs
- MCP/workflow/integration infrastructure
- GitHub and future Plane integration

Use Center as the unifying layer:

```text
Producers -> observations -> loop graph -> evidence -> predictions/recommendations -> visual surface
```

Initial producers:

- MS2Scheduler
- manual capture
- Sim workflow events

Later producers:

- GitHub
- Plane
- Calendar
- workers/agents
- Learn
- Understand
- browser/computer activity when available
