---
id: plane-producer-index
type: project
status: active
updated: 2026-06-29
links:
  - center-roadmap-v1
  - capability-metadata-contract-v1
  - emit.plane_project
  - emit.plane_cycle
  - emit.plane_module
  - emit.plane_issue
  - emit.plane_comment
  - emit.plane_status
  - center-phase-9-implementation
---

# Plane Producer

## Purpose

Bring project/task reality into Center without making the Center route import workflow stores, connector registries, provider SDKs, or a live Plane client.

## Current interface

Local development imports a bounded Plane-shaped snapshot from:

```text
.ai-bridge/projects/plane-producer/sample-events.json
```

Override path:

```text
CENTER_PLANE_PRODUCER_FILE=/path/to/events.json
```

## Registered capabilities

```text
.ai-bridge/capabilities/emit.plane_project.json
.ai-bridge/capabilities/emit.plane_cycle.json
.ai-bridge/capabilities/emit.plane_module.json
.ai-bridge/capabilities/emit.plane_issue.json
.ai-bridge/capabilities/emit.plane_comment.json
.ai-bridge/capabilities/emit.plane_status.json
```

## Record kinds

```text
project
cycle
module
issue
comment
status
```

## Center mapping

```text
project -> RawEvent plane.project.updated -> Observation planning.project_* -> Evidence source
cycle -> RawEvent plane.cycle.updated -> Observation planning.cycle_* -> Evidence source
module -> RawEvent plane.module.updated -> Observation planning.module_* -> Evidence source
issue -> RawEvent plane.issue.updated -> Observation planning.issue_* -> Evidence source
comment -> RawEvent plane.comment.created -> Observation planning.comment_added -> Evidence note
status -> RawEvent plane.issue.status_changed -> Observation planning.status_* -> Evidence receipt
project projection -> Center Loop with next action and blocker state
```

## Non-goal

This phase does not call the Plane API and does not write back to Plane. Authenticated Plane sync and `write.plane_issue` remain future producer connections.
