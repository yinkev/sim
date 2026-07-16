# Sim Architecture Migration Roadmap

## Status

Repository path: `apps/sim/docs/architecture/migration-roadmap.md`
Owner: Sim maintainers
Current status: Phase 2 Task compatibility spine complete; Phase 3 pending
Last verified: 2026-07-16

This roadmap sequences migration from the current Sim implementation to the approved architecture.
It does not claim that current code already conforms. Each phase advances through vertical slices;
working behavior and durable data remain available until explicit retirement criteria pass.

## Current Slice State

No implementation slice is active. The
[Phase 2 Task compatibility spine](slices/phase-2-task-compatibility-spine.md) is complete: the accepted
identity-only Task mapping, mixed-version trigger, bounded backfill, auth-first repair, compatibility
proof, and rollback contract are recorded there. Phase 3 has not started.

[Phase 1A: Main-Web Shell Diet](slices/phase-1-main-web-shell-diet.md) is complete. Its implementation
history, accepted evidence, rejected alternatives, preserved behavior, and remaining limitations are
recorded in the [Phase 1 closeout](phase-1-closeout.md). Center UI
work remains sequenced after the Task, Artifact, and Execution domain phases.

The exact upstream `v0.7.14` baseline was reconciled on the separate integration branch and worktree
under the [pre-Phase 2 integration checkpoint](upstream-v0.7.14-integration-checkpoint.md). This was a
technical-baseline sync, not an architecture phase or permission to begin Phase 2. The Phase 1 checkpoint
remains the fallback. The focused [Home cold-compile investigation](upstream-v0.7.14-home-cold-compile-investigation.md)
found and removed an eager workspace-component barrel import from the new Home error boundary. The
authoritative cold result improved from `22313.539 ms` to `12033.201 ms`, which is accepted in the
explicit `10–15s` band; warm and runtime behavior remain healthy. The integration performance blocker is
resolved. Phase 2 preserves those accepted shell and runtime boundaries.

## Sequence

| Phase | Outcome | Status | Prerequisites | Exit evidence |
| --- | --- | --- | --- | --- |
| 0. CPU/RAM containment baseline | Reference dev profiles remain bounded, idle, and reproducibly measurable. | Complete | None | Current-tree cold/warm timing, listener-tree RSS, idle CPU, and boundary evidence meet the approved budgets or record an explicit waiver. |
| 1. Thin shell and Workflow Studio seam | Main-web routes stop inheriting workflow runtime; existing Studio behavior remains available behind a hard entry boundary. | Complete | Phase 0 complete | Slice import-closure, compatibility, runtime, and performance gates pass; migrated global loaders and fallbacks are removed. |
| 2. Task compatibility spine | Workspace Mothership conversations receive durable Task identity without rewriting chat transport or UI. | Complete | Phase 1 shell boundary | Task/chat mapping is atomic and idempotent; existing chat URLs, transcripts, streams, resources, and permissions remain compatible. |
| 3. Workflow artifact lifecycle | Workflows adopt stable Artifact identity, Draft, immutable Version, Change Set, and provenance. | Pending | Phase 2 Task identity | Executions resolve an exact workflow version or authorized draft; legacy workflow persistence remains readable through the migration window. |
| 4. Execution domain and Operations Center | Execution lifecycle, steps, cancellation, retry lineage, results, cost, and correlation are durable and inspectable. | Pending | Phase 3 workflow versions | Golden-path run, stop, retry, resumption, and exact-version tests pass; UI-only lifecycle flags no longer own canonical state. |
| 5. Command Center and Task Workspace cutover | Center starts, resumes, monitors, and searches Task-backed work through stable domain contracts. | Pending | Phases 2 and 4 | Reference user journey passes within performance budgets; compatibility routes remain until parity evidence passes. |
| 6. Remaining artifact migration and legacy retirement | Remaining artifact types migrate one cohort at a time; superseded identity and runtime paths are deleted. | Pending | Phase 5 cutover | Every retired path has replacement coverage, data migration evidence, rollback or restore proof, and no remaining production callers. |

## Sequencing Rules

- Phase numbers describe dependency order, not release size. A phase contains independently reversible slices.
- No big-bang rewrite is allowed. Existing routes and systems of record remain until a replacement slice passes its acceptance and retirement gates.
- Phase 1 precedes Task persistence so new Task surfaces do not inherit the current workflow/editor dependency graph.
- Phase 2 introduces identity and compatibility before moving conversation, artifact, or execution ownership.
- Workflow is the first Artifact cohort because it exercises draft, version, execution, and Studio boundaries. Other cohorts require their own slice contracts.
- Center operational machine state is reported by `bun run --silent center:readiness`; this roadmap records architectural blockers, not volatile credential state.

## Compatibility Mapping

| Current object or label | Target object | Migration phase | Rule |
| --- | --- | --- | --- |
| Mothership chat presented as a task | Task plus linked Conversation | 2 | Preserve `chatId` and current visibility while adding stable `taskId`; do not broaden access. |
| Workflow | Artifact with Draft and immutable Version | 3 | Preserve existing workflow identity during the compatibility window; executions must stop targeting ambiguous latest state. |
| Copilot run and stream lifecycle | Execution and Execution Step | 4 | Preserve current correlation identifiers while moving canonical lifecycle ownership. |
| Center Action Proposal status `executed` | Not yet mapped | Decision required before Phase 4 | Do not equate a local status transition with a durable Execution unless an actual attempt exists and is linked. |
| Center Profile, Loop, Observation, Outcome, Review Packet | Not yet mapped | Decision required before Phase 5 | Record keep/map/migrate/retire decisions in a slice or ADR before changing persistence. |

## Architecture Blockers

| ID | Blocker | Blocks | Resolution evidence |
| --- | --- | --- | --- |
| ARCH-005 | Center authority/truth-impact terms and target autonomy classes are not canonically mapped. | Phase 5 policy cutover | Accepted ADR or invariant update defining the mapping. |

## Resolved Blockers

| ID | Resolution | Evidence |
| --- | --- | --- |
| ARCH-001 | Phase 0 current-tree performance evidence passes for Main and Workflow Studio. | `20260716-main-home-authoritative.json` and `20260716-workflow-studio-authoritative-v5.json` under the canonical generated evidence directory. |
| ARCH-002 | Main workspace layouts no longer make workflow collaboration, provider discovery, workflow stores, or executable registries reachable from Main entry paths. | `bun run check:home-boundary`, workspace route tests, and the [Phase 1 closeout](phase-1-closeout.md). |
| ARCH-003 | Main web and Workflow Studio now have enforceable import-closure boundaries with separate Main and Studio budgets. | `bun run check:home-boundary`, `bun run check:studio-boundary`, and `20260716-workflow-studio-authoritative-v5.json`. |
| ARCH-004 | The accepted identity-only Task compatibility contract defines independent Task UUIDs, existing chat authorization, chat-delete cascade, trigger-backed mixed-version creation, bounded repair, and additive rollback; richer Task state remains deferred. | [Phase 2 Task compatibility spine](slices/phase-2-task-compatibility-spine.md). |

## Phase Acceptance Rule

A phase is complete only when every included slice records:

- Passed observable user outcome and compatibility journey.
- Applicable architecture invariants and fitness functions passing.
- Performance evidence against the approved surface budgets.
- Data migration and rollback evidence where persistence changes.
- Explicit legacy removal or a bounded retirement condition.
- No unresolved blocker assigned to that phase.

Generated evidence belongs under `var/center/evidence/` until a broader architecture evidence root is accepted.
