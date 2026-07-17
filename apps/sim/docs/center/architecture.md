# Center Architecture

## Purpose

This document explains what Center is, where it runs, which modules own it, and which dependency boundaries protect it.

Repository path: `apps/sim/docs/center/architecture.md`  
Owning project: Center  
Owner: Sim maintainers  
Current status: Initial local implementation complete through Phase 12; live dogfooding remains credential- and policy-gated.

## Product Boundary

Center is the operating surface for personal execution inside Sim. It turns events, observations, evidence, loops, predictions, recommendations, action proposals, decisions, outcomes, and review packets into one local working surface.

Center is not:

- The workflow editor.
- A block graph.
- A generic task manager.
- A chatbot.
- MS2Scheduler.
- A telemetry surface.

## Canonical Ownership Boundary

Center is the current local-first proving ground and a future projection/control surface over the
canonical domains. Its local workspace dataset may import facts, derive recommendations, display
evidence, and submit proposals or commands. It does not replace canonical Task, Artifact, Execution,
Identity/Policy, Decision, or Activity Event persistence.

A Center record changes canonical state only through an accepted domain contract. In particular, a local
Action Proposal status of `executed` is not proof of a durable Execution without a linked canonical
Execution record. The mapping and migration boundary is accepted in
[ADR 0004](../architecture/adr/0004-control-surfaces-project-canonical-domain-state.md).

## Runtime Shape

Public route:

```text
/workspace/[workspaceId]/center
```

Standalone app route:

```text
apps/sim/app/center/[workspaceId]/
```

The workspace URL is rewritten by `apps/sim/proxy.ts` to the standalone route before the normal workspace layout loads. This is the CPU/RAM stabilization boundary: Center can be opened without pulling the workflow editor hot path.

Primary UI file:

```text
apps/sim/app/center/[workspaceId]/center-surface.tsx
```

Current UI panels:

- Today.
- Next Actions.
- Active Loops.
- Blocked Loops.
- Engineering.
- Project State.
- Knowledge State.
- Agent Work.
- Recent Observations.
- Evidence.
- Prediction Summary.
- Review Needed.
- Review Packets.
- Manual Capture.

## Core Modules

Center runtime modules:

- `apps/sim/lib/center/types.ts` defines the runtime data model.
- `apps/sim/lib/center/local-spine.ts` owns local writes, profile isolation, export, and delete.
- `apps/sim/lib/center/producer-import.ts` applies typed producer packets into a profile.
- `apps/sim/lib/center/baseline-prediction.ts` derives baseline prediction features and a prediction summary.
- `apps/sim/lib/center/review-packets.ts` imports review packet records.
- `apps/sim/lib/center/producers/` maps producer-specific records into Center import packets.
- `apps/sim/lib/api/contracts/center.ts` defines Center import route contracts.

Support scripts:

- `scripts/check-center-import-boundary.ts` enforces the Center import boundary.
- `scripts/package-center-app.ts` generates the local `Center.app` launcher.

## Data Flow

Manual capture:

```text
Center UI
  -> CenterLocalSpine
  -> workspace local-server storage
  -> browser-local fallback if the local route is unavailable
  -> Center panels
```

Producer import:

```text
local source file or MS2 data dir
  -> local development API route under apps/sim/app/api/center/
  -> typed CenterProducerImportPacket
  -> applyCenterProducerImport
  -> workspace profile dataset
  -> Center panels
```

Review packet import:

```text
apps/sim/fixtures/center/review-packets/*.md
  -> apps/sim/lib/center/review-packet-files.ts
  -> CenterReviewPacketImportRecord[]
  -> applyCenterReviewPacketImport
  -> Center Review Packets panel
```

Baseline prediction:

```text
profile dataset
  -> deriveCenterBaselinePrediction
  -> feature projections
  -> prediction summary
  -> Center Prediction Summary panel
```

Prediction outcome scoring:

```text
profile prediction outcomes
  -> scoreCenterPredictionOutcomes
  -> absolute error / Brier score when explicit actual values exist
  -> Center Prediction Summary panel
```

## Dependency Boundary

Center route defaults may import:

- React and small UI primitives.
- `@sim/utils`.
- `@/lib/api/client/request`.
- `@/lib/api/contracts/center`.
- `@/lib/center`.
- Local component styling utilities.

Center route defaults must not top-level import:

- Workflow editor stores.
- Block registry.
- Connector registry.
- Monaco.
- Mermaid.
- Document parsers.
- Execution sandbox.
- Provider SDK registries.

Verification:

```text
bun run check:center-boundary
```

## Local-First Boundary

Current profile data is stored in workspace-scoped local-server JSON through:

```text
apps/sim/app/api/center/storage/[workspaceId]/route.ts
apps/sim/lib/center/file-storage.ts
apps/sim/lib/center/workspace-storage.ts
```

Default storage path:

```text
var/center/storage/<workspaceId>.json
```

Override:

```text
CENTER_WORKSPACE_STORAGE_DIR=/path/to/storage
```

If the local route is unavailable, `createWorkspaceCenterStorage()` falls back to `createBrowserCenterStorage()` with a workspace-scoped browser key.

The current local implementation does not send profile data to telemetry. `CenterSurface` displays
`telemetry off`, profile records have `telemetry: 'off'`, and the Center client instrumentation disables
telemetry on `/center/*`. Machine-level privacy claims must be verified from the current environment and
instrumentation configuration; the current package manifest has no consolidated `center:readiness`
command.

## API Boundary

Center import APIs are contract-bound and wrapped with `withRouteHandler`:

- `apps/sim/app/api/center/ms2scheduler/import/route.ts`
- `apps/sim/app/api/center/github/import/route.ts`
- `apps/sim/app/api/center/plane/import/route.ts`
- `apps/sim/app/api/center/learn-understand/import/route.ts`
- `apps/sim/app/api/center/review-packets/import/route.ts`
- `apps/sim/app/api/center/workers/import/route.ts`

Each route parses its request with `parseRequest()` and a contract from `apps/sim/lib/api/contracts/center.ts`.

These routes are local-development import routes. They are enabled when `CENTER_DEV=1` or when `NODE_ENV` is not production.

## Extension Points

Use these extension seams:

- Add a new producer mapper under `apps/sim/lib/center/producers/`.
- Add route contracts in `apps/sim/lib/api/contracts/center.ts`.
- Add local import routes under `apps/sim/app/api/center/<producer>/import/route.ts`.
- Add capability metadata under `apps/sim/config/center/capabilities/`.
- Add Center UI projection only after the data exists in the local spine.

Do not extend Center by importing producer private state into the route.

## Limitations

- Workspace-scoped local-server JSON is the primary user-facing adapter, with browser-local fallback; it
  is not canonical production domain storage.
- Profile export and delete are exposed in the current UI but remain local-profile operations.
- GitHub and Plane have optional read-only live import paths; Learn/Understand and Worker imports remain
  local file or fixture based.
- Import routes reject unknown declared capability ids, but Center's A0-A4 authority and T0-T4
  truth-impact vocabulary is not yet mapped to canonical Autonomy Policy.
- Prediction is a baseline heuristic, not a calibrated probability model.

## Related Documents

- `apps/sim/docs/center/ontology-and-local-spine.md`
- `apps/sim/docs/center/producer-model.md`
- `apps/sim/docs/center/capability-system.md`
- `apps/sim/docs/center/operations-and-dogfood.md`
- `apps/sim/docs/LOCAL_DEV_PROFILES.md`
- `apps/sim/docs/architecture/migration-roadmap.md`
- `apps/sim/docs/architecture/architecture-invariants.md`
