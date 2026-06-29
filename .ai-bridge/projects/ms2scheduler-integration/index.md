---
id: ms2scheduler-integration-index
type: index
project: ms2scheduler-integration
status: active
updated: 2026-06-28
links:
  - ai-bridge-projects-index
  - ms2scheduler-integration-interfaces
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
MS2Scheduler -> observations / recovery proposals / evidence receipts -> Center
```

MS2Scheduler remains a module/producer. Center remains the cross-domain operating surface.

## Read first

- `interfaces.md`
- `.ai-bridge/projects/daily-cockpit/research/existing-assets-map.md`
- `/Users/kyin/Projects/MS2Scheduler/docs/VISION.md`
- `/Users/kyin/Projects/MS2Scheduler/docs/wiki/Architecture.md`
- `/Users/kyin/Projects/MS2Scheduler/docs/wiki/Surfaces.md`
- `/Users/kyin/Projects/MS2Scheduler/engine/README.md`
