# `.ai-bridge` Operating Model

## Purpose

`.ai-bridge/` is the local coordination layer between ChatGPT/CodexPro/Pro/Codex/local workers.

It is not source code. It is the agent workbench: active plan, project context, decisions, open questions, status, diffs, logs, and archived missions.

## Core rule

CodexPro execution is one active plan at a time.

Use:

```text
.ai-bridge/current-plan.md
```

for the active runnable instruction.

Use:

```text
.ai-bridge/projects/<project>/
```

for durable context, design notes, roadmaps, prior reasoning, future phases, and project-specific decisions.

Do not overload `current-plan.md` with the whole strategy. It should point to the relevant project context and define exactly what to execute now.

## Recommended structure

```text
.ai-bridge/
├── README.md                         # this operating model
├── current-plan.md                   # one active executable plan
├── agent-status.md                   # current worker progress/status
├── decisions.md                      # global decision ledger
├── open-questions.md                 # global unresolved questions/blockers
├── execution-log.jsonl               # append-only agent/workflow events
├── implementation-diff.patch         # latest diff snapshot if produced by a worker
├── projects/
│   └── <project-slug>/
│       ├── brief.md                  # durable context packet
│       ├── roadmap.md                # phased plan
│       ├── decisions.md              # project-specific decisions
│       ├── open-questions.md         # project-specific blockers
│       ├── protocols/                # durable process rules
│       ├── research/                 # external/internal research notes
│       ├── plans/                    # inactive future plans
│       ├── artifacts/                # outputs, screenshots, exports, patches
│       └── archive/                  # old local project material
└── archive/
    └── YYYY-MM-DD-<slug>/
```

## Current active project

```text
projects/cpu-ram-stabilization/
```

This project is Phase 0 for Center: make local Sim development usable before Center UI work.

Center is the approved operating surface, but Center UI implementation is blocked until Phase 0 is handled or explicitly waived.

Current active plan:

```text
.ai-bridge/current-plan.md
```

Required governing packets:

```text
.ai-bridge/protocols/execution-authority.md
.ai-bridge/ontology/freeze-v1.md
.ai-bridge/capabilities/metadata-contract.md
.ai-bridge/schemas/capability.schema.json
```

## Execution convention

A good `current-plan.md` should have:

1. Objective
2. Context files to read first
3. Exact files/routes likely involved
4. Non-goals
5. Acceptance criteria
6. Validation commands
7. Stop conditions

Example:

```text
# Current Plan — Daily Cockpit Phase 1: CPU/RAM Reduction

Read first:
- .ai-bridge/projects/daily-cockpit/brief.md

Objective:
Reduce local dev CPU/RAM usage without changing product behavior.

Do:
- inspect turbo/dev process fanout
- add dev:lite and dev:center scripts
- document daily dev profile

Do not:
- pull/rebase upstream
- overwrite Kevin's local commits
- run full monorepo tests unless needed

Acceptance:
- daily app-only command exists
- docs explain when to use each dev command
- targeted checks pass
```

## Project folder convention

Use project folders when work has multiple phases, durable context, or recurring decisions.

Examples:

```text
projects/daily-cockpit/
projects/github-sync/
projects/plane-integration/
projects/worker-loop/
projects/cpu-ram-reduction/
```

Do not create project folders for tiny one-shot fixes unless they need durable context.

## Decision ledger convention

`decisions.md` is for durable commitments, not notes.

Format:

```text
## YYYY-MM-DD — Decision title

Decision:
...

Reason:
...

Consequence:
...

Revisit if:
...
```

## Open questions convention

`open-questions.md` is for blockers that materially change implementation.

Format:

```text
## Question

Why it matters:
...

Default if unanswered:
...

Owner:
...
```

## Logs convention

`execution-log.jsonl` is append-only. One JSON object per event.

Example:

```json
{"ts":"2026-06-28T00:00:00-07:00","actor":"pro","event":"plan_started","project":"daily-cockpit","plan":"phase-1-cpu-ram"}
```

## Philosophy

`projects/` is memory and strategy.

`current-plan.md` is execution.

`status/log/diff` is evidence.

Keep those separate or agents will execute the wrong layer.
