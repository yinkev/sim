---
id: center-roadmap-v1
type: roadmap
project: center
status: approved
updated: 2026-06-28
links:
  - center-governing-spec-v1
  - current-plan
---

# Center Implementation Roadmap

## Canonical sequence

0. Sim CPU/RAM stabilization
1. Ontology/schema freeze
2. Capability contract
3. Center local spine
4. Lightweight Center surface
5. MS2Scheduler adapter
6. Baseline prediction
7. Review packet UI
8. GitHub producer
9. Plane producer
10. Learn/Understand producers
11. Worker lane
12. `.app` packaging

## Phase 0 - Sim CPU/RAM Stabilization

Objective: make local development usable.

Acceptance:

- Kevin has a low-resource daily dev command.
- Center development does not load workflow/block registry hot path.
- No product behavior regressions.

## Phase 1 - Ontology / Schema Freeze

Objective: encode final primitives.

Acceptance:

- Two implementers can build compatible storage/adapter code.
- Schema changes after this phase supersede versions instead of silently mutating them.

## Phase 2 - Capability Contract

Objective: define capability metadata.

Acceptance:

- MS2Scheduler, GitHub, Plane, and workers can all be described without bespoke architecture.

## Phase 3 - Center Local Spine

Status: initial pure local substrate implemented.

Build:

- profile creation
- raw event append
- observation derivation
- evidence attachment
- loop creation
- decision recording
- export/delete profile

Acceptance:

- manual capture works
- data is profile-isolated
- export/delete works
- no telemetry

## Phase 4 - Lightweight Center Surface

Status: initial implementation in progress.

Route:

```text
/workspace/[workspaceId]/center
```

Implementation path:

```text
apps/sim/app/center/[workspaceId]
```

Shows:

- Today
- active loops
- blocked loops
- recent observations
- evidence
- next actions
- prediction summaries
- review-needed decisions

Acceptance:

- route loads without heavy workflow imports
- not graph-only
- light editorial design

## Phase 5 - MS2Scheduler Adapter

Map:

- activity capture -> raw events / observations
- calibration -> feature projections
- recovery proposals -> recommendations/action proposals
- plan diffs/input hashes -> evidence

Acceptance:

- real study activity appears in Center
- recovery proposals are reviewable
- evidence links back to scheduler receipts

## Phase 6 - Baseline Prediction

Build:

- insufficient-data state
- rolling baselines
- driver summaries
- confidence
- feature refs
- outcome tracking

Acceptance:

- no fake precision
- predictions can be evaluated later

## Phase 7 - Review Packets Inside Center

Build:

- review packet status
- round count
- approved/deadlocked state
- decision links
- worker gate

Acceptance:

- workers can identify approved execution packets

## Phase 8 - GitHub Producer

Map commits, issues, PRs, reviews, and CI failures to events, observations, evidence, loops, and next actions.

## Phase 9 - Plane Producer

Map projects, cycles, modules, issues, comments, and statuses to Center loops/tasks/evidence.

## Phase 10 - Learn / Understand Producers

Learn emits learning gaps, practice tasks, and review evidence.

Understand emits system maps, dependency observations, and risk evidence.

## Phase 11 - Worker / Hermes / Codex Lane

Workers emit run started, run completed, failure, diff, test result, artifact, and review needed.

Acceptance:

- agent work is not invisible
- evidence attaches to loops/actions

## Phase 12 - `.app` Packaging

Only after spine and first producers work.

Acceptance:

- Center.app starts local service
- profile data remains private
- packaging does not constrain architecture
