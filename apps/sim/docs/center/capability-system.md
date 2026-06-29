# Center Capability System

## Purpose

This document explains the capability metadata model used to govern producer abilities.

Repository path: `apps/sim/docs/center/capability-system.md`  
Owning project: Center  
Owner: Sim maintainers  
Current status: Metadata schema and capability files exist; runtime enforcement is not implemented.

## Canonical Sources

Human-readable project documentation:

```text
apps/sim/docs/center/capability-system.md
```

Machine-readable schema:

```text
.ai-bridge/schemas/capability.schema.json
```

Capability registry files:

```text
.ai-bridge/capabilities/*.json
```

Governance protocol:

```text
.ai-bridge/protocols/execution-authority.md
```

Dogfood-readiness review:

```text
.ai-bridge/projects/center/reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md
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

The schema is enforced by `.ai-bridge/schemas/capability.schema.json`.

## Capability Ids

Capability ids follow this pattern:

```text
(emit|read|write|run|predict|summarize|review|feature).*
```

Examples currently registered:

- `.ai-bridge/capabilities/emit.github_commit.json`
- `.ai-bridge/capabilities/emit.github_pull_request.json`
- `.ai-bridge/capabilities/emit.plane_issue.json`
- `.ai-bridge/capabilities/emit.learn_learning_gap.json`
- `.ai-bridge/capabilities/emit.understand_system_map.json`
- `.ai-bridge/capabilities/emit.agent_run_started.json`
- `.ai-bridge/capabilities/emit.agent_review_needed.json`

## Authority And Truth Impact

Capability execution must be gated by:

- authority level from `.ai-bridge/protocols/execution-authority.md`
- truth impact from `.ai-bridge/protocols/execution-authority.md`
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

- Capability schema exists at `.ai-bridge/schemas/capability.schema.json`.
- Capability metadata exists under `.ai-bridge/capabilities/`.
- Producers are documented with capability ids in governance records.
- Center import adapters can map producer records into Center packets.

Not implemented:

- Center does not yet verify import packet records against capability ids.
- Center does not yet enforce `authorityRequired`.
- Center does not yet enforce `truthImpact`.
- Center does not yet enforce `policyRequirements`.
- Center does not yet produce a runtime capability connection registry.

This gap is why `.ai-bridge/projects/center/reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md` blocks live autonomous expansion.

## Extension Rules

When adding or changing a capability:

1. Add or update a JSON file under `.ai-bridge/capabilities/`.
2. Validate it against `.ai-bridge/schemas/capability.schema.json`.
3. Link it from the relevant producer implementation record in `.ai-bridge/projects/center/phase-*.md` or a new decision.
4. Update producer docs in `apps/sim/docs/center/producer-model.md` only if system behavior or source paths changed.
5. Do not change runtime enforcement semantics without a decision in `.ai-bridge/projects/center/decisions.md`.

## Related Documents

- `apps/sim/docs/center/producer-model.md`
- `apps/sim/docs/center/ontology-and-local-spine.md`
- `.ai-bridge/protocols/execution-authority.md`
- `.ai-bridge/schemas/capability.schema.json`
- `.ai-bridge/projects/center/reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md`
