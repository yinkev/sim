---
id: cpu-ram-stabilization-phase-0-plan
type: execution-plan
project: cpu-ram-stabilization
status: active
updated: 2026-06-28
links:
  - current-plan
  - center-governing-spec-v1
---

# Phase 0 Plan - Sim CPU/RAM Stabilization

## Objective

Make local Sim development usable before Center product implementation.

## Read first

- `apps/sim/docs/DEV_COMPILE_PERF.md`
- root `package.json`
- `apps/sim/package.json`
- `turbo.json`
- `apps/sim/next.config.ts`
- workspace shell/layout files under `apps/sim/app/workspace/[workspaceId]/`

## Outputs

- Low-resource root dev command.
- Center-focused root dev command.
- `apps/sim/docs/LOCAL_DEV_PROFILES.md`.
- Import-boundary plan for Center route.

## Acceptance

- Kevin has a low-resource daily dev command.
- Center development does not load workflow/block registry hot path.
- No product behavior regression.
- Commands are documented.
- Process/import map is captured.

## Rollback

- Revert script/doc changes.
- Preserve existing `dev` and `dev:full` commands.
- Preserve existing `dev:full:capped` command.

## Measurable completion

- `package.json` scripts parse.
- `apps/sim/package.json` scripts parse.
- `apps/sim/docs/LOCAL_DEV_PROFILES.md` documents process map and commands.
- Import-boundary plan names exact current hot-path imports and forbidden Center route imports.
