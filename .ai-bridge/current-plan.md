# Current Plan — Phase 4 Lightweight Center Surface

Status: active.

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

## Objective

Build the first lightweight Center operating surface without pulling the workflow/block/editor hot path.

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

- Do not redesign product UI yet.
- Do not pull/rebase upstream.
- Do not overwrite Kevin's local commits.
- Do not run full monorepo tests unless necessary.
- Do not hide the issue by only increasing heap.
- Do not remove workflow capability; isolate it.

## Active implementation

Build:

- `/workspace/[workspaceId]/center`
- standalone implementation under `apps/sim/app/center/[workspaceId]`
- Today
- active loops
- blocked loops
- recent observations
- evidence
- next actions
- prediction summary with honest insufficient-data state
- review-needed decisions
- manual local capture for profile, event, loop, evidence, and decision

Guardrail:

- `bun run check:center-boundary` must pass.

## Acceptance criteria

- Center route loads without top-level workflow editor, block registry, connector registry, Monaco, mermaid, document parser, execution sandbox, or provider SDK registry imports.
- Center surface is not graph-only.
- Center can use the local spine through browser-local storage.
- No telemetry.
- Targeted type/lint/boundary checks pass.

## Final report format

1. What was actually heavy
2. What changed
3. Commands Kevin should use
4. Remaining tech debt
5. Exact next fix if CPU/RAM is still bad
