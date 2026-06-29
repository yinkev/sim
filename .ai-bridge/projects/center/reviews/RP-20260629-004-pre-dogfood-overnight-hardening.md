---
id: RP-20260629-004
type: review-packet
project: center
status: converged
round: 8
max_rounds: 20
created: 2026-06-29
updated: 2026-06-29
topic: Pre-dogfood overnight hardening
approval_state: approved-with-required-changes
worker_gate: approved-for-execution
links:
  - RP-20260629-003
  - center-phase-0-12-integration-audit-20260629
  - center-worker-handoff-after-phase-0-12-audit
---

# RP-20260629-004 — Pre-Dogfood Overnight Hardening

## Supersession Note

The morning dogfood runbook location was superseded by the 2026-06-29 documentation governor decision.

Canonical runbook:

```text
apps/sim/docs/center/morning-dogfood-runbook.md
```

Reason: dogfood operating guidance is stable project documentation, not governance history.

## Objective

Prepare Center for Kevin's first morning dogfood session without adding new product scope.

This packet exists because it is currently too late for Kevin to dogfood manually, but the worker can still harden the system before use.

## Implementation Evidence

Current implementation evidence:

```text
apps/sim/lib/center/all-producer-smoke.test.ts
apps/sim/lib/center/producer-import.test.ts
apps/sim/lib/center/review-packets.test.ts
apps/sim/lib/center/capability-registry.ts
apps/sim/lib/center/producer-import.ts
```

Verified checks:

```text
bun --cwd apps/sim test lib/center/producer-import.test.ts lib/center/review-packets.test.ts lib/center/all-producer-smoke.test.ts lib/center/producers/ms2scheduler.test.ts lib/center/producers/github.test.ts lib/center/producers/plane.test.ts lib/center/producers/learn-understand.test.ts lib/center/producers/worker-lane.test.ts
bun run check:center-boundary
bun run check:api-validation
```

Result:

```text
All current producer imports declare registered capability ids.
All-producer smoke import returns zero unresolved refs.
Repeated all-producer import is idempotent.
Unknown capability ids block import before profile mutation.
Review packet frontmatter is the explicit worker gate source of truth.
```

## Rule

Do not add new features. Tighten the spine.

## Highest-value work before dogfood

### 1. All-producer smoke harness

Create a deterministic test/harness that creates one fresh Center profile and imports all current producers in order:

```text
MS2
Reviews
GitHub
Plane
Learn/Understand
Workers
Baseline prediction
Export profile
```

Verify:

```text
all evidence refs resolve
all raw event refs resolve
all observations have source events
all action proposals have evidence or explicit reason why not
all loops have sourceRef or manual origin
baseline prediction does not overstate confidence
exported profile contains no records from another profile
```

### 2. Repeated-import idempotency

Run the same import sequence twice against the same profile.

Expected:

```text
first pass adds records
second pass produces skippedExisting or intentional updates
no duplicate loops/evidence/raw events/observations/recommendations/action proposals
```

### 3. Import integrity accounting

Extend `CenterProducerImportSummary` to surface unresolved refs rather than silently dropping them.

Suggested fields:

```ts
observationsSkippedMissingEvents: number
unresolvedEvidenceRefs: string[]
unresolvedSourceEventRefs: string[]
unresolvedRecommendationRefs: string[]
```

Acceptance:

```text
bad producer refs are visible in summary
good current producers still return zero unresolved refs
```

### 4. Explicit review packet gates

Add explicit review packet frontmatter support:

```yaml
approval_state: approved-with-required-changes
worker_gate: approved-for-execution
```

Rules:

```text
explicit frontmatter wins
prose inference remains fallback only
missing explicit gate should be visible in parsed payload or summary
```

### 5. Runtime capability gate — first boundary

Do not build a giant permission engine.

Add the first small enforcement boundary:

```text
producer import packet declares capability ids
records can optionally override capability id
import verifies capability ids exist in .ai-bridge/capabilities or documented registry
unknown capability id fails or returns explicit blocked summary
```

Acceptance:

```text
current producers can declare valid capabilities
unknown capability import is rejected or visibly blocked
no A3/A4 capability executes silently
```

### 6. Morning dogfood runbook

Create a short user-facing runbook:

```text
how Kevin starts Center
what he should click first
what to import
what to inspect
what counts as broken
what to report back
```

Put it at:

```text
apps/sim/docs/center/morning-dogfood-runbook.md
```

Keep it short and practical.

## Non-goals

```text
No Screenpipe integration yet.
No live GitHub/Plane sync.
No worker execution.
No new UI surface unless needed to expose errors from this packet.
No model prediction upgrade.
No upstream pull/rebase/reset.
```

## Completion report must include

```text
files changed
checks run
smoke results
idempotency results
unresolved ref counts
capability gate behavior
morning runbook location
remaining blockers
verdict: READY FOR MORNING DOGFOOD / NEEDS FIXES / BLOCKED
```

## Default verdict target

READY FOR MORNING DOGFOOD.

If this cannot be reached, stop and document blockers by architectural risk.
