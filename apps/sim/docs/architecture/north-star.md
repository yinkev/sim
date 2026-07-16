# Product And Architecture North Star

## Purpose

This document defines the final product experience and target system shape.

Repository path: `apps/sim/docs/architecture/north-star.md`
Owning project: Sim
Owner: Sim maintainers
Current status: Approved target state.

## Product Promise

Sim converts intent into durable, inspectable, executable work with minimal friction and no loss of user control.

The system should feel like one coherent operating environment rather than separate chat, workflow, file, table, integration, and log products.

## Reference User

Kevin is the canonical reference user for the first complete product loop. The default experience is:

- Dense and information-rich.
- Keyboard-first.
- Fast enough to remain open throughout the day.
- Autonomous for low-risk work.
- Explicit about state, provenance, cost, failure, and external effects.
- Optimized for resumption without reconstructing context from chat history.

User research and behavioral evidence are used to falsify or refine this model, not to average it into generic persona requirements.

## Primary Work Object

The primary user-facing object is a **Task**.

A task represents an outcome the user is pursuing and contains or links:

- Intent and definition of done.
- Conversation and decisions.
- Plan and current status.
- Context and resource references.
- Created or modified artifacts.
- Executions and results.
- Activity and provenance.

Chat is an interaction channel. A workflow is an artifact. An execution is an attempt. None replaces task identity.

## Primary Product Surfaces

### Command Center

The daily control surface for starting tasks, resuming active work, seeing running operations, reviewing attention-required items, and searching the workspace. It must be usable before secondary feature runtimes load.

### Task Workspace

The primary work surface combining the task objective, conversation/activity stream, active resources, artifacts, progress, and command input. Conversation does not own task state.

### Artifact Studios

Dedicated editors for durable artifacts such as workflows, files, tables, knowledge bases, schedules, and deployments. Each artifact has stable identity, draft state, committed state, provenance, and version history where material.

### Operations Center

A unified operational surface for queued, running, waiting, failed, cancelled, scheduled, and completed executions. It answers what is running, why, for which task and artifact version, with what result, and what can be stopped or retried.

## State Model

Sim must distinguish:

1. **Intent:** what the user wants.
2. **Draft:** a proposed or in-progress change.
3. **Committed artifact state:** the canonical saved version.
4. **Execution state:** what occurred when a specific version or approved draft was run.

These states must not be silently conflated.

## Autonomy Model

Autonomy is risk-tiered:

- **Execute immediately:** read, search, analyze, draft, preview, and other low-risk reversible work.
- **Execute and report:** reversible creation or modification inside a controlled workspace.
- **Preview or checkpoint first:** irreversible deletion, external communication, deployment, permission changes, production effects, or substantial spend.

User policy is learned by operation class. The system should not repeatedly request approval for an already authorized class of action.

## Target System Shape

```text
Thin workspace control plane
├── identity, navigation, bounded recent lists, notifications
└── route-scoped feature entry points

Main web compile domain
├── Command Center and Task Workspace
├── tasks, files, tables, knowledge, integrations, operations, settings
└── presentation metadata only for workflow and integration capabilities

Workflow Studio compile domain
├── canvas, block configuration, validation, debugging
└── workflow execution visualization and deployment controls

Modular monolith backend
├── task domain
├── artifact domain
├── execution domain
├── integration domain
└── identity and policy domain
```

The main web surface and Workflow Studio share contracts, identity, design tokens, event schemas, and generated metadata, but not eager runtime graphs.

## Performance Outcomes

Target budgets for the reference development environment:

| Metric | Target |
| --- | ---: |
| Dev process ready | under 1 second |
| Command Center clean compile | under 5 seconds |
| Command Center warm load | under 1 second |
| Input usable after route response | under 500 ms |
| Warm navigation | under 500 ms |
| Idle CPU | effectively 0% |
| Main web development RSS | under 4 GB |
| Workflow Studio development RSS | under 6 GB |
| Warm Studio open | under 3 seconds |
| Client stop acknowledgement | under 500 ms |
| Cached task restoration | under 1 second |

Scaling invariants matter more than any one measurement: adding integrations or workflow blocks must not increase unrelated route compile cost.

## Non-Goals

- A greenfield parity rewrite.
- Premature microservice decomposition.
- A generic task-management product.
- Full event sourcing for all state.
- Enterprise configurability without an observed requirement.
- A single frontend bundle that relies on dynamic imports as its only isolation mechanism.
