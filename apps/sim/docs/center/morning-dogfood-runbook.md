# Center Morning Dogfood Runbook

## Purpose

This is the short first-use runbook for a local Center dogfood session.

Repository path: `apps/sim/docs/center/morning-dogfood-runbook.md`  
Owning project: Center  
Owner: Sim maintainers  
Current status: Local dogfood guide; GitHub/Plane live imports are credential-gated and autonomous producer execution remains policy-gated.

## Prerequisites

Read:

```text
apps/sim/docs/center/operations-and-dogfood.md
apps/sim/fixtures/center/review-packets/center-capability-review.md
```

Required local command:

```text
bun run dev:center
```

Open:

```text
http://localhost:6888/workspace/local-test/center
```

## First Clicks

1. Create or select a local profile.
2. Click `Import Reviews`.
3. Click `Import MS2`.
4. Click `Import GitHub`, `Import Plane`, `Import Learn/Understand`, and `Import Workers` only if the local sample files are relevant to the session.
5. Add one manual event describing the current session goal.
6. Add one loop for the day if Center does not already show a useful active loop.

## Inspect

Check these panels:

- `Today`: confirms current activity capture.
- `Next Actions`: shows what Center thinks should happen next.
- `Blocked Loops`: shows blockers that need decisions.
- `Review Needed`: shows proposed actions before execution.
- `Review Packets`: shows governance gate state.
- `Prediction Summary`: must show insufficient-data or baseline language, not fake precision.
- `Evidence`: every important item should have a receipt, source, or path.

## Counts As Broken

Treat the session as broken if:

- Center route does not load.
- Profile data disappears after refresh.
- Import buttons fail without a visible error.
- Repeated imports create obvious duplicate loops or duplicate evidence.
- Action proposals have no evidence or reason.
- Review packets import without worker gate state.
- Prediction presents calibrated certainty without enough data.
- Center route pulls workflow/block/editor dependencies.

## Report Back

Record:

```text
profile name
imports clicked
import summaries
visible blockers
review packets shown
next actions shown
broken behavior
missing evidence
commands run
```

Attach evidence paths or screenshots when useful.

## Verification After Session

Run:

```text
bun run check:center-boundary
```

If producer code changed, run the matching targeted tests from:

```text
apps/sim/docs/center/operations-and-dogfood.md
```

## Related Documents

- `apps/sim/docs/center/operations-and-dogfood.md`
- `apps/sim/docs/center/producer-model.md`
- `apps/sim/docs/center/capability-system.md`
