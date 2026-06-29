---
id: center-roadmap-v1
type: roadmap
project: center
status: approved
updated: 2026-06-29
links:
  - center-governing-spec-v1
  - current-plan
  - center-phase-6-implementation
  - center-phase-7-implementation
  - center-phase-8-implementation
  - center-phase-9-implementation
  - center-phase-10-implementation
  - center-phase-11-implementation
  - center-phase-12-implementation
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

Status: initial implementation complete.

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

Status: initial implementation complete.

Implementation:

- Center producer import packet and idempotent local import application.
- Local MS2Scheduler reader for `/Users/kyin/Projects/MS2Scheduler/app/data`.
- Local-development import API route.
- Center UI `Import MS2` action and review-needed proposal rendering.

Map:

- activity capture -> raw events / observations
- calibration -> feature projections
- recovery proposals -> recommendations/action proposals
- plan diffs/input hashes -> evidence

Acceptance:

- real study activity appears in Center
- recovery proposals are reviewable
- evidence links back to scheduler receipts

Verified:

- Current real MS2 plan `v001` imported as 6 evidence receipts, 1 raw event, 1 loop, 5 recommendations, and 5 action proposals.
- Browser smoke created a profile, imported MS2, persisted the records, and rendered recovery candidates in Review Needed.

## Phase 6 - Baseline Prediction

Status: initial implementation complete.

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

Verified:

- No-data profile shows insufficient data with confidence 0%.
- Three manual observations produce a baseline loop-drift summary with 45% confidence and feature refs.
- Prediction support stores feature projections, prediction summaries, and outcomes in the local spine.

## Phase 7 - Review Packets Inside Center

Status: initial implementation complete.

Build:

- review packet status
- round count
- approved/deadlocked state
- decision links
- worker gate

Acceptance:

- workers can identify approved execution packets

Verified:

- `.ai-bridge/projects/center/reviews/RP-20260628-002-v1.md` imports as `approved-for-execution`.
- Center UI persists and renders review packet status, approval state, round count, and worker gate.

## Phase 8 - GitHub Producer

Status: initial implementation complete.

Map commits, issues, PRs, reviews, and CI failures to events, observations, evidence, loops, and next actions.

Implementation:

- Local GitHub-shaped snapshot reader.
- GitHub producer import packet mapper.
- Local-development import API route.
- Center UI `Import GitHub` action and Engineering projection.
- Registered capability metadata for commits, issues, PRs, reviews, and CI runs.

Verified:

- Sample snapshot imports 5 records into 5 evidence, 5 raw events, 5 observations, and 1 blocked engineering loop.
- Center UI persists and renders GitHub next action, blocker state, and engineering observations.

## Phase 9 - Plane Producer

Status: initial implementation complete.

Map projects, cycles, modules, issues, comments, and statuses to Center loops/tasks/evidence.

Implementation:

- Local Plane-shaped snapshot reader.
- Plane producer import packet mapper.
- Local-development import API route.
- Center UI `Import Plane` action and Project State projection.
- Registered capability metadata for projects, cycles, modules, issues, comments, and status changes.

Verified:

- Sample snapshot imports 6 records into 6 evidence, 6 raw events, 6 observations, and 1 blocked project loop.
- Center UI persists and renders Plane next action, blocker state, and project observations.

## Phase 10 - Learn / Understand Producers

Status: initial implementation complete.

Learn emits learning gaps, practice tasks, and review evidence.

Understand emits system maps, dependency observations, and risk evidence.

Implementation:

- Local Learn/Understand-shaped snapshot reader.
- Learn and Understand producer import packet mapper.
- Local-development import API route.
- Center UI `Import Learn/Understand` action and Knowledge State projection.
- Registered capability metadata for learning gaps, practice tasks, review evidence, system maps, dependency observations, and risk evidence.

Verified:

- Sample snapshot imports 6 records into 6 evidence, 6 raw events, 6 observations, and 2 blocked loops.
- Center UI persists and renders learning and system-comprehension next actions, blocker state, and knowledge observations.

## Phase 11 - Worker / Hermes / Codex Lane

Status: initial implementation complete.

Workers emit run started, run completed, failure, diff, test result, artifact, and review needed.

Implementation:

- Local worker-lane snapshot reader.
- Worker/Hermes/Codex producer import packet mapper.
- Local-development import API route.
- Center UI `Import Workers` action and Agent Work projection.
- Registered capability metadata for run starts, completions, failures, diffs, tests, artifacts, and review-needed records.

Acceptance:

- agent work is not invisible
- evidence attaches to loops/actions

Verified:

- Sample snapshot imports 7 records into 7 evidence, 7 raw events, 7 observations, 2 blocked loops, 1 recommendation, and 1 action proposal.
- Center UI persists and renders agent observations, review proposal state, and worker failure/next-action state.

## Phase 12 - `.app` Packaging

Status: initial implementation complete.

Only after spine and first producers work.

Implementation:

- Repo-local macOS app bundle generator at `scripts/package-center-app.ts`.
- Root script `bun run package:center-app`.
- Generated local `Center.app` launcher under `.ai-bridge/artifacts/center-app/`.
- Launcher starts `CENTER_DEV=1 NEXT_TELEMETRY_DISABLED=1 bun run dev:center` and opens `/workspace/local-test/center`.

Acceptance:

- Center.app starts local service
- profile data remains private
- packaging does not constrain architecture

Verified:

- Generated `Center.app` has a valid `Info.plist` and executable launcher.
- No-open launcher smoke exited 0 against the local Center service.
- Center route returned `HTTP/1.1 200 OK`.
