# Pre-Phase 3 Upstream v0.7.37 Curated Intake Plan

## Status

Repository path: `apps/sim/docs/architecture/upstream-v0.7.37-curated-intake-plan.md`
Owner: Sim maintainers
Current status: Planning authorized; integration not started
Last verified: 2026-07-16

This plan authorizes read-only classification and preparation for one exact frozen upstream intake. It
does not authorize a merge, rebase, cherry-pick, manual port, migration rewrite or application,
personal database mutation, stash mutation, push, or Sim architecture Phase 3 implementation.
Integration requires a separate explicit execution approval after this plan and its migration-lineage
map are accepted.

## Decision

Plan one curated intake of exact upstream `v0.7.37` before Phase 3, then maintain Sim as a permanent
curated fork. This is not a commitment to continuous upstream tracking. A monthly read-only upstream
scan may be recommended later, but this plan does not approve standing automation. Urgent security
backports may be handled as isolated, explicitly approved exceptions.

Reject a wholesale tree merge as the default execution topology. The local product architecture remains
authoritative. Every upstream commit cluster or subsystem receives one disposition: `KEEP`, `ADAPT`,
`DEFER`, or `REJECT`. The intake must preserve local product behavior and owned service boundaries
rather than making upstream structure the default.

The campaign proceeds through explicit capability lanes in this priority order:

1. Security fixes.
2. Correctness and data-safety fixes.
3. Measured navigation, shell, and resource performance improvements.
4. Required maintenance and package prerequisites for accepted lanes.
5. Opt-in product capabilities with proven current need that do not change an approved domain model or
   start a later architecture phase. Later-phase work remains outside this campaign.

## Verified Planning Baseline

| Item | Verified value |
| --- | --- |
| Local planning base and `main` | `5efa6969a7fd961c64d01922827c41d7837edc4d` |
| Frozen upstream target | `v0.7.37` / `9d23e25ce1c5fb9310fcb94a10fdb4c4f554d4d8` |
| Common base | `v0.7.14` / `11168f915b044445d464345b3df7492764c59a07` |
| Divergence | `46` local-only commits; `421` upstream-only commits |
| Exact path overlap | `228` paths |
| Change surfaces | `911` local paths; `5,055` upstream paths |
| Wholesale merge conflicts | `127` reported conflict paths from `git merge-tree --write-tree --name-only main v0.7.37` |
| Existing worktrees | `3`; all were clean at planning preflight |
| Preserved stashes | `1979db89621c9557777a17ac466ab76495a08c93`, `71fcf4634ac0a30bbc11a931ac6d0db2c6177ebd`, `3c9df4d2e55413f993139e379215e37f462b1518` |
| Local servers | Ports `6887` and `6888` off |

These refs are frozen inputs to planning. Any changed ref invalidates the affected comparison and must be
reported before execution can be reconsidered.

## Why Capability Lanes Replace A Wholesale Merge

The frozen vendor release spans `5,055` paths and `421` commits, overlaps `228` local paths, and produces
`127` reported conflict paths in a merge-tree simulation. A wholesale import would also add large
marketing, documentation, unused-integration, hosted, and enterprise surfaces that are not required by
the local product. Its conflict and review surface would make preservation of the accepted architecture
harder to prove.

The default execution topology is therefore selective adoption from the frozen tag: surgically
cherry-pick a source commit only when the capability is cleanly isolated, or manually port the required
behavior when it is entangled. Neither action is authorized by the current planning status.

## Scope

In scope for planning:

- Classify upstream commit clusters and subsystems as `KEEP`, `ADAPT`, `DEFER`, or `REJECT`; the
  manifest does not require one entry per file, but every upstream-only commit must be covered by
  exactly one recorded cluster.
- Produce a capability adoption manifest tied to accepted architecture and verification evidence.
- Produce the migration content-hash and semantic-equivalence map required by the hard gate below.
- Define a dormant execution topology, bounded acceptance gates, stop conditions, and containment path.

Explicitly out of scope:

- Wholesale merge, rebase, cherry-pick, manual port, squash, conflict resolution, or movement of `main`.
- Migration journal, SQL, or snapshot edits and any migration application.
- Personal database, stash, service, worktree, remote, or push mutation.
- Product work from Sim architecture Phase 3 or later phases.

## Non-Negotiable Authority And Product Boundaries

1. The [north star](north-star.md), [domain model](domain-model.md),
   [architecture invariants](architecture-invariants.md), accepted ADRs, and
   [migration roadmap](migration-roadmap.md) govern conflict decisions.
2. `apps/mothership`, `packages/mothership-contracts`, and `packages/mothership-client` remain owned
   local service boundaries. Normal runtime must fail closed without an explicitly configured owned
   Mothership URL. Never restore `https://www.copilot.sim.ai` as a fallback.
3. The thin Main shell and hard Workflow Studio compile boundary remain accepted. Upstream growth must
   not make executable workflow, provider, tool, trigger, or integration graphs reachable from
   unrelated Main routes.
4. Existing Task and chat identities, durable data, URLs, access rules, transcripts, resources, streams,
   and owned-service behavior remain compatible unless a later explicit decision says otherwise.
5. Phase 2 remains complete and Phase 3 remains pending. Intake planning, any later intake execution,
   and intake acceptance do not authorize Artifact, Draft, Version, Change Set, provenance, or other
   Phase 3 implementation.

## Classification Policy

| Disposition | Rule |
| --- | --- |
| `KEEP` | Retain a compatible security, correctness, performance, dependency, or maintenance improvement without changing accepted local behavior or architecture. |
| `ADAPT` | Preserve the useful upstream outcome through local architecture, owned services, migration lineage, and personal-use defaults. |
| `DEFER` | Hold work that lacks present product need, retirement evidence, safe migration proof, or an accepted later-phase contract. |
| `REJECT` | Exclude hosted-service requirements, destructive unsupported data changes, architecture regressions, or behavior that weakens identifiers, access, durability, or fail-closed operation. |

Classification must be path- and behavior-specific. Do not accept or reject a whole subsystem merely
because upstream moved its directory or package boundary. The manifest records coherent commit clusters
or subsystems, with path evidence where needed, rather than inventorying all `5,055` vendor paths.

### Default dispositions

- `KEEP` compatible security, correctness, and data-safety fixes.
- `ADAPT` measured Studio-only memoization or prefetch and resource fixes without restoring an
  always-mounted Sidebar or global eager prefetch.
- `KEEP` or `ADAPT` maintenance and package changes only when an accepted lane requires them.
- `DEFER` landing and marketing surfaces, unused integrations, and opt-in capabilities without current
  need; `REJECT` any hosted or enterprise requirement that becomes mandatory.
- `DEFER` Phase-3-like workspace-fork, background-work, and custom-block-persistence changes from this
  intake without exception. They require their own later-phase slice and authorization.

### Initial capability queue

This queue records the first reviewed candidates. It is not execution authorization, and a source
commit may still be manually adapted instead of cherry-picked when its diff crosses local boundaries.

| Priority | Upstream source | Proposed disposition | Local rule |
| --- | --- | --- | --- |
| Security | `b73116226` | `KEEP` | Retain the DOCX hyperlink XSS fix and its focused tests. |
| File durability | `a3487da8a`, `e2cb3b29b` | `ADAPT` | Preserve silent autosave and draft recovery without replacing local route ownership. |
| Studio navigation | `65435f89a`, `67a2f0026` | `ADAPT` | Port row memoization and bounded command-search results only inside Studio-owned graphs. |
| Studio rendering | `9e1a4ac5d` | `ADAPT` | Take per-block subscriptions and presence isolation without duplicating realtime wire types or widening Main imports. |
| Resource CPU work | `76537c890`, `671535469`, `9204b4a24` | `ADAPT` | Port leaf Files, Tables, and Knowledge optimizations; keep local Suspense and route boundaries. |
| Integration repair | `507cee118`, `4df352fb7` | `ADAPT` | Retain nested-scroll and Server Components fixes while preserving the local split catalog. |
| Cold data seeding | `4fa1e045b` | `DEFER` pending measurement | Consider folder and permission prefetch only on Studio entry after an isolated A/B probe; never add global Main eager prefetch. |
| Workflow renderer extraction | `27b2a4f58`, `c7bb37d48` | `DEFER` | Structural extraction belongs to a later Phase-3-owned slice, not this intake. |

## Migration Lineage Hard Gate

### Current lineages

| Database or lineage | Verified state |
| --- | --- |
| Personal `simstudio` | `240` applied migrations, including applied local `0239` and `0240` identities and hashes |
| Disposable Phase 2 preview | `252` applied migrations through local `0252` |
| Frozen upstream | Journal extends through upstream `0260` |

Drizzle selects pending migrations by journal `when` greater than the latest database
`created_at`; it does not select them by migration tag or content hash. Local `0252` has
`when = 1784241453616`, later than upstream `0260` at `when = 1783810442774`. A naive upstream journal
therefore falsely applies zero vendor migrations to a Phase 2-shaped database.

The failure differs at the personal local-`0240` tip: a naive vendor journal skips vendor `0239`
through `0246`, then applies vendor `0247` through `0260`, creating silent schema holes before reaching
the destructive tail. The local `0241` through `0252` chain must remain the only upgrade path from that
tip.

Migration reconciliation is the first hard gate for any future execution:

1. Preserve the local SQL, journal entries, timestamps, and snapshots through `0252` byte-for-byte.
   Never replace or renumber local `0239`, `0240`, `0241` through `0251`, or `0252`.
2. Treat upstream `0239` through `0249` as exact content duplicates of local `0241` through `0251`.
   Never reapply them under their vendor identities.
3. Reissue only genuinely missing, accepted upstream deltas after the local head, using new local
   identities and strictly monotonic `when` timestamps. Generate the accepted subset sequentially;
   vendor numbers do not reserve local numbers.
4. Synthesize a valid snapshot lineage for the reconciled schema. Never select an entire `ours` or
   `theirs` journal or snapshot tree.
5. Reject upstream `0252 remove_a2a` and `0255 remove_credential_sets` from this intake. Current local
   code still reads both feature families. Any later retirement must remove callers first and use a
   separate expand-and-contract migration with its own data proof.
6. Replay-harden every accepted vendor delta because earlier local migrations can leave the runner in
   autocommit after embedded `COMMIT` statements. Before recreating a concurrent index, explicitly
   `DROP INDEX CONCURRENTLY IF EXISTS` so an invalid leftover cannot make `IF NOT EXISTS` skip repair.
   An adapted upstream `0259` Slack-routing migration must restore
   `lock_timeout = '5s'` before later DDL.

The vendor-only migration set is closed for planning as follows. A future execution approval may narrow
an `ADAPT` entry, but it may not silently promote a deferred or rejected entry.

| Upstream migration | Disposition | Dependency rule |
| --- | --- | --- |
| `0250 workspace_forking` | `DEFER` | Later-phase workspace-fork slice only. |
| `0251 wakeful_smiling_tiger` | `DEFER` | Background-work and workspace-fork persistence remain outside this intake. |
| `0252 remove_a2a` | `REJECT` | Local readers and schema remain active. |
| `0253 canonical_trigger_provider_config` | `ADAPT` | Reissue only with the corresponding canonical-trigger reader/writer lane and bounded backfill proof. |
| `0254 custom_block` | `DEFER` | Later product and persistence slice only. |
| `0255 remove_credential_sets` | `REJECT` | Local readers and schema remain active. |
| `0256 custom_block_inputs` | `DEFER` | Depends on deferred `0254`. |
| `0257 majestic_chat` | `DEFER` | Depends on deferred `0250` and `0251`; never split from that chain. |
| `0258 gigantic_lady_mastermind` | `DEFER` | TikTok-specific index has no approved current lane. |
| `0259 slack_native_routing` | `DEFER` | Native Slack routing requires a separately approved current-need lane. |
| `0260 unknown_sinister_six` | `ADAPT` | Split by accepted capability; reissue only required retry, storage, organization, or index statements. |

No migration-bearing execution may start until its accepted statements, dependency closure, new local
identity, monotonic `when`, replay treatment, and snapshot step are recorded in the manifest.

The reconciled lineage must pass all three disposable database fixtures before other acceptance work:

- Clean install from an empty database.
- Upgrade from a local-`0240`-shaped database.
- Upgrade from a Phase-2-local-`0252`-shaped database.

Each fixture must prove the expected schema, migration ledger, accepted data preservation, and
idempotent rerun. Fingerprint the personal database before and after the disposable proofs; it must
remain unchanged. Any personal database drift is an immediate stop.

## Dormant Future Execution Topology

This section defines a proposed execution shape only. It is not current authorization.

1. Preserve `codex/v0.7.37-curated-intake-plan` as the planning checkpoint.
2. After separate approval, create fresh campaign branch `codex/v0.7.37-curated-intake` in a separate
   worktree at
   `/Users/kyin/Projects/sim-v0.7.37-curated-intake` from local base
   `5efa6969a7fd961c64d01922827c41d7837edc4d`.
3. Treat exact tag `v0.7.37` at `9d23e25ce1c5fb9310fcb94a10fdb4c4f554d4d8` as a read-only source.
   Do not merge its tree wholesale.
4. Execute capability lanes in the approved priority order. Assign one writer to each disjoint slice;
   reviewers remain read-only. Parallel lanes require separate branches and worktrees with non-overlapping
   ownership.
5. Record every source commit. Use a surgical cherry-pick only for a cleanly isolated capability; use a
   manual port with source attribution when the useful behavior is entangled.
6. Test and commit each slice independently so it can be accepted, reverted, or abandoned without
   coupling unrelated vendor work. Resolve and prove the migration hard gate before accepting any
   migration-bearing slice.
7. Do not merge the vendor tag broadly, rewrite/rebase/squash local history, or apply broad `ours` or
   `theirs` resolution. Do not create an `ours` ancestry seal by default: it would make unadopted vendor
   commits appear merged.
8. Keep `main` fixed until the whole campaign and one bounded postflight are accepted. Do not push.
9. Compare future frozen vendor tags against the prior frozen tag and this manifest, not fabricated merge
   ancestry.
10. Contain failure by reverting or abandoning the unaccepted slice, lane branch, or campaign branch.
    Do not reset `main`, alter stashes, rewrite history, or repair by mutating the personal DB.

## Capability Adoption Manifest

Update this section in place during a separately approved campaign. Each material upstream commit
cluster or subsystem must record:

- Capability or subsystem and source commit or commits.
- `KEEP`, `ADAPT`, `DEFER`, or `REJECT` disposition.
- Governing architecture decision or local product constraint.
- For adopted work, the local slice commit and affected compatibility surface.
- Targeted proof required for acceptance.

Stop rather than infer if a decision is ambiguous about architecture or domain ownership, persistence
semantics, durable identity or data, URL or access behavior, owned Mothership operation, or the Phase 3
firewall. Stop immediately on any personal database fingerprint drift.

## Bounded Acceptance Gates For Separately Approved Execution

Run one risk-proportional postflight after the accepted capability lanes are assembled. Do not audit
unchanged surfaces merely because the upstream change set is large.

1. Before accepting any migration-bearing lane, pass the three-fixture migration matrix and prove the
   personal database fingerprint unchanged. If no migration file, journal, snapshot, or schema changes,
   prove those paths and the personal fingerprint stayed unchanged instead of running unnecessary
   migration fixtures.
2. Close the capability adoption manifest with no unresolved high-risk disposition.
3. Run targeted tests for changed migration, auth, Mothership, chat/Task, persistence, realtime,
   execution, navigation, and compatibility seams.
4. Run applicable architecture and client guards:
   - `bun run check:home-boundary`
   - `bun run check:studio-boundary`
   - `bun run check:center-boundary`
   - `bun run check:boundaries`
   - `bun run check:realtime-prune`
   - `bun run check:migrations <accepted-base>` when migrations changed
   - `bun run check:api-validation:strict` when API boundaries changed
   - `bun run check:react-query` when client-query boundaries changed
5. If package manifests or the lockfile changed, run a frozen-lock install first. Run relevant workspace
   typechecks and the `apps/sim` production build once on the assembled campaign.
6. Run one browser journey covering Main, changed sidebar routes, Home/chat compatibility, Workflow
   Studio, and return navigation.
7. If a relevant entry or runtime graph changed, compare the local baseline and campaign result against
   the accepted cold/warm surface budgets in [performance-probe.md](performance-probe.md). Pure upstream
   is an optional diagnostic only when it boots without hosted assumptions; it is not the acceptance
   authority.
8. Run `bun run mship:check`, `bun run mship-fixtures:check`, `bun run mship-client:check`, and
   `bun run mship-service:check`, plus URL, auth, and runtime smoke. Prove the owned URL path works,
   missing or invalid owned configuration fails closed, and no `https://www.copilot.sim.ai` fallback is
   reachable.

Acceptance must report the frozen source ref, adopted/deferred/rejected manifest, accepted slice commits,
migration map, checks and results, performance evidence when required, browser evidence, owned-service
result, branch/worktree/stash state, and confirmation that nothing was pushed and Phase 3 was not
started.

## Approval Boundary

Planning completes when the classification, migration map, capability-manifest shape, and future
execution proposal are accepted. That completion does not start integration. A separate explicit
approval is required to create the proposed campaign branch/worktree, cherry-pick a source commit, or
manually port vendor behavior. Even an accepted campaign does not start Sim architecture Phase 3;
Phase 3 requires its own accepted slice specification and explicit authorization.
