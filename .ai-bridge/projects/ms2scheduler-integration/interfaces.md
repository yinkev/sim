---
id: ms2scheduler-integration-interfaces
type: interface
project: ms2scheduler-integration
status: active
updated: 2026-06-29
links:
  - ms2scheduler-integration-index
  - center-interfaces
---

# MS2Scheduler Integration Interfaces

## Producer contract

MS2Scheduler feeds Center through normalized observations, evidence receipts, and recovery proposals.

Center should not depend on MS2Scheduler internals directly.

## Emits: study observations

Map MS2Scheduler activity/capture rows to `CenterObservation`.

Existing source:

```text
/Users/kyin/Projects/MS2Scheduler/app/capture.py
```

Existing events:

```text
start | pause | resume | end
```

Mapped form:

```ts
CenterObservation {
  producer: 'ms2scheduler'
  producerType: 'scheduler'
  subjectType: 'session' | 'task'
  eventType: 'study.start' | 'study.pause' | 'study.resume' | 'study.end'
}
```

## Emits: calibration observations

Map MS2Scheduler actual-minute calibration to Center observations.

Existing source:

```text
/Users/kyin/Projects/MS2Scheduler/app/calibrate.py
```

Mapped form:

```ts
CenterObservation {
  producer: 'ms2scheduler'
  producerType: 'scheduler'
  subjectType: 'task'
  eventType: 'study.estimate_calibrated'
}
```

## Emits: recovery proposals

Map MS2Scheduler recovery/replan proposals into `CenterRecommendation` plus `CenterActionProposal`.

Existing sources:

```text
/Users/kyin/Projects/MS2Scheduler/engine/resilience.py
/Users/kyin/Projects/MS2Scheduler/app/recovery.py
```

Mapped form:

```ts
CenterRecommendation {
  producer: 'ms2scheduler'
  targetType: 'study-plan'
  reason: '<calm recovery reason>'
  evidenceRefs: [...]
  status: 'proposed'
}

CenterActionProposal {
  producer: 'ms2scheduler'
  actionType: 'ms2scheduler.review_recovery_candidate'
  targetType: 'study-plan'
  evidenceRefs: [...]
  status: 'proposed'
}
```

## Emits: evidence receipts

Map plan diffs, input hashes, flow certificates, and completion receipts into `CenterEvidence`.

Existing sources:

```text
/Users/kyin/Projects/MS2Scheduler/engine/README.md
/Users/kyin/Projects/MS2Scheduler/app/evidence.py
```

Mapped forms:

```ts
CenterEvidence.kind = 'diff' | 'test' | 'source' | 'run-output' | 'note'
```

## Imports from Center

Initial integration should not require Center to drive MS2Scheduler.

Later Center may send:

- approved recovery proposal
- profile identity
- external evidence references
- display preferences

## Boundary

MS2Scheduler owns deterministic study planning.

Center owns cross-domain operating view, profile isolation, multi-producer observation store, and visual surface.
