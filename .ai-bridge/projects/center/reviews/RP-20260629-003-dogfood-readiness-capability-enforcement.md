---
id: RP-20260629-003
type: review-packet
project: center
status: draft
round: 0
max_rounds: 20
created: 2026-06-29
updated: 2026-06-29
topic: Center dogfood readiness and runtime capability enforcement
links:
  - center-phase-0-12-integration-audit-20260629
  - center-roadmap-v1
  - center-governing-spec-v1
  - execution-authority-v1
  - capability-metadata-contract-v1
  - center-ontology-freeze-v1
---

# RP-20260629-003 — Center Dogfood Readiness / Capability Enforcement

## Status

Draft review packet.

No new feature phase should begin from this packet until it is reviewed and approved.

## Objective

Determine whether Center is ready for real dogfooding after roadmap Phase 0-12, and close the main truth-preservation gaps found in the Phase 0-12 integration audit.

## Scope

This packet is not a product redesign and not a new feature expansion.

It covers only:

```text
1. Full all-producer import smoke in one profile.
2. Repeated import idempotency.
3. Unresolved-ref accounting in producer import summaries.
4. Explicit review-packet approval/worker-gate metadata.
5. Runtime capability-gate design and first enforcement boundary.
6. Clarification of .ai-bridge vs explicit OKF / llm-wiki structure.
```

## Non-goals

```text
- No live GitHub sync.
- No live Plane sync.
- No worker execution.
- No new Center visual surface.
- No model-based prediction upgrade.
- No app notarization or distributable packaging.
- No upstream pull/rebase/reset.
```

## Required questions

### 1. All-producer import smoke

Can one fresh Center profile import all current producers sequentially without breaking coherence?

Sequence:

```text
Create profile
Import MS2
Import Reviews
Import GitHub
Import Plane
Import Learn/Understand
Import Workers
Derive baseline prediction
Export profile
```

Verify:

```text
- no route crash
- no duplicate loops on repeated import
- all evidence refs resolve
- all raw event refs resolve
- all observations have source events
- all action proposals have visible evidence
- review-needed proposals render correctly
- prediction remains honest about data sufficiency
```

### 2. Idempotency

Does repeating every import produce zero duplicate semantic records?

Expected:

```text
First import: records added
Second import: records skippedExisting or updated intentionally
No duplicated loops/evidence/raw events/observations/recommendations/action proposals
```

### 3. Import integrity accounting

Should `applyCenterProducerImport` report unresolved refs?

Proposed fields:

```ts
observationsSkippedMissingEvents: number
unresolvedEvidenceRefs: string[]
unresolvedSourceEventRefs: string[]
unresolvedRecommendationRefs: string[]
```

Default answer: yes. Silent drops are acceptable as defensive behavior only if they are counted and surfaced.

### 4. Explicit review packet gates

Should review packet import stop inferring approval state only from prose?

Proposed frontmatter:

```yaml
approval_state: approved-with-required-changes
worker_gate: approved-for-execution
```

Default answer: yes. Prose inference may remain fallback, not source of truth.

### 5. Runtime capability enforcement

How should capability metadata attach to runtime import packets?

Options:

```text
A. packet-level capability ids
B. record-level capability ids
C. both packet-level default and record-level overrides
```

Default answer: C.

Every imported event/observation should be traceable to a registered capability id before live producers or worker execution are allowed.

### 6. Knowledge system / OKF / llm-wiki

Current state:

```text
.ai-bridge is functioning as a lightweight project knowledge system.
There is no separate explicit OKF or llm-wiki implementation directory.
```

Decision needed:

```text
Keep .ai-bridge only for now
or
create .ai-bridge/projects/knowledge-system/ with OKF/llm-wiki conventions
```

Default answer: keep `.ai-bridge` as source of truth now, but add a knowledge-system spec before further multi-agent expansion.

## Acceptance criteria

This packet can be approved only if:

```text
1. All-producer smoke passes or blockers are documented.
2. Repeated import behavior is proven.
3. Import integrity accounting is implemented or explicitly deferred with reason.
4. Review packet gates are explicit or the risk is explicitly accepted.
5. Runtime capability enforcement boundary is defined.
6. Current-plan is updated with the next active scope.
```

## Recommended verdict language

Choose exactly one:

```text
APPROVE DOGFOOD
APPROVE WITH REQUIRED FIXES
BLOCK DOGFOOD
```

## Default recommendation

APPROVE WITH REQUIRED FIXES.

The architecture is strong enough to dogfood, but not strong enough to expand into live integrations or autonomous worker execution until capability enforcement and import integrity accounting are tightened.
