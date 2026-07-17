# ADR 0004: Control Surfaces Project Canonical Domain State

- Status: Accepted
- Date: 2026-07-16
- Decision owners: Sim maintainers

## Context

Sim now has three overlapping control and evidence models:

- The canonical Task, Artifact, Execution, Identity/Policy, Decision, and Activity Event model.
- Center's local-first profile, loop, proposal, evidence, outcome, and review-packet dataset.
- Mothership's runtime state plus the FeatureCase ledger and engineering control panel.

These models serve different purposes. Without an explicit ownership decision, Center or FeatureCase
state could become a second product system of record, and the phrase "Mothership execution kernel"
could be read as ownership of the complete Execution domain rather than ownership of runtime mechanics.

## Decision

### Canonical Domain Ownership

- Task owns intended outcome and coordination state.
- Artifact owns drafts, committed versions, change sets, and artifact provenance.
- Execution owns the durable user-visible attempt, lifecycle, result, cost, cancellation, and retry
  lineage.
- Identity/Policy owns actor identity, authorization, capability policy, and autonomy decisions.
- Decision and Activity Event record material choices and transitions against those canonical objects.

Control surfaces and runtime services project, command, or implement this state. They do not replace its
system of record.

### Mothership Runtime Boundary

`apps/mothership` remains a real process boundary. It owns private runtime mechanics required to perform
and resume work: stream sequence, provider envelopes, checkpoints, pending tool calls, resume legs, and
abort markers.

Those records implement an Execution; they do not define a competing product-level Execution model.

- A canonical Execution ID is distinct from Mothership run and stream correlation IDs.
- One Execution may contain multiple checkpoint and resume stream legs.
- An explicit retry creates a new Execution linked to the prior Execution.
- Workflow execution identifies the exact Artifact Version or explicitly authorized Draft it used.
- Durable runtime events and checkpoints are authoritative for replay. Redis and browser state are
  delivery caches or projections, not the only source of execution truth.

### Center Control Projection

Center remains the current local-first proving ground and control projection. Its workspace JSON dataset
is an import buffer and read model, not the production system of record for Task, Artifact, Execution,
Identity/Policy, Decision, or Activity Event.

Center may project canonical state and submit proposals or commands through domain contracts. A local
Center status change cannot mutate or substitute for canonical state. In particular,
`ActionProposal.status = 'executed'` does not prove that an Execution occurred without a linked canonical
Execution record.

### FeatureCase Governance Evidence

FeatureCase and its hash-chained ledger are engineering governance and evidence records. They are not
Tasks, Artifacts, or Executions. The Mothership control panel is an engineering/runtime operator cockpit,
not the user-facing Command Center or Operations Center.

When FeatureCase evidence is exposed through product surfaces, it links to the owning Task and applicable
Artifact Versions, Executions, Decisions, Activity Events, and evidence references. A FeatureCase grade or
ledger transition cannot mutate canonical product state by itself.

### Center Primitive Mapping

| Center primitive | Target treatment |
| --- | --- |
| Profile | Local projection scope; canonical identity and policy remain in Identity/Policy. |
| Actor | Actor identity or provenance reference; it does not grant authority. |
| Loop | Task when it represents one intended outcome; otherwise a saved grouping or projection over Tasks. |
| Decision | Canonical Decision when promoted through an accepted domain contract. |
| Action Proposal | Proposed command or checkpoint; `executed` requires a linked actual Execution. |
| Evidence | Provenance or Resource Reference; a durable payload is an Artifact or Execution output. |
| Raw Event and Observation | Source material or projection feeding Activity Events; not independent product truth. |
| Outcome | Execution result or Activity Event projection. |
| Review Packet | Governance Artifact or evidence attached to Task, Execution, and Decision. |
| Recommendation, Prediction, Feature Projection | Rebuildable derived projections; never authoritative state. |

Per-record migration, retention, and retirement rules remain slice decisions. The existing Center local
dataset remains intact until those slices pass their data and rollback gates.

## Migration Boundary

This ADR accepts ownership boundaries only.

- It does not change Phase 2 Task persistence, chat compatibility, URLs, authorization, or rollback.
- It does not authorize Artifact, Execution, Center, Command Center, Operations Center, or UI
  implementation.
- Phase 4 establishes canonical Execution correlation and adapts existing run persistence.
- Phase 5 maps, promotes, or retires Center-local records through explicit compatibility slices.
- ARCH-005 remains open. This ADR does not silently map Center's A0-A4 authority or T0-T4 truth-impact
  vocabulary to canonical Autonomy Policy classes.

## Consequences

- Sim keeps a modular-monolith domain model while allowing measured runtime process boundaries.
- Mothership can scale and restart independently without becoming a second product brain.
- Center can continue local dogfooding without claiming canonical production ownership.
- FeatureCase remains useful proof infrastructure without displacing Task as the primary work object.
- Product surfaces may be replaced or separated later because domain truth stays behind explicit
  contracts and framework-neutral persistence.

## Alternatives Considered

- **Make Center canonical immediately:** rejected because its current local dataset is a proving-ground
  model without the accepted Task, Artifact Version, Execution, authorization, and migration contracts.
- **Make FeatureCase the primary work object:** rejected because an engineering proof case is not the
  user's intended outcome and cannot replace Task.
- **Give Mothership the full Execution domain:** rejected because runtime process ownership does not
  justify a second user-visible lifecycle, cost, retry, or result system of record.
- **Merge all three models in one migration:** rejected as a big-bang data rewrite without per-cohort
  compatibility or rollback evidence.

## Revisit When

Revisit only when measured operational requirements justify independent domain data ownership, or when
accepted product evidence shows that a current projection must become a canonical object. Any change
requires a new ADR plus an explicit migration and rollback slice.

## Related

- `apps/sim/docs/architecture/adr/0001-task-primary-work-object.md`
- `apps/sim/docs/architecture/domain-model.md`
- `apps/sim/docs/architecture/migration-roadmap.md`
- `apps/sim/docs/center/architecture.md`
- `docs/superpowers/plans/mothership-backend-replacement-architecture.md`
- `docs/superpowers/plans/mothership-agent-operating-system.md`
