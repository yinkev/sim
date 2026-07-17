# Center Capability System

## Purpose

This document explains the capability metadata model used to govern producer abilities.

Repository path: `apps/sim/docs/center/capability-system.md`  
Owning project: Center  
Owner: Sim maintainers  
Current status: Metadata schema and capability files exist; producer imports enforce registered capability ids. Full authority/truth-impact/policy enforcement is not implemented.

## Canonical Sources

Human-readable project documentation:

```text
apps/sim/docs/center/capability-system.md
```

Machine-readable schema:

```text
apps/sim/config/center/schemas/capability.schema.json
```

Capability registry files:

```text
apps/sim/config/center/capabilities/*.json
```

Governance protocol:

```text
apps/sim/docs/architecture/architecture-invariants.md
```

Dogfood-readiness review:

```text
apps/sim/fixtures/center/review-packets/center-capability-review.md
```

## Definition

A capability is a typed, versioned metadata contract describing something a producer can do.

Capabilities prevent integrations from becoming bespoke by making abilities discoverable, reviewable, and governable.

## Required Metadata

Capability JSON files must include:

- `id`
- `version`
- `producerId`
- `kind`
- `inputs`
- `outputs`
- `authorityRequired`
- `truthImpact`
- `policyRequirements`
- `evidenceProduced`
- `failureModes`
- `lifecycle`

Optional dependency list:

- `requires`

The authoring shape is declared by `apps/sim/config/center/schemas/capability.schema.json`. The current
runtime registry reader extracts ids from capability JSON files; it does not validate those files against
the full schema.

## Capability Ids

Capability ids follow this pattern:

```text
(emit|read|write|run|predict|summarize|review|feature).*
```

Examples currently registered:

- `apps/sim/config/center/capabilities/emit.github_commit.json`
- `apps/sim/config/center/capabilities/emit.github_pull_request.json`
- `apps/sim/config/center/capabilities/emit.ms2.study_activity.json`
- `apps/sim/config/center/capabilities/emit.ms2.recovery_proposal.json`
- `apps/sim/config/center/capabilities/emit.plane_issue.json`
- `apps/sim/config/center/capabilities/emit.learn_learning_gap.json`
- `apps/sim/config/center/capabilities/emit.understand_system_map.json`
- `apps/sim/config/center/capabilities/emit.agent_run_started.json`
- `apps/sim/config/center/capabilities/emit.agent_review_needed.json`

## Authority And Truth Impact

Capability execution must be gated by:

- authority level from `apps/sim/docs/architecture/architecture-invariants.md`
- truth impact from `apps/sim/docs/architecture/architecture-invariants.md`
- profile scope
- policy requirements
- evidence requirements

Authority levels:

```text
A0 automatic, no report
A1 automatic, report
A2 propose/review first
A3 Kevin approval required
A4 forbidden unless explicitly unlocked
```

Truth impact:

```text
T0 cosmetic
T1 organizational
T2 interpretive
T3 doctrinal
T4 irreversible or identity-level
```

Safe autonomy requires both authority and truth impact to be safe.

## Lifecycle

Capability lifecycle values:

```text
draft
registered
available
connected
disabled
deprecated
removed
```

The target model requires an explicit connection before execution. The current runtime does not implement
connection or lifecycle enforcement. Capability metadata must never be treated as permission to execute
arbitrary code.

## Runtime Status

Implemented:

- Capability schema exists at `apps/sim/config/center/schemas/capability.schema.json`.
- Capability metadata exists under `apps/sim/config/center/capabilities/`.
- Producers are documented with capability ids in governance records.
- Center import adapters can map producer records into Center packets.
- Producer import packets declare packet-level capability ids.
- Producer records can optionally declare record-level capability ids.
- Local import routes read `apps/sim/config/center/capabilities/*.json` and reject packets with unknown declared capability ids.
- Browser-local imports verify declared capability ids before mutating profile data.
- Unknown capability ids are surfaced in `CenterProducerImportSummary.blockedUnknownCapabilityIds`.
- MS2 recovery and worker review action proposals persist their capability ids.
- Current focused producer tests and import routes verify registered capability ids directly. The current
  package manifest has no consolidated `center:readiness` command.

Not implemented:

- Center does not yet unlock A3/A4 authority.
- Center does not yet execute external actions after an action proposal reaches `executed` local state.
- Center does not yet provide signed per-profile policy state beyond capability files and explicit review context.
- Center does not yet enforce connection, authority, truth-impact, lifecycle, or policy requirements from
  capability metadata during imports or local proposal status changes.
- Center does not yet map A0-A4 authority or T0-T4 truth impact to canonical Autonomy Policy.
- Center does not yet validate capability files against the full JSON schema at registry load.
- Center does not yet expose approve or execute status-transition APIs for Action Proposals.

This means Center currently has a registered-capability-id import boundary, not an execution-authority
boundary. Live autonomous expansion remains gated on reviewed credential handling, production sync,
canonical autonomy mapping, explicit A3/A4 policy, and a future execution engine.

## Runtime Entry Points

Server-only capability registry reader:

```text
apps/sim/lib/center/capability-registry.ts
```

Producer import enforcement:

```text
apps/sim/lib/center/producer-import.ts
```

Local import API routes:

```text
apps/sim/app/api/center/ms2scheduler/import/route.ts
apps/sim/app/api/center/github/import/route.ts
apps/sim/app/api/center/plane/import/route.ts
apps/sim/app/api/center/learn-understand/import/route.ts
apps/sim/app/api/center/workers/import/route.ts
```

Smoke/idempotency proof:

```text
apps/sim/lib/center/all-producer-smoke.test.ts
```

## Extension Rules

When adding or changing a capability:

1. Add or update a JSON file under `apps/sim/config/center/capabilities/`.
2. Validate it against `apps/sim/config/center/schemas/capability.schema.json`.
3. Link it from the owning feature documentation or an accepted ADR.
4. Update producer docs in `apps/sim/docs/center/producer-model.md` only if system behavior or source paths changed.
5. Do not change runtime enforcement semantics without an accepted architecture ADR.

## Related Documents

- `apps/sim/docs/center/producer-model.md`
- `apps/sim/docs/center/ontology-and-local-spine.md`
- `apps/sim/docs/architecture/architecture-invariants.md`
- `apps/sim/config/center/schemas/capability.schema.json`
- `apps/sim/fixtures/center/review-packets/center-capability-review.md`
