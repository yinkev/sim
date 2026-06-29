---
id: ms2scheduler-integration-index
type: index
project: ms2scheduler-integration
status: active
updated: 2026-06-29
links:
  - ai-bridge-projects-index
  - ms2scheduler-integration-interfaces
  - ms2scheduler-phase-5-implementation
  - daily-cockpit-existing-assets-map
---

# MS2Scheduler Integration Project

## Objective

Reuse MS2Scheduler as the first mature producer/module feeding Center.

## Call

Do not rebuild scheduler concepts inside Center.

MS2Scheduler already has deterministic planning, activity capture, calibration, recovery, receipts, trust governance, tests, ADRs, and local-first design.

## Source workspace

```text
/Users/kyin/Projects/MS2Scheduler
```

## Center relationship

```text
MS2Scheduler -> raw events / observations / recommendations / action proposals / evidence receipts -> Center
```

MS2Scheduler remains a module/producer. Center remains the cross-domain operating surface.

## Initial implementation

The first adapter is local and read-only against MS2Scheduler data files. Center does not execute scheduler code during discovery/import.

Implemented paths:

```text
apps/sim/lib/center/producers/ms2scheduler.ts
apps/sim/app/api/center/ms2scheduler/import/route.ts
apps/sim/lib/center/producer-import.ts
apps/sim/lib/api/contracts/center.ts
```

Live source:

```text
/Users/kyin/Projects/MS2Scheduler/app/data
```

Current verified import:

```text
currentVersion: v001
evidence: 6
rawEvents: 1
observations: 0
loops: 1
recommendations: 5
actionProposals: 5
```

## Read first

- `interfaces.md`
- `phase-5-implementation.md`
- `.ai-bridge/projects/daily-cockpit/research/existing-assets-map.md`
- `/Users/kyin/Projects/MS2Scheduler/docs/VISION.md`
- `/Users/kyin/Projects/MS2Scheduler/docs/wiki/Architecture.md`
- `/Users/kyin/Projects/MS2Scheduler/docs/wiki/Surfaces.md`
- `/Users/kyin/Projects/MS2Scheduler/engine/README.md`
