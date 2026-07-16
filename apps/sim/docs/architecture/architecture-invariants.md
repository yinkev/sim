# Architecture Invariants

## Purpose

These rules protect the target product model, dependency topology, state ownership, and performance envelope.

Repository path: `apps/sim/docs/architecture/architecture-invariants.md`
Owning project: Sim
Owner: Sim maintainers
Current status: Approved architecture constraints.

A change is noncompliant when it violates an invariant, even if functional tests pass. Exceptions require an accepted ADR with an explicit retirement or review condition.

## Domain Invariants

- **INV-DOM-001 — Task identity:** durable user work is identified by a task, not by a route, chat component, workflow, or execution.
- **INV-DOM-002 — State separation:** intent, draft, committed artifact state, and execution state remain distinguishable.
- **INV-DOM-003 — Exact execution target:** every execution records the exact artifact version or authorized draft revision it used.
- **INV-DOM-004 — Independent systems of record:** conversation cannot be the sole system of record for task, artifact, or execution state.
- **INV-DOM-005 — Durable correlation:** material changes and external effects correlate task, artifact, execution, actor, and provenance identifiers.
- **INV-DOM-006 — Resumability:** a user can resume from durable state without reconstructing intent from raw chat history.

## Dependency And Compile Invariants

- **INV-DEP-001 — Minimal shell:** the persistent workspace shell contains only identity, theme, lightweight policy, navigation frame, notifications, and the route outlet.
- **INV-DEP-002 — Hard Studio boundary:** main web routes do not statically import Workflow Studio, block runtime, editor stores, or execution visualization code.
- **INV-DEP-003 — Metadata/runtime split:** presentation metadata never imports executable blocks, tools, providers, triggers, or workflow runtime.
- **INV-DEP-004 — Route-scoped features:** data loaders, stores, and feature providers mount only where their owning route or interaction requires them.
- **INV-DEP-005 — Interaction loading:** closed dialogs, search indexes, management tools, and optional panels do not enter the initial route graph.
- **INV-DEP-006 — Side-effect-free imports:** importing a module must not start network calls, initialize feature registries, mutate global stores, or launch background work.
- **INV-DEP-007 — Explicit public boundaries:** cross-domain imports use narrow public entry points; convenience barrels must not collapse metadata and runtime layers.
- **INV-DEP-008 — Client/server separation:** client modules do not import server-only adapters, credentials, filesystem code, or executable backend registries.
- **INV-DEP-009 — Monorepo direction:** applications may depend on shared packages; packages do not depend on application code.

## State Ownership Invariants

| State class | Canonical owner |
| --- | --- |
| Server-backed records | React Query or server-rendered route data |
| Route identity and durable selection | URL path and search parameters |
| Component interaction | Local React state |
| Small cross-component UI coordination | Focused Zustand store |
| Workflow document state | Workflow Studio store |
| Execution lifecycle | Execution domain/runtime |
| Static capability metadata | Generated manifests or pure metadata modules |

- **INV-STATE-001:** do not duplicate server records into global stores without a documented synchronization contract.
- **INV-STATE-002:** global stores are not service locators or feature registries.
- **INV-STATE-003:** temporary previews and drafts have explicit ownership and promotion rules.
- **INV-STATE-004:** cancellation, retry, and completion are durable domain transitions, not UI-only flags.

## Autonomy And Safety Invariants

- **INV-SAFE-001 — Risk classification:** every executable capability maps to immediate, execute-and-report, or checkpoint-required policy.
- **INV-SAFE-002 — External effects:** destructive, production, permission, communication, or substantial-spend actions require an applicable policy checkpoint.
- **INV-SAFE-003 — Idempotency:** retried commands and cancellation paths must not duplicate material external effects.
- **INV-SAFE-004 — Provenance:** committed AI-generated changes retain source task, actor, change set, and evidence references.
- **INV-SAFE-005 — Data integrity:** architectural migration must preserve durable user data or provide an explicit migration and rollback path.

## Performance Invariants

- **INV-PERF-001 — Idle means idle:** completed, inactive routes consume effectively no sustained CPU.
- **INV-PERF-002 — Bounded shell:** shell compile and runtime cost do not scale with integration count, block count, or workflow complexity.
- **INV-PERF-003 — Feature-local growth:** adding an integration or workflow block has zero material effect on unrelated route compile cost.
- **INV-PERF-004 — No eager warming:** routes do not prefetch every model, resource family, or feature merely because the workspace mounted.
- **INV-PERF-005 — Budgeted entry points:** each major surface has an explicit cold compile, warm navigation, memory, and interactivity budget.
- **INV-PERF-006 — Measured boundaries:** architecture decisions use route-level dependency and runtime evidence, not component intuition alone.

## Architecture Fitness Functions

Enforce invariants with a small set of automated checks:

- Static import-boundary tests for the persistent shell, major main-web route entry points, metadata, and Workflow Studio.
- Route dependency-graph or bundle-budget checks for major entry points.
- Cold and warm performance probes for the reference workflow.
- Contract and type checks for changed domain boundaries.
- Golden-path verification for the user journey affected by the slice.

Fitness functions are regression guards, not an instruction to build exhaustive test matrices.
