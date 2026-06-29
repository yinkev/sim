# Current Plan - Documentation Governor Complete

Status: complete.

## Objective

Make the repository the primary source of truth for Center system understanding, with `.ai-bridge` limited to governance, decisions, audits, reviews, current plans, and cross-project coordination.

## Canonical System Docs

Read first:

```text
apps/sim/docs/center/README.md
apps/sim/docs/center/architecture.md
apps/sim/docs/center/ontology-and-local-spine.md
apps/sim/docs/center/producer-model.md
apps/sim/docs/center/capability-system.md
apps/sim/docs/center/operations-and-dogfood.md
apps/sim/docs/center/morning-dogfood-runbook.md
docs/DOCUMENTATION_GUIDE.md
docs/REPOSITORY_MAP.md
```

## Governance / Evolution Records

Read for decisions, reviews, audits, and gates:

```text
.ai-bridge/projects/center/decisions.md
.ai-bridge/projects/center/roadmap.md
.ai-bridge/projects/center/audits/repository-documentation-governor-20260629.md
.ai-bridge/projects/center/audits/phase-0-12-integration-audit-20260629.md
.ai-bridge/projects/center/reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md
.ai-bridge/projects/center/reviews/RP-20260629-004-pre-dogfood-overnight-hardening.md
```

## Completed Changes

- Added canonical Center docs under `apps/sim/docs/center/`.
- Added repository documentation guide and repository map under `docs/`.
- Updated root and docs navigation.
- Redirected duplicate `.ai-bridge` system-doc files to canonical repo docs.
- Redirected touched producer/MS2/CPU-RAM project indexes to canonical Center docs.
- Added supersession notes to older knowledge-system and dogfood-runbook governance guidance.
- Recorded the documentation-placement decision in `.ai-bridge/projects/center/decisions.md`.
- Recorded the documentation-governor audit in `.ai-bridge/projects/center/audits/repository-documentation-governor-20260629.md`.

## Verification

Passed:

```text
Markdown relative links OK (52 files)
Explicit canonical paths OK
git diff --check
bun run check:center-boundary
bun run check:api-validation
bun --cwd apps/sim test lib/center/local-spine.test.ts lib/center/producer-import.test.ts lib/center/baseline-prediction.test.ts lib/center/review-packets.test.ts lib/center/producers/ms2scheduler.test.ts lib/center/producers/github.test.ts lib/center/producers/plane.test.ts lib/center/producers/learn-understand.test.ts lib/center/producers/worker-lane.test.ts
```

## Remaining Gates

Center is documented as the implemented local system, not as production-complete.

Required implementation gaps remain:

- Runtime capability enforcement.
- Production storage/sync decision and implementation.
- Live producer connectors.
- Prediction outcome scoring.
- Profile export/delete UI.

These are documented in:

```text
apps/sim/docs/center/README.md
apps/sim/docs/center/capability-system.md
apps/sim/docs/center/operations-and-dogfood.md
```
