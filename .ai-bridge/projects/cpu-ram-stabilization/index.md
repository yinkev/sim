---
id: cpu-ram-stabilization-index
type: index
project: cpu-ram-stabilization
status: active
updated: 2026-06-28
links:
  - current-plan
  - center-decisions
  - center-interfaces
---

# CPU/RAM Stabilization Project

## Objective

Make Sim locally usable before Center implementation.

Kevin reported extreme CPU and RAM usage. Existing Sim documentation confirms a measured cold-compile/workspace route problem.

## Current call

Phase 0 remains the active execution task.

Do not begin Center product implementation until Sim local development is usable or this blocker is explicitly waived.

## Evidence

Read:

```text
apps/sim/docs/DEV_COMPILE_PERF.md
```

Known chain:

```text
workspace shell/layout
  -> workflow stores
  -> getBlock
  -> blocks barrel
  -> registry
  -> hundreds of block modules
```

Prior attempted decoupling exposed a block/trigger circular dependency and was reverted.

## Interface to Center

CPU/RAM stabilization exposes constraints Center must obey:

- Center route must not top-level import workflow editor stores.
- Center route must not top-level import block registry.
- Center route must not top-level import connector registry.
- Heavy modules must be lazy-loaded behind explicit user action.
- Development commands must include a low-resource Center/app path.

## First implementation targets

1. Document dev command map.
2. Add/verify `dev:lite` and `dev:center` or equivalent.
3. Preserve `dev:full:capped`.
4. Add import-boundary plan/check for Center route.
5. Avoid touching product behavior unless needed.

## Acceptance

- Kevin has a low-resource daily dev command.
- Center development can proceed without loading workflow editor/block registry hot path.
- Documentation explains when to use each dev profile.
- No broad product behavior changes are introduced by this phase.
