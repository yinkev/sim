---
id: center-phase-9-implementation
type: implementation-record
project: center
status: implemented
updated: 2026-06-29
links:
  - center-roadmap-v1
  - plane-producer-index
  - capability-metadata-contract-v1
  - emit.plane_project
  - emit.plane_cycle
  - emit.plane_module
  - emit.plane_issue
  - emit.plane_comment
  - emit.plane_status
  - current-plan
---

# Phase 9 Implementation - Plane Producer

## Decision

Plane enters Center through the producer import packet, not through workflow stores, connector registries, provider SDKs, or an authenticated Plane client in the Center route.

## Implemented files

```text
apps/sim/lib/center/producers/plane.ts
apps/sim/lib/center/producers/plane-files.ts
apps/sim/app/api/center/plane/import/route.ts
apps/sim/lib/api/contracts/center.ts
apps/sim/app/center/[workspaceId]/center-surface.tsx
.ai-bridge/capabilities/emit.plane_project.json
.ai-bridge/capabilities/emit.plane_cycle.json
.ai-bridge/capabilities/emit.plane_module.json
.ai-bridge/capabilities/emit.plane_issue.json
.ai-bridge/capabilities/emit.plane_comment.json
.ai-bridge/capabilities/emit.plane_status.json
.ai-bridge/projects/plane-producer/index.md
.ai-bridge/projects/plane-producer/sample-events.json
```

## Mapping

```text
project -> RawEvent plane.project.updated -> Observation planning.project_* -> Evidence source
cycle -> RawEvent plane.cycle.updated -> Observation planning.cycle_* -> Evidence source
module -> RawEvent plane.module.updated -> Observation planning.module_* -> Evidence source
issue -> RawEvent plane.issue.updated -> Observation planning.issue_* -> Evidence source
comment -> RawEvent plane.comment.created -> Observation planning.comment_added -> Evidence note
status -> RawEvent plane.issue.status_changed -> Observation planning.status_* -> Evidence receipt
project projection -> Center Loop with next action and blocker state
```

## Verified source

```text
.ai-bridge/projects/plane-producer/sample-events.json
```

Live import expectation:

```text
records: 6
evidence: 6
raw events: 6
observations: 6
loops: 1
blockedBy: blocked issue + blocked status transition
nextAction: unblock Plane issue
```

## Verification

```text
bun --cwd apps/sim test lib/center/producers/plane.test.ts lib/center/producers/github.test.ts lib/center/producer-import.test.ts
bun --cwd apps/sim type-check
bun run check:api-validation
bun run check:center-boundary
bun run check:boundaries
git diff --check
```

Route smoke:

```text
GET /api/center/plane/import
recordCount: 6
evidence: 6
rawEvents: 6
observations: 6
loops: 1
loop.status: blocked
loop.nextAction: Unblock Plane issue CENTER-101: Plane sync needs reviewable blocker state
```

Browser smoke:

```text
/workspace/local-test/center
create profile
click Import Plane
localStorage contains 6 evidence, 6 raw events, 6 observations, and 1 blocked loop
Next Actions renders Unblock Plane issue CENTER-101: Plane sync needs reviewable blocker state
Project State / Blocked Loops render Plane Center Operating Surface
```
