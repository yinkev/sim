# Canonical Domain Model

## Purpose

This document defines the target domain objects, ownership boundaries, and relationships.

Repository path: `apps/sim/docs/architecture/domain-model.md`
Owning project: Sim
Owner: Sim maintainers
Current status: Approved conceptual model. Wire schemas remain implementation-specific until a migration slice adopts them.

## Bounded Contexts

```text
Task Context         Artifact Context       Execution Context
objective            drafts                 queued/running state
status               committed versions     steps and results
conversation         change sets            cancellation and retry
resource links       provenance             schedules

Integration Context  Identity/Policy Context
catalog metadata     users and workspaces
credentials          permissions
capabilities         autonomy policies
adapters             risk classification
```

These are modules in a modular monolith unless a measured operational requirement justifies service extraction.

## Core Objects

### Workspace

Security, ownership, and collaboration boundary. It contains tasks, artifacts, integrations, policies, and execution history.

### Task

Durable aggregate for one intended outcome. Owns objective, definition of done, task status, conversation linkage, resource references, decisions, and links to artifacts and executions. A task is not a generic to-do item or a chat thread.

### Conversation

Ordered interaction stream attached to a task. It carries commands, explanations, questions, and user-visible tool activity. It is not the system of record for artifacts, execution state, or task status.

### Artifact

Durable product of work: workflow, file, table, knowledge base, schedule, deployment, or another typed asset. Owns stable identity and links to versions, drafts, related tasks, and provenance.

### Artifact Version

Immutable committed snapshot or equivalent canonical revision. Executions reference the exact version they used.

### Draft

Mutable proposed state that has not replaced the current committed version. A draft may be discarded, compared, committed, or executed only under an explicit policy.

### Change Set

Structured description of proposed or committed artifact changes. Supports preview, diff, attribution, undo strategy, and provenance.

### Resource Reference

Typed link from a task or conversation to an artifact, execution, file attachment, external record, or temporary preview. The reference does not own the referenced object.

### Execution

Durable attempt to perform work against an explicit task, artifact version or approved draft, input, policy, and initiator. Owns lifecycle state, steps, cancellation, retry lineage, result, cost, and correlation identifiers.

### Execution Step

Identified unit of execution with status, timing, inputs, outputs, error, and parent execution. Step identity enables partial retry and reliable progress reporting.

### Activity Event

Append-only user-facing record of a material task, artifact, or execution transition. Activity is optimized for explanation and resumption, not as the sole persistence model.

### Decision

Explicit choice with rationale, actor, timestamp, related evidence, and affected task or artifact. Decisions must not exist only in conversational prose when they change durable behavior.

### Capability

Typed description of what an integration or internal subsystem can do, including risk class and policy requirements. Capability metadata grants no execution authority by itself.

### Autonomy Policy

Workspace- or user-scoped rules defining which capability classes may execute immediately, execute and report, or require a checkpoint.

## Ownership Rules

- Task owns the outcome and coordination state, not artifact contents or execution internals.
- Artifact owns drafts, committed versions, and artifact provenance.
- Execution owns operational lifecycle and results.
- Integration owns credentials, capability metadata, and external adapters.
- Identity/Policy owns authorization and autonomy decisions.
- Conversation presents and commands these objects but does not replace their systems of record.

## Required Relationships

```text
Workspace 1 ── * Task
Workspace 1 ── * Artifact
Task 1 ── 1 Conversation
Task * ── * Artifact through Resource Reference
Task 1 ── * Execution
Artifact 1 ── * Artifact Version
Artifact 1 ── * Draft
Execution * ── 1 Artifact Version or explicitly authorized Draft
Execution 1 ── * Execution Step
Task/Artifact/Execution 1 ── * Activity Event
```

## Lifecycle Rules

- A generated output becomes an artifact only when it receives durable identity and persistence.
- A committed artifact update records its source task, actor, change set, and prior version where applicable.
- An execution cannot ambiguously target “latest”; it records the exact resolved version or draft revision.
- Cancellation is a durable state transition, not only a client-side abort.
- Retry creates lineage to the prior execution and identifies the scope being retried.
- Resumption reconstructs from durable task, artifact, and execution state rather than raw transcript replay alone.

## Persistence Strategy

Use normalized current state, versioned artifact revisions, append-only activity, append-only execution events, and structured change sets. Do not adopt full event sourcing unless later requirements prove that replay is the correct system of record.
