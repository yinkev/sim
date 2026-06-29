---
id: center-phase-7-implementation
type: implementation-record
project: center
status: implemented
updated: 2026-06-29
links:
  - center-roadmap-v1
  - center-interfaces
  - current-plan
  - RP-20260628-002
---

# Phase 7 Implementation - Review Packets

## Decision

Review packets are Center-visible governance records. Center imports `.ai-bridge` review packet files through an explicit local route and maps status/verdict into a worker gate.

## Implemented files

```text
apps/sim/lib/center/review-packet-files.ts
apps/sim/lib/center/review-packets.ts
apps/sim/app/api/center/review-packets/import/route.ts
apps/sim/lib/api/contracts/center.ts
apps/sim/lib/center/types.ts
apps/sim/lib/center/local-spine.ts
apps/sim/app/center/[workspaceId]/center-surface.tsx
```

## Mapping

```text
.ai-bridge review packet frontmatter -> CenterReviewPacket
.ai-bridge review packet file path -> CenterEvidence.kind = source
Verdict APPROVE WITH REQUIRED CHANGES -> approvalState approved-with-required-changes
approved / approved-with-required-changes -> workerGate approved-for-execution
rejected / deadlocked -> workerGate blocked
draft / reviewing / in-review -> workerGate review-required
```

## Verified source

```text
.ai-bridge/projects/center/reviews/RP-20260628-002-v1.md
```

Live import:

```text
packetId: RP-20260628-002
status: converged
approvalState: approved-with-required-changes
workerGate: approved-for-execution
round: 2
maxRounds: 20
```

## Verification

```text
bun --cwd apps/sim test lib/center/local-spine.test.ts lib/center/baseline-prediction.test.ts lib/center/producer-import.test.ts lib/center/producers/ms2scheduler.test.ts lib/center/review-packets.test.ts
bun --cwd apps/sim type-check
bun run check:api-validation
bun run check:center-boundary
bun run check:boundaries
git diff --check
```

Browser smoke:

```text
/workspace/local-test/center
create profile
click Import Reviews
localStorage contains 1 review packet and 1 evidence source
Review Packets renders approved-for-execution and approved-with-required-changes
```
