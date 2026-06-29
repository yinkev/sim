---
id: center-phase-11-implementation
type: implementation-record
project: center
status: implemented
updated: 2026-06-29
links:
  - center-roadmap-v1
  - worker-lane-index
  - capability-metadata-contract-v1
  - emit.agent_run_started
  - emit.agent_run_completed
  - emit.agent_failure
  - emit.agent_diff
  - emit.agent_test_result
  - emit.agent_artifact
  - emit.agent_review_needed
  - current-plan
---

# Phase 11 Implementation - Worker / Hermes / Codex Lane

## Decision

Worker, Hermes, and Codex execution attempts enter Center through a worker-lane producer import packet. Center does not execute workers, approve work, or import workflow, connector, provider SDK, block registry, or execution sandbox hot paths.

## Implemented files

```text
apps/sim/lib/center/producers/worker-lane.ts
apps/sim/lib/center/producers/worker-lane-files.ts
apps/sim/app/api/center/workers/import/route.ts
apps/sim/lib/api/contracts/center.ts
apps/sim/app/center/[workspaceId]/center-surface.tsx
.ai-bridge/capabilities/emit.agent_run_started.json
.ai-bridge/capabilities/emit.agent_run_completed.json
.ai-bridge/capabilities/emit.agent_failure.json
.ai-bridge/capabilities/emit.agent_diff.json
.ai-bridge/capabilities/emit.agent_test_result.json
.ai-bridge/capabilities/emit.agent_artifact.json
.ai-bridge/capabilities/emit.agent_review_needed.json
.ai-bridge/projects/worker-lane/index.md
.ai-bridge/projects/worker-lane/sample-events.json
```

## Mapping

```text
run_started -> worker-lane packet -> RawEvent agent.run.started -> Observation agent.run_started -> Evidence log
run_completed -> worker-lane packet -> RawEvent agent.run.completed/failed -> Observation agent.run_completed/run_failed -> Evidence run-output
failure -> worker-lane packet -> RawEvent agent.failure.recorded -> Observation agent.failure -> Evidence log
diff -> worker-lane packet -> RawEvent agent.diff.produced -> Observation agent.diff_ready -> Evidence diff
test_result -> worker-lane packet -> RawEvent agent.test.passed/failed -> Observation agent.test_passed/test_failed -> Evidence test
artifact -> worker-lane packet -> RawEvent agent.artifact.created -> Observation agent.artifact_ready -> Evidence artifact
review_needed -> worker-lane packet -> RawEvent agent.review.requested -> Observation agent.review_needed -> Recommendation + ActionProposal
loopKey projection -> Center Loop with next action and blocker state
```

## Verified source

```text
.ai-bridge/projects/worker-lane/sample-events.json
```

Live import expectation:

```text
records: 7
evidence: 7
raw events: 7
observations: 7
loops: 2
recommendations: 1
action proposals: 1
```

## Verification

```text
bun --cwd apps/sim test lib/center/producers/worker-lane.test.ts lib/center/producers/learn-understand.test.ts lib/center/producer-import.test.ts
bun --cwd apps/sim type-check
bun run check:api-validation
bun run check:center-boundary
bun run check:boundaries
git diff --check
```

Capability schema validation:

```text
.ai-bridge/capabilities/emit.agent_run_started.json
.ai-bridge/capabilities/emit.agent_run_completed.json
.ai-bridge/capabilities/emit.agent_failure.json
.ai-bridge/capabilities/emit.agent_diff.json
.ai-bridge/capabilities/emit.agent_test_result.json
.ai-bridge/capabilities/emit.agent_artifact.json
.ai-bridge/capabilities/emit.agent_review_needed.json
```

Route smoke:

```text
GET /api/center/workers/import
recordCount: 7
evidence: 7
rawEvents: 7
observations: 7
loops: 2
recommendations: 1
actionProposals: 1
center loop: Center Phase 11 Worker Lane, blocked, Review worker output: Review worker lane mapping
hermes loop: Hermes Memory Relay, blocked, Inspect failure: Missing relay receipt
```

Browser smoke:

```text
/workspace/local-test/center
create profile
click Import Workers
localStorage contains 7 evidence, 7 raw events, 7 observations, 2 blocked loops, 1 recommendation, and 1 action proposal
Agent Work renders worker observations
Review Needed renders Review worker output: Review worker lane mapping
Next Actions renders Inspect failure: Missing relay receipt
```
