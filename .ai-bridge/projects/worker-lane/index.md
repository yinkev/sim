---
id: worker-lane-index
type: project
status: active
updated: 2026-06-29
links:
  - center-roadmap-v1
  - capability-metadata-contract-v1
  - emit.agent_run_started
  - emit.agent_run_completed
  - emit.agent_failure
  - emit.agent_diff
  - emit.agent_test_result
  - emit.agent_artifact
  - emit.agent_review_needed
  - center-phase-11-implementation
---

# Worker Lane

## Purpose

Bring Worker, Hermes, and Codex execution attempts into Center without making Center execute worker code or import workflow, connector, provider SDK, block registry, or execution sandbox hot paths.

## Current interface

Local development imports a bounded worker-lane snapshot from:

```text
.ai-bridge/projects/worker-lane/sample-events.json
```

Override path:

```text
CENTER_WORKER_LANE_PRODUCER_FILE=/path/to/events.json
```

## Registered capabilities

```text
.ai-bridge/capabilities/emit.agent_run_started.json
.ai-bridge/capabilities/emit.agent_run_completed.json
.ai-bridge/capabilities/emit.agent_failure.json
.ai-bridge/capabilities/emit.agent_diff.json
.ai-bridge/capabilities/emit.agent_test_result.json
.ai-bridge/capabilities/emit.agent_artifact.json
.ai-bridge/capabilities/emit.agent_review_needed.json
```

## Record kinds

```text
run_started
run_completed
failure
diff
test_result
artifact
review_needed
```

## Center mapping

```text
run_started -> RawEvent agent.run.started -> Observation agent.run_started -> Evidence log
run_completed -> RawEvent agent.run.completed/failed -> Observation agent.run_completed/run_failed -> Evidence run-output
failure -> RawEvent agent.failure.recorded -> Observation agent.failure -> Evidence log
diff -> RawEvent agent.diff.produced -> Observation agent.diff_ready -> Evidence diff
test_result -> RawEvent agent.test.passed/failed -> Observation agent.test_passed/test_failed -> Evidence test
artifact -> RawEvent agent.artifact.created -> Observation agent.artifact_ready -> Evidence artifact
review_needed -> RawEvent agent.review.requested -> Observation agent.review_needed -> Recommendation + ActionProposal
loopKey projection -> Center Loop with next action and blocker state
```

## Non-goal

This phase does not spawn workers, approve work, execute code, or sync with Hermes/Codex live state. It only defines how execution evidence enters Center.
