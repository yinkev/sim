# Current Plan — Phase 0 Sim CPU/RAM Stabilization Before Center Implementation

Status: active and not waived.

Governing decision: Center / Sim / MS2Scheduler architecture is approved with required changes. Those required changes are now execution gates:

1. Save the execution authority model.
2. Save the ontology freeze.
3. Save the capability metadata contract.
4. Keep Phase 0 as Sim CPU/RAM stabilization.
5. Do not start Center UI until Phase 0 is handled or explicitly waived.

## Objective

Stop local Sim dev from burning extreme CPU/RAM before Center product work. Kevin reported extreme CPU and RAM usage.

Center remains the working name for the daily operating surface. Workflow remains a feature module, not the operating surface.

## Read first

- `.ai-bridge/README.md`
- `.ai-bridge/projects/index.md`
- `.ai-bridge/projects/README.md`
- `.ai-bridge/projects/center/index.md`
- `.ai-bridge/projects/center/interfaces.md`
- `.ai-bridge/projects/center/decisions.md`
- `.ai-bridge/projects/center/reviews/RP-20260628-002-v1.md`
- `.ai-bridge/projects/cpu-ram-stabilization/index.md`
- `.ai-bridge/projects/ms2scheduler-integration/index.md`
- `.ai-bridge/projects/ms2scheduler-integration/interfaces.md`
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

- Do not build Center UI yet.
- Do not redesign product UI yet.
- Do not pull/rebase upstream.
- Do not overwrite Kevin's local commits.
- Do not run full monorepo tests unless necessary.
- Do not hide the issue by only increasing heap.
- Do not remove workflow capability; isolate it.

## Phase 0 — Protect branch state

1. Run git status and recent commit inspection.
2. Record current ahead/behind state.
3. Confirm only `.ai-bridge/` is untracked before code changes.

## Phase 1 — Measure/process map

Find what actually consumes CPU/RAM in Kevin's normal run path.

Inspect:

- root `dev`, `dev:full`, `dev:full:capped`, `dev:mothership`
- app `dev`, `dev:capped`, `dev:webpack`
- Turbo pipeline in `turbo.json`
- Next config and instrumentation
- local docs already present in `apps/sim/docs/DEV_COMPILE_PERF.md`
- whether background jobs/realtime/mothership start during normal app dev

Produce a short map:

```text
command -> processes -> watchers -> likely CPU/RAM causes
```

## Phase 2 — Low-risk script/profile fixes

Implement explicit low-resource dev profiles.

Expected shape:

Root `package.json`:

- `dev:lite`: app-only, capped heap, no realtime, no mothership, no background worker fanout
- `dev:center`: app-only or app + only minimal services required for Center route
- preserve `dev:full:capped`

App `apps/sim/package.json`:

- keep or refine `dev:capped`
- add a documented low-resource app command if needed

Add docs:

- `apps/sim/docs/LOCAL_DEV_PROFILES.md` or similar
- explain which command Kevin should use daily

## Phase 3 — Import-boundary plan

Do not blindly refactor the registry. First identify exact import chain with searches/reads.

Target: prevent non-editor workspace routes from importing the full block registry.

Likely work:

- isolate workflow editor/block registry imports behind route-specific components
- make workspace shell not import workflow editor stores unless editor route needs them
- audit top-level `getBlock` / `getTrigger` calls that create circular module-eval dependency
- document the registry cycle as a deliberate refactor, not a quick hack

If a safe small patch exists, implement it. If not, write a precise follow-up plan with file-level targets and risk.

## Phase 4 — Validation

Run cheapest checks first:

- package JSON/script validity
- targeted lint/typecheck for touched files
- optionally app boot smoke if available

Do not run full monorepo test by default.

## Acceptance criteria

- Kevin has a clear low-resource daily dev command.
- The repo documents when to use `dev:lite`, `dev:center`, and `dev:full:capped`.
- No product behavior is changed by script/doc-only fixes.
- Any code changes are targeted and justified by measured import/process evidence.
- Center route constraints are explicit before Center UI implementation starts.

## Final report format

1. What was actually heavy
2. What changed
3. Commands Kevin should use
4. Remaining tech debt
5. Exact next fix if CPU/RAM is still bad
