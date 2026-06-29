---
id: learn-understand-producers-index
type: project
status: active
updated: 2026-06-29
links:
  - center-roadmap-v1
  - capability-metadata-contract-v1
  - emit.learn_learning_gap
  - emit.learn_practice_task
  - emit.learn_review_evidence
  - emit.understand_system_map
  - emit.understand_dependency_observation
  - emit.understand_risk_evidence
  - center-phase-10-implementation
---

# Learn / Understand Producers

## Purpose

Bring learning and system-comprehension outputs into Center without making Center import the existing workflow blocks, Understand tool registry, or heavy analysis pipeline.

## Current interface

Local development imports a bounded Learn/Understand-shaped snapshot from:

```text
.ai-bridge/projects/learn-understand-producers/sample-events.json
```

Override path:

```text
CENTER_LEARN_UNDERSTAND_PRODUCER_FILE=/path/to/events.json
```

## Registered capabilities

```text
.ai-bridge/capabilities/emit.learn_learning_gap.json
.ai-bridge/capabilities/emit.learn_practice_task.json
.ai-bridge/capabilities/emit.learn_review_evidence.json
.ai-bridge/capabilities/emit.understand_system_map.json
.ai-bridge/capabilities/emit.understand_dependency_observation.json
.ai-bridge/capabilities/emit.understand_risk_evidence.json
```

## Record kinds

```text
learning_gap
practice_task
review_evidence
system_map
dependency_observation
risk_evidence
```

## Center mapping

```text
learning_gap -> learn packet -> RawEvent learn.learning_gap.detected -> Observation learning.gap_detected -> Evidence source
practice_task -> learn packet -> RawEvent learn.practice_task.created -> Observation learning.practice_task_* -> Evidence receipt
review_evidence -> learn packet -> RawEvent learn.review_evidence.recorded -> Observation learning.review_completed -> Evidence test
system_map -> understand packet -> RawEvent understand.system_map.generated -> Observation understanding.system_mapped -> Evidence artifact
dependency_observation -> understand packet -> RawEvent understand.dependency_observed -> Observation understanding.dependency_observed -> Evidence source
risk_evidence -> understand packet -> RawEvent understand.risk_detected -> Observation understanding.risk_detected -> Evidence source
topic/scope projection -> Center Loop with next action and blocker state
```

## Non-goal

This phase does not execute Learn generation or the Understand pipeline. It only defines how their outputs enter Center.
