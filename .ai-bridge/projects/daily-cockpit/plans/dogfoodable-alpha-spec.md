---
id: daily-cockpit-dogfoodable-alpha-spec
type: plan
project: daily-cockpit
status: draft-for-pro-review
updated: 2026-06-28
links:
  - daily-cockpit-brief
  - governor-protocol
  - current-plan
---

# Dogfoodable Alpha Spec

## Standard

This is not an MVP. The first dogfoodable version must be sophisticated enough that Kevin can trust it as a real daily operating surface.

Do not ship cheap AI slop:

- no generic dashboard cards
- no decorative graph
- no fake personalization
- no chatbot-only surface
- no opaque predictions
- no global cross-user data leakage
- no workflow editor dependency in the Center hot path

The alpha can be narrow, but it must be architecturally real.

## Product name

Use the boring working name:

```text
Center
```

## Core thesis

Center is a local-first, multi-user, event-sourced operating surface.

It learns from each user through private event streams and per-user prediction models.

It shows loops, agents, tasks, progress, evidence, blockers, and next actions.

Workflow is a feature module. Center is the operating surface.

## Dogfoodable alpha must include

### 1. Local-first user profiles

Each tester gets an isolated profile:

```text
profiles/<profile-id>/
  events.db
  graph.db
  model-state/
  settings.json
```

Requirements:

- profile switcher or explicit profile selection
- no shared event/model state across profiles by default
- delete profile removes events/features/predictions
- export/import is explicit
- no telemetry by default

### 2. Event stream

Everything meaningful becomes an event.

Initial event categories:

- loop created/updated
- task created/started/completed/deferred
- study session started/stopped
- prediction generated
- prediction accepted/rejected
- agent/workflow started
- agent/workflow completed/failed
- evidence attached
- manual note/thought captured

Each event needs:

```ts
{
  id: string
  profileId: string
  ts: string
  type: string
  source: 'manual' | 'system' | 'workflow' | 'agent' | 'github' | 'plane' | 'scheduler'
  subjectId?: string
  payload: Record<string, unknown>
  privacy: 'local'
}
```

### 3. Loop model

Center should model loops first, tasks second.

Loop fields:

```ts
{
  id: string
  profileId: string
  title: string
  domain: string
  status: 'active' | 'paused' | 'blocked' | 'done' | 'archived'
  health: number
  momentum: number
  entropy: number
  nextAction?: string
  blockedBy?: string[]
  evidenceRefs: string[]
  updatedAt: string
}
```

### 4. Prediction layer

Predictions are local and probabilistic.

No LLM prediction as source of truth. LLM may explain, critique, or summarize.

Initial predictions:

- probability of starting a planned task/session
- probability of completing today's plan
- risk of drift/stall for a loop
- anomaly score for day/session/loop
- likely blocker category

Prediction output format:

```ts
{
  id: string
  profileId: string
  targetId: string
  targetType: 'loop' | 'task' | 'study-session' | 'day'
  predictionType: string
  probability?: number
  score?: number
  confidence: number
  drivers: Array<{ name: string; direction: 'up' | 'down'; weight: number }>
  generatedAt: string
  modelVersion: string
}
```

Start with transparent models:

- rolling baselines
- calibrated logistic regression where useful
- hazard/start-latency model
- Mahalanobis anomaly score after enough baseline data
- rule-based fallback when data is sparse

### 5. Center visual surface

Center must show:

- active loops
- loop health/momentum/entropy
- agents/workflows running
- blockers
- evidence
- next actions
- prediction confidence and drivers

The surface can use React Flow or a lighter graph, but it must not import the full heavy workflow editor/block registry unless the user explicitly opens workflow editing.

### 6. Scheduler integration

MS2 Scheduler is a module connected to Center, not the whole product.

Scheduler contributes:

- study loop objects
- planned sessions
- actual sessions
- review backlog
- exam horizon
- mastery/performance signals
- replan proposals

The scheduler should consume predictions, not own the prediction layer.

### 7. Learn / Understand integration

Learn mode:

- teaches topics using the user's existing graph and baseline knowledge
- identifies misconceptions and gaps
- generates practice and review tasks

Understand mode:

- maps systems/repos/docs/workflows
- emits graph nodes and evidence
- does not only produce prose

### 8. Worker/governor protocol

Before implementation, Pro reviews this spec as Governor B.

Pro must attack the plan, not agree with it.

Review for:

- hidden assumptions
- privacy leaks
- overcoupling to Sim's workflow editor
- CPU/RAM risks
- data model flaws
- prediction misuse
- dogfood failure modes
- simpler architecture

Workers do not start until the critique is synthesized.

## First dogfood slice

The first version should let Kevin and one external tester use Center for one week.

Required:

1. Create isolated profile.
2. Create loops.
3. Capture events manually and from simple app actions.
4. Show Center visual overview.
5. Show basic predictions with confidence and drivers.
6. Show anomaly/drift alerts after enough events, with rule fallback before enough data.
7. Export profile data.
8. Delete profile data.
9. No cloud sync or telemetry by default.

## Acceptance criteria

- Kevin can dogfood it without manual spreadsheet tracking.
- A brother/friend can create a separate profile and use it for one week.
- Their data does not enter Kevin's model.
- Prediction outputs are explainable and visibly uncertain.
- Center remains lightweight relative to the existing workflow editor.
- The design does not feel like generic AI SaaS.

## Pro review prompt

```text
Read .ai-bridge/projects/daily-cockpit/plans/dogfoodable-alpha-spec.md and .ai-bridge/projects/daily-cockpit/protocols/governor-protocol.md.

Act as Governor B. Attack this plan before implementation.

Do not agree by default. Find the strongest objections:
- what is overbuilt?
- what is under-specified?
- what will fail during one-week dogfooding?
- where can privacy leak?
- where will CPU/RAM blow up?
- where is the data model wrong?
- where does the prediction layer become fake or misleading?
- what is the simpler architecture that still meets Kevin's bar?

Return:
1. fatal flaws
2. non-fatal but important risks
3. required changes before implementation
4. what you would build first
5. what you would defer
```
