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

Local connection registry:

```text
apps/sim/config/center/capabilities/connections/center-local-import.json
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

The schema is enforced by `apps/sim/config/center/schemas/capability.schema.json`.

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

Discovery is read-only until a capability is explicitly connected. Capability metadata must never be treated as permission to execute arbitrary code.

## Runtime Status

Implemented:

- Capability schema exists at `apps/sim/config/center/schemas/capability.schema.json`.
- Capability metadata exists under `apps/sim/config/center/capabilities/`.
- Producers are documented with capability ids in governance records.
- Center import adapters can map producer records into Center packets.
- Producer import packets declare packet-level capability ids.
- Producer records can optionally declare record-level capability ids.
- Local import routes read `apps/sim/config/center/capabilities/*.json` and reject packets with unknown declared capability ids.
- The capability registry loader rejects malformed capability schema fields, unknown top-level keys, duplicate ids, malformed connection registry ids, and connection ids that do not exist in registered capability metadata.
- Browser-local imports verify declared capability ids before mutating profile data.
- Unknown capability ids are surfaced in `CenterProducerImportSummary.blockedUnknownCapabilityIds`.
- Malformed declared capability ids are blocked before producer import mutation, even when no optional runtime registry is supplied.
- Malformed packet-shape blocker output only displays canonical capability ids or `malformed capability id`.
- Malformed explicit `registeredCapabilityIds` runtime inputs return blocked summaries instead of throwing.
- Empty producer record `sourceRef` values are blocked before mutation so capability-gated imports cannot create non-dedupable records.
- Empty producer reference values are blocked before mutation so capability-gated imports cannot create blank unresolved refs.
- Empty action-proposal `recommendationRef` values are blocked before mutation so capability-gated imports cannot silently drop recommendation-to-action provenance.
- Empty required producer record fields are blocked before mutation so capability-gated imports cannot create blank event, subject, title, domain, reason, or action-target data.
- Malformed producer timestamps are blocked before mutation so capability-gated imports cannot create invalid event or observation chronology.
- Empty loop `nextAction` and `blockedBy` values are blocked before mutation so capability-gated imports cannot create blank blocker or next-step text.
- Empty evidence `uri` values are blocked before mutation so capability-gated imports cannot create blank inspection targets.
- Local producer imports require declared capabilities to be connected in `apps/sim/config/center/capabilities/connections/center-local-import.json`.
- Local producer import gates reject capabilities above A2 authority or T3 truth impact.
- Local producer import gates reject non-importable lifecycle states.
- Local producer import gates reject unsupported or unmet import policy requirements.
- Local producer import and action proposal gates reject non-plain runtime capability metadata entries before trusting capability metadata.
- Local producer import and action proposal gates reject explicitly supplied malformed runtime capability registry roots instead of treating them as absent.
- Local producer import gates require explicit local-import context for capabilities that declare `explicit-local-import`.
- Local producer import gates require packet evidence for capabilities that declare `evidence-required`.
- Capability metadata violations are surfaced in `CenterProducerImportSummary.blockedCapabilityGateViolations`.
- MS2 recovery and worker review action proposals persist their capability ids.
- `CenterLocalSpine.approveActionProposal()` and `CenterLocalSpine.executeActionProposal()` gate status transitions through connected capability metadata.
- Action proposals without capability ids fail closed before approval or execution status changes.
- A3/A4 action proposal status transitions remain blocked.
- `center:readiness` now includes a `capability-system` gate that loads local capability metadata plus the connection registry and fails closed on registry load, connection, authority, truth-impact, lifecycle, or policy violations.
- `center:readiness` now includes an `action-execution-authority` gate that reports ready only when external execution is not enabled and A3/A4 authority remains locked.

Not implemented:

- Center does not yet unlock A3/A4 authority.
- Center does not yet execute external actions after an action proposal reaches `executed` local state.
- Center does not yet provide signed per-profile policy state beyond capability files, local connection registry, and explicit review context.

This means Center now has a metadata-backed import boundary and local action transition boundary. Live autonomous expansion is still gated on reviewed credential handling, production sync, explicit A3/A4 policy, and any future external execution engine.

## Runtime Entry Points

Pure capability gate enforcement:

```text
apps/sim/lib/center/capability-gates.ts
```

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
