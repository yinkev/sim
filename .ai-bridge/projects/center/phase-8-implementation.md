---
id: center-phase-8-implementation
type: implementation-record
project: center
status: implemented
updated: 2026-06-29
links:
  - center-roadmap-v1
  - github-producer-index
  - capability-metadata-contract-v1
  - emit.github_commit
  - emit.github_issue
  - emit.github_pull_request
  - emit.github_pr_review
  - emit.github_ci_run
  - current-plan
---

# Phase 8 Implementation - GitHub Producer

## Decision

GitHub enters Center through the producer import packet, not through workflow tools, provider SDK registries, connector registries, or the workflow editor hot path.

## Implemented files

```text
apps/sim/lib/center/producers/github.ts
apps/sim/lib/center/producers/github-files.ts
apps/sim/app/api/center/github/import/route.ts
apps/sim/lib/api/contracts/center.ts
apps/sim/app/center/[workspaceId]/center-surface.tsx
.ai-bridge/capabilities/emit.github_commit.json
.ai-bridge/capabilities/emit.github_issue.json
.ai-bridge/capabilities/emit.github_pull_request.json
.ai-bridge/capabilities/emit.github_pr_review.json
.ai-bridge/capabilities/emit.github_ci_run.json
.ai-bridge/projects/github-producer/index.md
.ai-bridge/projects/github-producer/sample-events.json
```

## Mapping

```text
commit -> RawEvent github.commit -> Observation engineering.commit_landed -> Evidence diff
issue -> RawEvent github.issue.updated -> Observation engineering.issue_open/closed -> Evidence source
pull_request -> RawEvent github.pull_request.updated -> Observation engineering.pr_open/closed -> Evidence source
review -> RawEvent github.pull_request.reviewed -> Observation engineering.review_* -> Evidence source
ci_run -> RawEvent github.ci.failed/completed -> Observation engineering.ci_failed/completed -> Evidence test
repo projection -> Center Loop with next action and blocker state
```

## Verified source

```text
.ai-bridge/projects/github-producer/sample-events.json
```

Live import expectation:

```text
records: 5
evidence: 5
raw events: 5
observations: 5
loops: 1
blockedBy: changes requested + failing CI
nextAction: inspect failing CI
```

## Verification

```text
bun --cwd apps/sim test lib/center/producers/github.test.ts lib/center/producer-import.test.ts lib/center/producers/ms2scheduler.test.ts
bun --cwd apps/sim type-check
bun run check:api-validation
bun run check:center-boundary
bun run check:boundaries
git diff --check
```

Route smoke:

```text
GET /api/center/github/import
recordCount: 5
evidence: 5
rawEvents: 5
observations: 5
loops: 1
loop.status: blocked
loop.nextAction: Inspect failing CI run Center Checks in kyin/sim
```

Browser smoke:

```text
/workspace/local-test/center
create profile
click Import GitHub
localStorage contains 5 evidence, 5 raw events, 5 observations, and 1 blocked loop
Next Actions renders Inspect failing CI run Center Checks in kyin/sim
Engineering / Blocked Loops render GitHub kyin/sim
```
