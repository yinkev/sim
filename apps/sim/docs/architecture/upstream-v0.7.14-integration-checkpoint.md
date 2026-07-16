# Pre-Phase 2 Upstream v0.7.14 Integration Checkpoint

## Status

Integrated on 2026-07-16 on `codex/upstream-v0.7.14-integration`.

- Phase 1 is complete at commit `734f3b787ad27eae684f8226c16599f21b0416f4`.
- Phase 2 is pending and was not started.
- Exact upstream commit `11168f915b044445d464345b3df7492764c59a07` was merged without rewriting
  the local history.
- Conflict resolution and the bounded postflight completed. Studio, warm Main, build, typecheck,
  boundaries, targeted tests, and the browser journey pass.
- The focused [Home cold-compile investigation](upstream-v0.7.14-home-cold-compile-investigation.md)
  removed an eager workspace-component barrel import from the new Home error boundary. The authoritative
  cold result improved from `22313.539 ms` to `12033.201 ms`, accepted in the explicit `10–15s` band;
  warm Main behavior and runtime budgets pass. The integration performance blocker is resolved.
- Phase 2 remains pending and was not started.
- No stash was changed and nothing was pushed.
- This checkpoint is sequencing and execution guidance. It does not change the accepted architecture.

## Decision

Integrate exact upstream commit `11168f915b044445d464345b3df7492764c59a07` (`v0.7.14`) before
starting Phase 2.

This is a technical-baseline sync, not a decision to adopt every upstream product surface. Sim is
currently a personal-use system. The acceptance standard is that Home, chat, Workflow Studio,
execution, durable data, URLs, and required local services continue to work for that use. Hosted or
enterprise features remain disabled unless they are independently needed later.

This is the lowest-risk sequencing point because Phase 1 has a clean fallback and Phase 2 has not yet
introduced Task identity or persistence changes. Delaying the sync until after Phase 2 would combine a
broad upstream reconciliation with new domain and data-migration work.

## Phase 1 Decision Remains Accepted

The redesign deliberation is closed. The chosen thin Main shell and hard Workflow Studio compile
boundary remain the governing design during integration. The merge must adapt to that architecture; it
must not reopen it by default.

The Studio `6 GiB` RSS figure is an acceptance ceiling for the recursive development listener process
tree, not a desired steady-state target and not the memory of one browser tab. The accepted v5 probe
measured `5.384 GiB` peak and `5.246 GiB` idle peak. The earlier broad dependency graph reached
`19.772 GiB`; frontend-only deferral, dynamic imports alone, a V8 heap cap, and a bundler change were
insufficient. Focused server-route modules and enforceable import closures closed the final gap.

The implementation history, failed approaches, preserved behavior, measurements, and remaining
headroom are recorded in the [Phase 1 closeout](phase-1-closeout.md). Durable rejected architecture
alternatives are recorded in [ADR 0002](adr/0002-workflow-studio-compile-boundary.md). Those documents
should be reused rather than re-audited during the merge.

## Verified Baseline

These facts were checked before this checkpoint was written:

| Item | Baseline |
| --- | --- |
| Preserved Phase 1 branch | `codex/phase-1-checkpoint` |
| Preserved Phase 1 commit | `734f3b787ad27eae684f8226c16599f21b0416f4` |
| Common base | `56a88a2a1b8ef2496ed0291f9d1280273e24d912` (`v0.7.9`) |
| Exact upstream target | `11168f915b044445d464345b3df7492764c59a07` (`v0.7.14`) |
| Divergence at planning time | `97` upstream-only commits and `38` local-only commits |
| Local change surface from the base | `804` files, `+162,916 / -5,473` |
| Upstream change surface from the base | `1,418` files, `+286,789 / -13,018` |
| Exact path overlap | `99` files changed on both sides |
| Named Phase 1 safety stash | `stash@{0}: pre-phase1-unrelated-center-wip-20260716` |
| Safety-stash surface | `166` paths: `107` overlap local committed changes and `59` are stash-only |

The large overlap makes the integration high-risk, but it does not justify selecting 97 commits one at
a time. Preserve history with one merge, then resolve conflicts against the accepted architecture.

All stash entries are user or prior-work artifacts. Do not apply, pop, drop, rewrite, or use them as a
conflict-resolution source during this integration.

## Architecture Fit

Use three layers to decide how upstream changes fit.

### 1. Specification

The [north star](north-star.md), [domain model](domain-model.md),
[architecture invariants](architecture-invariants.md), glossary, accepted ADRs, and this roadmap define
the intended product. Upstream must not silently redefine Task, Conversation, Artifact, Version, Change
Set, Execution, Resource Reference, Capability, Autonomy Policy, or compile-domain ownership.

### 2. Review and control

Fitness checks, CI, evidence, error boundaries, locks, policy checkpoints, observability, and the future
Command Center govern correctness. Upstream maintenance, security, and control improvements belong here
when they do not impose irrelevant hosted behavior.

### 3. Execution

Main web, Workflow Studio, integrations, files, tables, workflow runtime, streaming, and execution
services perform the work. Most upstream correctness and performance improvements should be retained in
this layer, while respecting the specification and review boundaries above it.

## Upstream Adoption Policy

### Retain directly

- OAuth account-takeover fixes.
- Upload quota and decompression protections.
- CI supply-chain hardening.
- Typed realtime protocol work.
- SSR and query-key correctness fixes.
- Workflow and folder locks.
- Consolidated SSE readers.
- Execution correctness and performance fixes.
- Database performance improvements.
- Runtime secret handling.
- Granular route error boundaries.
- Dependency cleanup that preserves local behavior.

### Retain but adapt

| Upstream area | Local adaptation rule |
| --- | --- |
| React Query migration | Keep cache ownership, cancellation, and correctness improvements while preserving focused modules and route boundaries. |
| Home server prefetch | Prefetch only bounded read models owned by the route. Do not restore global eager settings, workflow, provider, or integration loading. |
| Sidebar prefetch | Keep it inside Workflow Studio or the owning future Task Workspace, never the persistent Main shell. |
| Parallel subagents, streaming, and status enums | Treat them as foundations for the future Execution domain. Current stream or UI state is not canonical durable Execution state. |
| Typed VFS snapshots | Preserve as a foundation for Artifact provenance, resumability, Resource References, and Change Sets; do not prematurely declare it the Artifact system of record. |
| File sharing, rich editing, table snapshots, and storage | Keep useful Artifact capabilities without letting their current implementation define the future Artifact lifecycle. |
| Access, retention, and governance primitives | Preserve useful Identity and Policy foundations while keeping personal-use defaults and deferring the future Autonomy Policy mapping. |
| New integrations and tools | Keep useful additions, but prevent executable registries from entering unrelated Home or shell graphs. Integration count must not control Main compile cost. |
| Upstream scheduled-task labels | Treat as compatibility vocabulary only. They do not replace the canonical Task definition. |

### Keep disabled or defer

- Presidio and PII infrastructure, including any embedded local Python fallback.
- Data-retention administration.
- Hosted billing and upgrade flows.
- Enterprise public-sharing authentication.
- Hosted enrichment.
- Unused integrations.
- Hosted or cloud-specific deployment requirements.

These are not rejected forever. They are outside the current personal-use acceptance boundary and must
not become required services merely because the code exists upstream.

### Reject or adapt away

- Any change that makes Main import Workflow Studio or executable workflow runtime again.
- Integration growth that increases unrelated Home compile cost.
- Global eager workflow, chat, settings, provider, or integration loading.
- A newly required hosted Sim service.
- Conflation of Conversation, Artifact, and Execution state.
- Dynamic imports used as the only compile-boundary control.
- Ambiguous execution semantics such as silently running an unspecified latest workflow state.
- Phase 2 persistence or schema work introduced as part of conflict resolution.

## High-Leverage Future Connections

These upstream capabilities can support the approved long-horizon design later without changing Phase 2
sequencing now:

- SSE, parallel subagents, and status enums can feed a durable Execution and Execution Step model.
- VFS snapshots plus file and table versioning can support Artifact, Version, Change Set, and provenance.
- Locks, access control, and retention can support Identity, Policy, and Autonomy Policy boundaries.
- Integration expansion can feed a capability catalog while registries remain isolated from Main.
- Route error boundaries and scoped prefetch can improve resilient Task Workspaces and Artifact Studios.

## Integration Procedure

1. Keep `codex/phase-1-checkpoint` and commit `734f3b787` available as the immutable fallback.
2. Create a separate branch and worktree named `codex/upstream-v0.7.14-integration` from the current
   documentation checkpoint.
3. Fetch the upstream remote and verify that the merge target is exactly `11168f915` / `v0.7.14`.
4. Merge the exact commit. Do not rebase, squash, or rewrite the 38 local commits.
5. Resolve conflicts by preserving the accepted Phase 1 boundaries and personal-use behavior while
   retaining applicable upstream correctness, performance, runtime, and maintenance work.
6. If missing, add `check:home-boundary`, `check:studio-boundary`, and `check:center-boundary` to the
   existing CI boundary job.
7. Run one bounded authoritative postflight, leave the integration branch clean, report the result, and
   stop before Phase 2.

Do not push. Do not mutate stashes. Do not start Phase 2.

## Conflict Stop Conditions

Stop and report the exact decision instead of guessing if a conflict would change:

- an accepted architecture decision or compile boundary;
- database or persistence semantics;
- durable data, stable identifiers, or URL compatibility;
- the current personal Home, chat, Studio, execution, or local-service workflow; or
- the meaning of Task, Artifact, Version, Change Set, or Execution.

Ordinary implementation conflicts that preserve those decisions should be resolved without stopping.

## Bounded Postflight

Do not audit the audit or rerun controls without a merge-related reason. Reuse the accepted Phase 1
evidence where the relevant entry and runtime graphs did not change. After conflict resolution, run one
postflight consisting of:

- targeted tests for the high-risk seams actually changed by the merge;
- typecheck;
- architecture, API-contract, and React Query boundary checks;
- production build;
- one Home -> chat -> Workflow Studio -> Home browser journey; and
- performance probes only when relevant entry or runtime graphs changed.

The integration report must state the merge result, conflicts and resolutions, upstream behavior kept,
adapted, disabled, or rejected, commands and results, remaining blockers, exact branch/commit/stash state,
and explicit confirmation that Phase 2 was not started and nothing was pushed.

## Rollback

The rollback is containment, not history rewriting: abandon the integration branch/worktree and return
to `codex/phase-1-checkpoint` at `734f3b787`. Do not reset, rewrite, or alter the checkpoint or stashes.

## Paste-Ready New-Session Prompt

```text
work in /Users/kyin/Projects/sim.

read the root AGENTS.md, apps/sim/AGENTS.md, and:

- apps/sim/docs/architecture/README.md
- apps/sim/docs/architecture/migration-roadmap.md
- apps/sim/docs/architecture/phase-1-closeout.md
- apps/sim/docs/architecture/architecture-invariants.md
- apps/sim/docs/architecture/upstream-v0.7.14-integration-checkpoint.md

preserve the Phase 1 checkpoint branch and commit 734f3b787 unchanged. create a separate branch/worktree named codex/upstream-v0.7.14-integration from the current documentation checkpoint.

fetch the upstream remote and verify the target. integrate exact upstream commit 11168f915 (`v0.7.14`). use a merge; do not rebase, squash, or rewrite the 38 local commits.

resolve conflicts while preserving:

- the thin main-web control plane
- the hard Workflow Studio compile boundary
- route-scoped loaders and providers
- metadata/runtime separation
- current Home, chat, Studio, execution, and local-service behavior
- existing durable data and URLs

personal use is the acceptance standard. retain useful upstream correctness, performance, runtime, and maintenance improvements, but keep PII infrastructure, hosted billing, enterprise sharing, hosted enrichment, and other irrelevant services disabled. do not introduce new required external services.

do not apply, modify, pop, or delete any stash. do not start Phase 2. do not push.

if a conflict would change an accepted architecture decision, database/persistence semantics, durable data, or the user-facing personal workflow, stop and report the specific decision instead of guessing.

wire these existing checks into CI if they are not already present:

- check:home-boundary
- check:studio-boundary
- check:center-boundary

do not over-audit, overvalidate, or over-verify. do not repeat already-passing checks without a merge-related reason. perform one bounded authoritative postflight after conflict resolution:

- targeted tests for actually changed high-risk seams
- typecheck
- architecture/API/React Query boundary checks
- production build
- one Home -> chat -> Studio -> Home browser journey
- performance probes only if the merge changed relevant entry or runtime graphs

reuse existing authoritative evidence where it remains valid. do not run duplicate review or verification passes.

leave the integration branch clean. report:

1. merge result
2. conflicts and how they were resolved
3. upstream behavior adapted, disabled, or rejected
4. verification commands and results
5. remaining blockers
6. exact branch, commit, and stash state
7. explicit confirmation that Phase 2 was not started and nothing was pushed

then stop.
```
