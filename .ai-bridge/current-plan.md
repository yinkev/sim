# Current Plan — Center Roadmap Complete

Status: complete.

Governing decision: Center / Sim / MS2Scheduler architecture is approved with required changes. Those required changes are now execution gates:

1. Save the execution authority model.
2. Save the ontology freeze.
3. Save the capability metadata contract.
4. Keep Phase 0 as Sim CPU/RAM stabilization.
5. Do not start Center UI until Phase 0 is handled or explicitly waived.

## Phase 0 result

Handled. The repo now has low-resource dev commands, a documented process/import map, a Turbopack root fix, lazy workflow registry loads in workspace providers, a standalone Center route served through a `/workspace/[workspaceId]/center` proxy rewrite, proxy-level Center auth that avoids the full auth/billing/workflow graph in the Center route, and a Center route import-boundary check.

Evidence:

- `bun run dev:center` starts only `apps/sim` on port 6888.
- Clean `/workspace/local-test/center` smoke returned `HTTP/1.1 200 OK` and compiled `/center/[workspaceId]` in `6.5s` total / `5.9s` Next compile.
- Browser smoke created a profile, loop, and event using system Chrome at `/workspace/local-test/center`; the route stayed on the public workspace URL.
- Center browser smoke did not request or compile `/api/auth/get-session`; Center auth stayed in `proxy.ts`.
- Clean Center dev memory snapshots held at `rssMB: 2433` after one and two minutes.
- Parsed Center server route bundle had no `apps_sim_tools`, `apps_sim_blocks`, `apps_sim_stores`, `apps_sim_triggers`, `apps_sim_lib_workflows`, `apps_sim_lib_auth`, `apps_sim_lib_billing`, or `apps_sim_lib_webhooks` entries.
- Parsed Center page client entry had no tools, blocks, stores, workflows, auth, Monaco, or mermaid chunks.
- `bun run check:center-boundary` passed.
- `bun run check:api-validation` passed.
- `bun run check:boundaries` passed.
- `bun --cwd apps/sim type-check` passed.
- `bun --cwd apps/sim test lib/center/local-spine.test.ts` passed.

## Phase 4 result

Handled. Center now has a lightweight local operating surface at `/workspace/[workspaceId]/center`, implemented through the standalone `apps/sim/app/center/[workspaceId]` route.

Evidence:

- Manual browser smoke created a profile, loop, and event.
- Center route persisted local spine data in browser-local storage.
- Center route bundle stayed clear of workflow, block, store, auth, provider, Monaco, and mermaid imports.
- `bun run check:center-boundary` passed.

## Phase 5 result

Handled. MS2Scheduler now feeds Center through a typed producer import packet and explicit local import action.

Implemented:

- `apps/sim/lib/center/producer-import.ts`
- `apps/sim/lib/center/producers/ms2scheduler.ts`
- `apps/sim/app/api/center/ms2scheduler/import/route.ts`
- `apps/sim/lib/api/contracts/center.ts`
- Center UI import button and review-needed proposal projection

Evidence:

- Real source: `/Users/kyin/Projects/MS2Scheduler/app/data`
- Current MS2 plan: `v001`
- Import route produced 6 evidence receipts, 1 raw current-plan event, 1 study loop, 5 recovery recommendations, and 5 action proposals.
- Browser smoke created a Center profile, clicked `Import MS2`, persisted imported records, and rendered recovery candidates in Review Needed.
- Targeted built Center page/API chunks had no workflow, block, store, auth, provider, Monaco, or mermaid imports.
- `bun --cwd apps/sim test lib/center/local-spine.test.ts lib/center/producer-import.test.ts lib/center/producers/ms2scheduler.test.ts` passed.
- `bun --cwd apps/sim type-check` passed.
- `bun run check:api-validation` passed.
- `bun run check:center-boundary` passed.
- `bun run check:boundaries` passed.

## Phase 6 result

Handled. Center now derives an honest baseline prediction summary from local Center data without calling a model or reporting calibrated probability.

Implemented:

- `apps/sim/lib/center/baseline-prediction.ts`
- `apps/sim/lib/center/baseline-prediction.test.ts`
- Center local spine support for `FeatureProjection`, `PredictionSummary`, and `Outcome`
- Center UI projection for data sufficiency, confidence, drivers, feature refs, and baseline risk score

Evidence:

- No-data Center profile shows `Insufficient data` with `confidence 0%`.
- Three manual captures produce three raw events and three observations, then the UI shows `Baseline loop drift`, `confidence 45%`, and 8 feature refs.
- Targeted built Center page/API artifacts had no workflow, block, store, auth, provider, Monaco, or mermaid imports.
- `bun --cwd apps/sim test lib/center/local-spine.test.ts lib/center/baseline-prediction.test.ts lib/center/producer-import.test.ts lib/center/producers/ms2scheduler.test.ts` passed.
- `bun --cwd apps/sim type-check` passed.
- `bun run check:api-validation` passed.
- `bun run check:center-boundary` passed.
- `bun run check:boundaries` passed.

## Phase 7 result

Handled. Center now imports `.ai-bridge` review packets through an explicit local route and displays worker gate status.

Implemented:

- `apps/sim/lib/center/review-packet-files.ts`
- `apps/sim/lib/center/review-packets.ts`
- `apps/sim/app/api/center/review-packets/import/route.ts`
- Center local spine support for `ReviewPacket`
- Center UI `Import Reviews` action and Review Packets panel

Evidence:

- Real source: `.ai-bridge/projects/center/reviews/RP-20260628-002-v1.md`
- Import route produced 1 record: `RP-20260628-002`, `converged`, `approved-with-required-changes`, `approved-for-execution`, round `2/20`.
- Browser smoke created a profile, clicked `Import Reviews`, persisted 1 review packet and 1 evidence source, and rendered `approved-for-execution`.
- Targeted built Center page/API artifacts had no workflow, block, store, auth, provider, Monaco, or mermaid imports.
- `bun --cwd apps/sim test lib/center/local-spine.test.ts lib/center/baseline-prediction.test.ts lib/center/producer-import.test.ts lib/center/producers/ms2scheduler.test.ts lib/center/review-packets.test.ts` passed.
- `bun --cwd apps/sim type-check` passed.
- `bun run check:api-validation` passed.
- `bun run check:center-boundary` passed.
- `bun run check:boundaries` passed.

## Phase 8 result

Handled. GitHub-shaped engineering state now feeds Center through a typed producer import packet and explicit local import action.

Implemented:

- `apps/sim/lib/center/producers/github.ts`
- `apps/sim/lib/center/producers/github-files.ts`
- `apps/sim/app/api/center/github/import/route.ts`
- `apps/sim/lib/api/contracts/center.ts`
- Center UI `Import GitHub` action and Engineering projection
- `.ai-bridge/projects/github-producer/sample-events.json`
- `.ai-bridge/capabilities/emit.github_commit.json`
- `.ai-bridge/capabilities/emit.github_issue.json`
- `.ai-bridge/capabilities/emit.github_pull_request.json`
- `.ai-bridge/capabilities/emit.github_pr_review.json`
- `.ai-bridge/capabilities/emit.github_ci_run.json`

Evidence:

- Import route produced 5 evidence records, 5 raw events, 5 observations, and 1 blocked engineering loop from 5 sample GitHub records.
- Browser smoke created a profile, clicked `Import GitHub`, persisted the imported records, and rendered `Inspect failing CI run Center Checks in kyin/sim`.
- Targeted Center boundary checks still passed.
- `bun --cwd apps/sim test lib/center/producers/github.test.ts lib/center/producer-import.test.ts lib/center/producers/ms2scheduler.test.ts` passed.
- `bun --cwd apps/sim type-check` passed.
- `bun run check:api-validation` passed.
- `bun run check:center-boundary` passed.
- `bun run check:boundaries` passed.

## Phase 9 result

Handled. Plane-shaped project/task state now feeds Center through a typed producer import packet and explicit local import action.

Implemented:

- `apps/sim/lib/center/producers/plane.ts`
- `apps/sim/lib/center/producers/plane-files.ts`
- `apps/sim/app/api/center/plane/import/route.ts`
- `apps/sim/lib/api/contracts/center.ts`
- Center UI `Import Plane` action and Project State projection
- `.ai-bridge/projects/plane-producer/sample-events.json`
- `.ai-bridge/capabilities/emit.plane_project.json`
- `.ai-bridge/capabilities/emit.plane_cycle.json`
- `.ai-bridge/capabilities/emit.plane_module.json`
- `.ai-bridge/capabilities/emit.plane_issue.json`
- `.ai-bridge/capabilities/emit.plane_comment.json`
- `.ai-bridge/capabilities/emit.plane_status.json`

Evidence:

- Import route produced 6 evidence records, 6 raw events, 6 observations, and 1 blocked project loop from 6 sample Plane records.
- Browser smoke created a profile, clicked `Import Plane`, persisted the imported records, and rendered `Unblock Plane issue CENTER-101: Plane sync needs reviewable blocker state`.
- Targeted Center boundary checks still passed.
- `bun --cwd apps/sim test lib/center/producers/plane.test.ts lib/center/producers/github.test.ts lib/center/producer-import.test.ts` passed.
- `bun --cwd apps/sim type-check` passed.
- `bun run check:api-validation` passed.
- `bun run check:center-boundary` passed.
- `bun run check:boundaries` passed.

## Phase 10 result

Handled. Learn-shaped and Understand-shaped knowledge state now feeds Center through typed producer import packets and an explicit local import action.

Implemented:

- `apps/sim/lib/center/producers/learn-understand.ts`
- `apps/sim/lib/center/producers/learn-understand-files.ts`
- `apps/sim/app/api/center/learn-understand/import/route.ts`
- `apps/sim/lib/api/contracts/center.ts`
- Center UI `Import Learn/Understand` action and Knowledge State projection
- `.ai-bridge/projects/learn-understand-producers/sample-events.json`
- `.ai-bridge/capabilities/emit.learn_learning_gap.json`
- `.ai-bridge/capabilities/emit.learn_practice_task.json`
- `.ai-bridge/capabilities/emit.learn_review_evidence.json`
- `.ai-bridge/capabilities/emit.understand_system_map.json`
- `.ai-bridge/capabilities/emit.understand_dependency_observation.json`
- `.ai-bridge/capabilities/emit.understand_risk_evidence.json`

Evidence:

- Import route produced 6 evidence records, 6 raw events, 6 observations, and 2 blocked loops from 6 sample Learn/Understand records.
- Browser smoke created a profile, clicked `Import Learn/Understand`, persisted the imported records, and rendered both knowledge next actions.
- Targeted Center boundary checks still passed.
- `bun --cwd apps/sim test lib/center/producers/learn-understand.test.ts lib/center/producers/plane.test.ts lib/center/producer-import.test.ts` passed.
- `bun --cwd apps/sim type-check` passed.
- `bun run check:api-validation` passed.
- `bun run check:center-boundary` passed.
- `bun run check:boundaries` passed.

## Phase 11 result

Handled. Worker, Hermes, and Codex-shaped execution state now feeds Center through a typed worker-lane producer import packet and explicit local import action.

Implemented:

- `apps/sim/lib/center/producers/worker-lane.ts`
- `apps/sim/lib/center/producers/worker-lane-files.ts`
- `apps/sim/app/api/center/workers/import/route.ts`
- `apps/sim/lib/api/contracts/center.ts`
- Center UI `Import Workers` action and Agent Work projection
- `.ai-bridge/projects/worker-lane/sample-events.json`
- `.ai-bridge/capabilities/emit.agent_run_started.json`
- `.ai-bridge/capabilities/emit.agent_run_completed.json`
- `.ai-bridge/capabilities/emit.agent_failure.json`
- `.ai-bridge/capabilities/emit.agent_diff.json`
- `.ai-bridge/capabilities/emit.agent_test_result.json`
- `.ai-bridge/capabilities/emit.agent_artifact.json`
- `.ai-bridge/capabilities/emit.agent_review_needed.json`

Evidence:

- Import route produced 7 evidence records, 7 raw events, 7 observations, 2 blocked loops, 1 recommendation, and 1 action proposal from 7 sample worker-lane records.
- Browser smoke created a profile, clicked `Import Workers`, persisted the imported records, and rendered agent observations plus review-needed action state.
- Targeted Center boundary checks still passed.
- `bun --cwd apps/sim test lib/center/producers/worker-lane.test.ts lib/center/producers/learn-understand.test.ts lib/center/producer-import.test.ts` passed.
- `bun --cwd apps/sim type-check` passed.
- `bun run check:api-validation` passed.
- `bun run check:center-boundary` passed.
- `bun run check:boundaries` passed.

## Phase 12 result

Handled. Center now has a repo-local macOS `.app` launcher bundle path that starts the low-resource Center service and opens the Center route without changing storage or importing heavy runtime modules.

Implemented:

- `scripts/package-center-app.ts`
- root `package:center-app` script
- `.gitignore` entry for generated local app bundles
- `.ai-bridge/projects/center/phase-12-implementation.md`

Generated local artifact:

```text
.ai-bridge/artifacts/center-app/Center.app
```

Evidence:

- `bun run package:center-app` generated `Center.app`.
- `plutil -lint .ai-bridge/artifacts/center-app/Center.app/Contents/Info.plist` passed.
- `test -x .ai-bridge/artifacts/center-app/Center.app/Contents/MacOS/Center` passed.
- `CENTER_APP_OPEN=0 CENTER_APP_WAIT_SECONDS=5 .ai-bridge/artifacts/center-app/Center.app/Contents/MacOS/Center` exited 0.
- `curl -I -sS http://localhost:6888/workspace/local-test/center` returned `HTTP/1.1 200 OK`.
- `bunx biome check scripts/package-center-app.ts package.json` passed.
- `bun run check:center-boundary` passed.
- `git diff --check` passed.
- Fresh Center route request audit saw 0 `/api/telemetry` or `telemetry.simstudio.ai` requests.

## Objective

The approved Center roadmap is implemented through Phase 12. No further autonomous roadmap phase is active without a new approved scope.

Center remains the working name for the daily operating surface. Workflow remains a feature module, not the operating surface.

## Read first

- `.ai-bridge/README.md`
- `.ai-bridge/projects/index.md`
- `.ai-bridge/projects/README.md`
- `.ai-bridge/projects/center/index.md`
- `.ai-bridge/projects/center/interfaces.md`
- `.ai-bridge/projects/center/decisions.md`
- `.ai-bridge/projects/center/phase-6-implementation.md`
- `.ai-bridge/projects/center/phase-7-implementation.md`
- `.ai-bridge/projects/center/phase-8-implementation.md`
- `.ai-bridge/projects/github-producer/index.md`
- `.ai-bridge/projects/center/phase-9-implementation.md`
- `.ai-bridge/projects/plane-producer/index.md`
- `.ai-bridge/projects/center/phase-10-implementation.md`
- `.ai-bridge/projects/learn-understand-producers/index.md`
- `.ai-bridge/projects/center/phase-11-implementation.md`
- `.ai-bridge/projects/worker-lane/index.md`
- `.ai-bridge/projects/center/phase-12-implementation.md`
- `.ai-bridge/projects/center/reviews/RP-20260628-002-v1.md`
- `.ai-bridge/projects/cpu-ram-stabilization/index.md`
- `.ai-bridge/projects/ms2scheduler-integration/index.md`
- `.ai-bridge/projects/ms2scheduler-integration/interfaces.md`
- `.ai-bridge/projects/ms2scheduler-integration/phase-5-implementation.md`
- `.ai-bridge/protocols/execution-authority.md`
- `.ai-bridge/ontology/freeze-v1.md`
- `.ai-bridge/capabilities/metadata-contract.md`
- `.ai-bridge/projects/center/roadmap.md`
- `.ai-bridge/projects/cpu-ram-stabilization/phase-0-plan.md`
- `apps/sim/docs/DEV_COMPILE_PERF.md`
- root `package.json`
- `apps/sim/package.json`
- `turbo.json`
- `apps/sim/next.config.ts`
- workspace shell/layout files under `apps/sim/app/workspace/[workspaceId]/`

## Current architecture decision

Center's corrected spine is:

```text
Profile
Actor
Producer / Capability
RawEvent
Observation
Evidence
Loop
Decision
FeatureProjection
PredictionSummary
Recommendation
ActionProposal
Outcome
Policy
```

MS2Scheduler is the first mature producer/module and reference pattern. Do not rebuild scheduler logic inside Center.

## Known evidence

Existing perf doc says the previous baseline had:

- `/workspace` cold compile: 85s total / 79s compile
- `/workspace/[id]/home`: ~26s / 24s compile
- easy iteration reduced `/workspace` to 15s by disabling dev OTel, optimizing package imports, and pruning transpilePackages
- remaining debt: workspace layout imports workflow stores, which import `getBlock`, which pulls `@/blocks` barrel and the full ~280-module block registry
- attempted store decoupling exposed a blocks/triggers circular dependency and was reverted

Core suspected problem:

```text
workspace shell/layout -> workflow stores -> getBlock -> blocks barrel -> registry -> hundreds of block modules
```

## Product invariant

Center needs visuals, but its route must be lightweight and operational:

```text
loops -> agents -> tasks -> progress -> evidence -> review -> next action
```

Do not make Center depend on the existing heavy workflow editor registry unless the user explicitly opens workflow editing.

## Active authority model

Codex is the sole orchestrator. Claude, Grok, Codex CLI, Hermes, Sim workflows, and future workers are execution producers. Producers can inspect, propose, emit evidence, or run approved tasks, but they do not own architecture decisions.

Authority and truth impact are defined in:

```text
.ai-bridge/protocols/execution-authority.md
```

## Non-goals

- Do not redesign product UI yet.
- Do not pull/rebase upstream.
- Do not overwrite Kevin's local commits.
- Do not run full monorepo tests unless necessary.
- Do not hide the issue by only increasing heap.
- Do not remove workflow capability; isolate it.

## Active implementation

None. The approved Phase 0-12 sequence is complete.

Guardrail:

- `bun run check:center-boundary` must pass.

## Acceptance criteria

- Phase implementation records exist for the completed roadmap.
- The generated app launcher path is documented and reproducible.
- Verification evidence is recorded in `.ai-bridge`.

## Final report format

1. Changed
2. Verified
3. Notes
