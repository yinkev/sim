# Center Documentation Index

## Purpose

This directory is the canonical project documentation for Center inside Sim.

Repository path: `apps/sim/docs/center/`  
Owning project: Center  
Owner: Sim maintainers  
Current status: Phase 0-12 implementation exists; dogfood hardening remains governed by review packets.

Center is the local-first operating surface for personal execution. It is not the workflow editor, not a generic dashboard, and not a scheduler. It answers what is happening, what changed, what matters, what is blocked, what evidence exists, what should happen next, what decision is needed, and what was learned.

Within the approved product architecture, Center is a proving-ground projection and control surface. Its
local dataset does not own canonical Task, Artifact, Execution, Identity/Policy, Decision, or Activity
Event state. [ADR 0004](../architecture/adr/0004-control-surfaces-project-canonical-domain-state.md)
defines the ownership and future mapping boundary.

## Source Of Truth

System truth lives here:

- `apps/sim/docs/center/architecture.md`
- `apps/sim/docs/center/ontology-and-local-spine.md`
- `apps/sim/docs/center/producer-model.md`
- `apps/sim/docs/center/capability-system.md`
- `apps/sim/docs/center/operations-and-dogfood.md`
- `apps/sim/docs/center/morning-dogfood-runbook.md`

Implementation truth lives in code under `apps/sim/app/center/`, `apps/sim/app/api/center/`, and `apps/sim/lib/center/`.

## Read Order

1. `apps/sim/docs/architecture/README.md`
2. `apps/sim/docs/center/architecture.md`
3. `apps/sim/docs/center/ontology-and-local-spine.md`
4. `apps/sim/docs/center/producer-model.md`
5. `apps/sim/docs/center/capability-system.md`
6. `apps/sim/docs/center/operations-and-dogfood.md`
7. `apps/sim/docs/center/morning-dogfood-runbook.md`

## Runtime Inputs

Source-controlled inputs:

```text
apps/sim/config/center/        capability metadata, connections, schemas
apps/sim/fixtures/center/      producer and review-packet fixtures
```

Mutable local outputs:

```text
var/center/storage/            workspace datasets
var/center/evidence/           generated local verification evidence
var/center/apps/               generated Center.app bundles
```

`var/` is ignored and never owns durable system truth.

## Dependency Boundary

Center must not statically import workflow editor stores, executable block registries, connector registries, Monaco, Mermaid, the execution sandbox, or provider SDK registries. The boundary is enforced by:

```text
bun run check:center-boundary
```

## Current Coverage

Implemented:

- Lightweight Center route and local profile spine.
- Workspace-scoped local storage with browser-local fallback.
- Producer imports for MS2Scheduler, GitHub, Plane, Learn/Understand, workers, and review packets.
- Registered capability-id validation plus local capability metadata files; authority,
  truth-impact, lifecycle, and policy enforcement remains pending.
- Profile export/delete, baseline prediction, and explicit local-only sync status.
- Read-only live GitHub and Plane import paths behind environment configuration.

Not complete:

- Production sync beyond local workspace JSON storage.
- External execution beyond local gated proposal-state transitions.
- Live Learn/Understand and worker connectors.

## Related Documents

- `apps/sim/docs/architecture/adr/0004-control-surfaces-project-canonical-domain-state.md`
- `apps/sim/docs/LOCAL_DEV_PROFILES.md`
- `apps/sim/docs/DEV_COMPILE_PERF.md`
- `apps/sim/config/center/schemas/capability.schema.json`
- `apps/sim/config/center/capabilities/`
