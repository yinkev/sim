# Center Operations And Dogfood

## Purpose

This document explains how to run, package, smoke, and debug Center locally.

Repository path: `apps/sim/docs/center/operations-and-dogfood.md`  
Owning project: Center  
Owner: Sim maintainers  
Current status: Local development and packaging work; live dogfooding is gated by review packets.

## Read First

- `apps/sim/docs/center/architecture.md`
- `apps/sim/docs/center/producer-model.md`
- `apps/sim/docs/LOCAL_DEV_PROFILES.md`
- `.ai-bridge/projects/center/reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md`
- `.ai-bridge/projects/center/reviews/RP-20260629-004-pre-dogfood-overnight-hardening.md`
- `apps/sim/docs/center/morning-dogfood-runbook.md`

## Daily Dev Command

Use:

```text
bun run dev:center
```

This runs `apps/sim` only on port `6888` with:

```text
CENTER_DEV=1
NODE_OPTIONS='--max-old-space-size=4096'
```

Open:

```text
http://localhost:6888/workspace/local-test/center
```

`apps/sim/proxy.ts` rewrites that workspace URL to the standalone route:

```text
/center/local-test
```

## Other Dev Commands

See `apps/sim/docs/LOCAL_DEV_PROFILES.md` for the full local profile matrix.

Common commands:

```text
bun run dev:lite
bun run dev:center
bun run dev:full:capped
bun run dev:full
```

## Local Import Buttons

The Center UI currently exposes these explicit import actions:

- Import MS2.
- Import GitHub.
- Import Plane.
- Import Learn/Understand.
- Import Reviews.
- Import Workers.

These actions call local-development routes under:

```text
apps/sim/app/api/center/
```

They persist imported records into the selected workspace-backed local profile. If the workspace storage route is unavailable, Center falls back to workspace-scoped browser-local storage.

The Center UI also exposes explicit profile actions:

- Export selected profile.
- Delete selected profile.

## Local Workspace Storage

Default path:

```text
.ai-bridge/artifacts/center-storage/<workspaceId>.json
```

Override:

```text
CENTER_WORKSPACE_STORAGE_DIR=/path/to/storage
```

Route and adapters:

```text
apps/sim/app/api/center/storage/[workspaceId]/route.ts
apps/sim/lib/center/file-storage.ts
apps/sim/lib/center/workspace-storage.ts
```

## Local Source Overrides

MS2Scheduler:

```text
MS2SCHEDULER_DATA_DIR=/path/to/MS2Scheduler/app/data
```

GitHub:

```text
CENTER_GITHUB_PRODUCER_FILE=/path/to/events.json
CENTER_GITHUB_LIVE_REPOS=owner/repo,other/repo
CENTER_GITHUB_TOKEN=/redacted/token
GITHUB_TOKEN=/redacted/token
CENTER_GITHUB_API_BASE_URL=https://api.github.com
```

Plane:

```text
CENTER_PLANE_PRODUCER_FILE=/path/to/events.json
CENTER_PLANE_WORKSPACE_SLUG=my-workspace
CENTER_PLANE_PROJECT_ID=project-uuid
CENTER_PLANE_PROJECT_IDS=project-uuid,other-project-uuid
CENTER_PLANE_API_KEY=/redacted/token
PLANE_API_KEY=/redacted/token
PLANE_OAUTH_TOKEN=/redacted/token
CENTER_PLANE_BASE_URL=https://api.plane.so
CENTER_PLANE_APP_BASE_URL=https://app.plane.so
```

Learn/Understand:

```text
CENTER_LEARN_UNDERSTAND_PRODUCER_FILE=/path/to/events.json
```

Worker Lane:

```text
CENTER_WORKER_LANE_PRODUCER_FILE=/path/to/events.json
```

Review Packets:

```text
CENTER_REVIEW_PACKET_DIR=/path/to/reviews
```

Default local sources are documented in `apps/sim/docs/center/producer-model.md`.

## Packaging

Generate the local app bundle:

```text
bun run package:center-app
```

Default output:

```text
.ai-bridge/artifacts/center-app/Center.app
```

The generated launcher starts `bun run dev:center`, waits for the Center URL, and opens the browser unless `CENTER_APP_OPEN=0`.

Useful packaging smoke:

```text
CENTER_APP_OPEN=0 CENTER_APP_WAIT_SECONDS=5 .ai-bridge/artifacts/center-app/Center.app/Contents/MacOS/Center
plutil -lint .ai-bridge/artifacts/center-app/Center.app/Contents/Info.plist
test -x .ai-bridge/artifacts/center-app/Center.app/Contents/MacOS/Center
```

Logs:

```text
~/Library/Logs/Center.app.log
```

## Verification

Smallest relevant checks for Center documentation and runtime boundaries:

```text
bun run check:center-boundary
bun run check:api-validation
bun --cwd apps/sim test lib/center/local-spine.test.ts lib/center/producer-import.test.ts lib/center/baseline-prediction.test.ts lib/center/review-packets.test.ts lib/center/all-producer-smoke.test.ts
```

Add producer-specific tests when changing a producer:

```text
bun --cwd apps/sim test lib/center/producers/ms2scheduler.test.ts
bun --cwd apps/sim test lib/center/producers/github.test.ts
bun --cwd apps/sim test lib/center/producers/github-live.test.ts
bun --cwd apps/sim test lib/center/producers/plane.test.ts
bun --cwd apps/sim test lib/center/producers/plane-live.test.ts
bun --cwd apps/sim test lib/center/producers/learn-understand.test.ts
bun --cwd apps/sim test lib/center/producers/worker-lane.test.ts
```

## Dogfood Gate

Do not treat Center as live-dogfood ready until these review packets are resolved or explicitly waived:

```text
.ai-bridge/projects/center/reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md
.ai-bridge/projects/center/reviews/RP-20260629-004-pre-dogfood-overnight-hardening.md
```

Current blockers:

- Full authority/truth-impact/policy capability enforcement is not implemented beyond registered-id import gating.
- Production sync beyond local workspace JSON storage is not implemented.
- Real live GitHub/Plane dogfood import requires local credential/source-id environment variables. Current checked local env has none configured.

First-use runbook:

```text
apps/sim/docs/center/morning-dogfood-runbook.md
```

## Manual Smoke Flow

Use this sequence for local smoke, not as a substitute for review-packet approval:

1. Run `bun run dev:center`.
2. Open `http://localhost:6888/workspace/local-test/center`.
3. Create a profile.
4. Capture one event.
5. Create one loop with a next action.
6. Add one evidence record with a local path or URI.
7. Record one decision with reason and consequence.
8. Import reviews.
9. Import at least one producer source relevant to the task.
10. Verify panels update without loading workflow/block/editor dependencies.

Minimum expected evidence:

- Center route returns `HTTP 200`.
- Browser-local profile persists after refresh.
- `bun run check:center-boundary` passes.
- Import summary reports added/skipped counts.
- `apps/sim/lib/center/all-producer-smoke.test.ts` proves current producer imports have zero unresolved refs and are idempotent.
- No unexpected telemetry, workflow editor, block registry, Monaco, or Mermaid imports appear in Center route analysis.

## Troubleshooting

Center route 404:

- Confirm `bun run dev:center` is running from the repo root or `apps/sim`.
- Confirm port `6888`.
- Confirm the URL is `/workspace/local-test/center`.

Import button returns 403:

- Confirm `CENTER_DEV=1` or non-production dev mode.

MS2 import returns empty packet:

- Confirm `MS2SCHEDULER_DATA_DIR` or `/Users/kyin/Projects/MS2Scheduler/app/data`.
- Confirm the data dir contains `current`, `plans/*.json`, and optional `activity.jsonl`, `completion.jsonl`, `calibration_state.json`.

GitHub, Plane, Learn/Understand, or Worker import fails:

- Confirm the default `.ai-bridge/projects/<producer>/sample-events.json` file exists or set the matching `CENTER_*_PRODUCER_FILE` override.
- For GitHub live mode, confirm `CENTER_GITHUB_LIVE_REPOS` is set and the optional token can read the configured repos.
- For Plane live mode, confirm `CENTER_PLANE_WORKSPACE_SLUG`, `CENTER_PLANE_PROJECT_ID` or `CENTER_PLANE_PROJECT_IDS`, and a Plane token variable are set.

Review import returns no records:

- Confirm `.ai-bridge/projects/center/reviews/` contains Markdown review packets with frontmatter.

High memory or slow compile:

- Use `bun run dev:center`.
- Re-run `bun run check:center-boundary`.
- Inspect `apps/sim/docs/DEV_COMPILE_PERF.md` and `apps/sim/docs/LOCAL_DEV_PROFILES.md`.

## Related Documents

- `apps/sim/docs/center/architecture.md`
- `apps/sim/docs/center/producer-model.md`
- `apps/sim/docs/center/morning-dogfood-runbook.md`
- `apps/sim/docs/LOCAL_DEV_PROFILES.md`
- `apps/sim/docs/DEV_COMPILE_PERF.md`
- `.ai-bridge/projects/center/phase-12-implementation.md`
