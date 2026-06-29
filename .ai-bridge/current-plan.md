# Current Plan - Center Production Readiness

Status: active.

## Objective

Close remaining Center production-readiness gaps without adding new product scope.

## Active Slice

Runtime producer hardening from:

```text
.ai-bridge/projects/center/reviews/RP-20260629-004-pre-dogfood-overnight-hardening.md
```

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

## Completed Earlier

- Added canonical Center docs under `apps/sim/docs/center/`.
- Added repository documentation guide and repository map under `docs/`.
- Updated root and docs navigation.
- Redirected duplicate `.ai-bridge` system-doc files to canonical repo docs.
- Redirected touched producer/MS2/CPU-RAM project indexes to canonical Center docs.
- Added supersession notes to older knowledge-system and dogfood-runbook governance guidance.
- Recorded the documentation-placement decision in `.ai-bridge/projects/center/decisions.md`.
- Recorded the documentation-governor audit in `.ai-bridge/projects/center/audits/repository-documentation-governor-20260629.md`.

## Completed In Current Slice

- Added a first runtime capability boundary for producer imports.
- Producer import packets now declare capability ids.
- Center import API routes read `.ai-bridge/capabilities/*.json` and reject unknown declared capability ids.
- Browser-local import applies the returned registry before mutating profile data.
- Import summaries now report blocked capability ids and unresolved evidence/source-event/recommendation refs.
- Review packet parsing now prefers explicit `approval_state` and `worker_gate` frontmatter over prose inference.
- Added all-producer smoke coverage that imports MS2, GitHub, Plane, Learn/Understand, Workers, review packets, and baseline prediction twice.
- Added workspace-scoped local-server JSON storage with browser-local fallback.
- Added profile export/delete actions in the Center UI.
- Added derived prediction outcome scoring for explicit prediction outcomes.
- Added read-only live GitHub and Plane producer paths behind explicit environment configuration.

## Verification

Passed for current slice:

```text
bun run check:center-boundary
bun run check:api-validation
bun --cwd apps/sim test lib/center/producer-import.test.ts lib/center/review-packets.test.ts lib/center/all-producer-smoke.test.ts lib/center/producers/ms2scheduler.test.ts lib/center/producers/github.test.ts lib/center/producers/plane.test.ts lib/center/producers/learn-understand.test.ts lib/center/producers/worker-lane.test.ts
bun --cwd apps/sim test lib/center/file-storage.test.ts lib/center/workspace-storage.test.ts lib/center/baseline-prediction.test.ts lib/center/local-spine.test.ts lib/center/all-producer-smoke.test.ts
bun --cwd apps/sim test lib/center/producers/github-live.test.ts lib/center/producers/plane-live.test.ts
```

## Remaining Gates

Center is documented as the implemented local system, not as production-complete.

Required implementation gaps remain:

- Production sync beyond local workspace JSON storage.
- Full authority/truth-impact/policy capability enforcement beyond unknown-id import gating.
- Real live GitHub/Plane dogfood import requires local credentials and source ids. Current local environment has no `CENTER_GITHUB_LIVE_REPOS`, `GITHUB_TOKEN`, `CENTER_GITHUB_TOKEN`, `CENTER_GITHUB_API_BASE_URL`, `CENTER_PLANE_API_KEY`, `PLANE_API_KEY`, `PLANE_OAUTH_TOKEN`, `CENTER_PLANE_WORKSPACE_SLUG`, `CENTER_PLANE_PROJECT_ID`, `CENTER_PLANE_PROJECT_IDS`, `CENTER_PLANE_BASE_URL`, or `CENTER_PLANE_APP_BASE_URL` configured.

These are documented in:

```text
apps/sim/docs/center/README.md
apps/sim/docs/center/capability-system.md
apps/sim/docs/center/operations-and-dogfood.md
```
