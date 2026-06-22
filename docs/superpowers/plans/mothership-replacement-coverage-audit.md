# Mothership Replacement Coverage Audit

Date: 2026-06-22

Status: Current-state handoff audit for the active owned Mothership/Copilot backend replacement goal as of 2026-06-22. This audit proves planning, shared-contract/client groundwork, stream hardening, the owned service skeleton, the first owned non-stream protocol routes, durable run/checkpoint/tool-result seams, durable stream-event append/read/replay foundations, scoped subagent stream-event preservation, storage-backed BYOK admin and validate-key API-key route families, strict Mothership-to-Sim API-key entitlement preflight for initial runtime streams and resume/tool-result requests, the first owned Anthropic text provider kernel, first Anthropic tool checkpoint/resume continuation, first owned OpenAI Responses text provider path, first owned OpenAI Responses tool checkpoint/resume continuation plus edge coverage, first owned CliProxyAPI chat-completions text path with `gpt-5.5` defaults and strict-E2E preflight support, first owned CliProxyAPI Sim-tool checkpoint/resume continuation plus public stream fixtures, explicit fail-closed CliProxyAPI workflow-subagent callback deferral, fail-closed provider-pricing freshness and unpriced-Anthropic preflight guards before hosted provider fetch/billing, explicit OpenAI standard/batch/flex/priority/regional calculator support for configured GPT-5.4/GPT-5.5-family models, fail-closed subagent-route guards that prevent catalog `route: "subagent"` tools from being mischeckpointed as Sim tools, the first owned workflow subagent spec, a strict Sim/Mothership workflow subagent callback contract, an initial Anthropic/OpenAI provider-continuation seam for completed workflow subagent callback results, the first real Sim workflow subagent execution engine behind the strict callback route, durable Mothership-to-Sim billing update-cost callback outbox plus immediate delivery/retry state and an admin-authenticated processor endpoint for owned provider streams, strict Mothership-to-Sim BYOK validation callback-gated Anthropic and OpenAI key selection, strict runtime-header compatibility for the Sim stream caller, a first-class Helm/Docker owned Mothership service target with strict app/Mothership secret ownership rules, the first read-only FeatureCase control-panel backend over the hash-chained evidence ledger, the first workspace Mothership control-panel UI over that backend, and authenticated FeatureCase artifact drill-through for selected case, coverage-audit, and handoff evidence. Entitlement callbacks remain synchronous fail-closed by design. It does not claim backend replacement completion.

## Current Verdict

The planning baseline is materially covered. G0 architecture approval was granted. The replacement is not complete.

Approved G0 architecture direction:

1. Dedicated `apps/mothership` service inside the monorepo.
2. Shared `packages/mothership-contracts` and optional `packages/mothership-client`.
3. TypeScript/Bun first implementation while preserving a real service boundary.
4. Distinct service-auth headers and env names.
5. Protocol-complete stream/resume/auth/callback baseline before product breadth.
6. Phase 3 product-complete hardening as the target vision.

## Artifact Inventory

| Artifact | Purpose | Status |
| --- | --- | --- |
| `docs/superpowers/plans/mothership-backend-replacement-architecture.md` | Phase 1 architecture, protocol, state, auth, observability, compatibility risks | Written, linked, approved at G0 |
| `docs/superpowers/plans/mothership-secret-boundaries.md` | Secret-boundary lesson, Mermaid diagrams, failure examples, fixed auth matrix | Written, linked |
| `docs/superpowers/plans/mothership-backend-replacement-execution-plan.md` | Phase 2/3 task graph, gates, verification, subagent loop | Written, linked |
| `docs/README.md` | Local docs index | Updated with all Mothership replacement docs |
| `packages/mothership-contracts` | Shared owned contract package for source JSON, route contracts, auth-boundary helpers, OpenAI/CliProxyAPI/workflow-subagent stream fixtures, and service-safe tool-catalog route lookup | Implemented in P2-1/P2-4/P2-9, reviewer findings resolved |
| `apps/mothership` | Owned service skeleton, first runtime protocol routes, storage-backed admin BYOK and validate-key API-key route families, strict Sim callback entitlement preflight for initial runtime streams and resume/tool-result requests, durable billing update-cost callback outbox plus immediate delivery and admin-authenticated pending-processor endpoint for owned provider streams, strict BYOK validation callback-gated Anthropic key selection, durable state seams, durable stream writer/replay foundation with scoped subagent event support, first Anthropic text and tool/resume continuation kernel, first OpenAI Responses text provider path, first OpenAI Responses tool/resume continuations, first CliProxyAPI chat-completions text/tool-resume continuation, auditable provider-pricing policy freshness/preflight guards plus OpenAI mode/regional calculator support, fail-closed provider guards for catalog subagent tools including CliProxyAPI workflow-subagent deferral, first workflow subagent spec, strict callback caller helper, initial provider-continuation seam for workflow subagent callback results, first Sim workflow subagent execution engine, owned title/fork route parity, and Helm/Docker service target for the Mothership process boundary | Implemented in P2-4/P2-6/P2-7/P2-8/P2-9/P2-11 with health/readiness/auth/body-cap/shutdown/model-route/title/fork/admin-BYOK/validate-key/API-key-callback/resume-entitlement/billing-callback-outbox/billing-callback-processor/BYOK-callback/explicit-abort/resume/run-store/checkpoint-tool-result/stream-event/replay/provider/CliProxyAPI-text/CliProxyAPI-tool-resume/pricing-policy/subagent-guard/subagent-spec/subagent-callback/subagent-continuation/subagent-engine/chart-render tests |
| `apps/sim/app/api/mothership/control-panel/feature-cases` | Read-only operator backend for the YES control-panel path, backed by the hash-chained FeatureCase ledger and guarded by session auth before query parsing | Implemented as Task 66 with contract, route, ledger reader, focused tests, API-boundary audit, and explicit non-claims |
| `apps/sim/app/api/mothership/control-panel/feature-case-artifact` | Session-authenticated drill-through route for selected FeatureCase case JSON, coverage-audit markdown, and temp handoff markdown artifacts | Implemented as Task 68 with auth-before-parse route handling, event-id lookup, repo/temp realpath enforcement, symlink escape regressions, UI links, and explicit external-gate non-claims |
| `apps/sim/app/workspace/[workspaceId]/mothership` | Workspace operator UI for FeatureCase cases, claims, non-claims, evidence commands, reviews, grades, blockers, next action, ledger digests, and explicit hard-gate status | Implemented as Task 67 with contract-bound React Query hook, sidebar entry, focused tests, local dev browser screenshot proof, and explicit external-gate non-claims |

## Requirement Coverage

| Requirement from active goal | Current evidence | Status |
| --- | --- | --- |
| Final-vision owned backend replacement plan, not MVP | Architecture non-negotiables and execution operating rule reject hidden hosted fallback, fake success, and MVP framing | Covered in plan |
| Phase 1 contract-compatible architecture spec | Architecture doc covers route matrix, request payload, stream contract, checkpoints, tool routing, callbacks, state, auth, observability, risks | Covered and approved |
| Reverse-engineered Sim to Mothership protocol | Architecture doc maps current backend routes and stream events from repo evidence | Covered from available source |
| Auth boundaries | Architecture doc plus secret-boundary doc define strict directional headers, envs, startup guard, wrong-key matrix | Covered in plan |
| Stream/checkpoint/resume behavior | Architecture doc covers terminal event rule, checkpoint pause, resume payload, retry and billing monotonicity | Covered in plan |
| Billing/BYOK callbacks | Architecture doc and execution plan cover Sim-authoritative callbacks and tests | Covered in plan |
| State model | Architecture doc defines ownership for workspace DB, chat, streams, checkpoints, tools, billing, BYOK, admin config | Covered in plan |
| Security | Secret-boundary doc covers misconfiguration class and acceptance criteria | Covered in plan |
| Observability | Architecture and secret-boundary docs define trace/log fields and alert candidates | Covered in plan |
| Compatibility risks | Architecture doc has risk/mitigation table; execution plan has gates and checks | Covered in plan |
| Phase 2 implementation plan | Execution plan P2-0 through P2-11 covers contracts, client, auth, service, streams, routes, state, callbacks, tools, migration, deployment | Covered in plan |
| Dedicated `apps/mothership` service | `apps/mothership` now has a standalone package, Node HTTP adapter, `/health`, authenticated `/ready`, request-id propagation, service auth middleware, streaming body-size cap, graceful shutdown entrypoint, owned model-list, owned title generation, owned fork acknowledgement, admin-key-gated BYOK list/upsert/delete backed by `workspace_byok_keys`, runtime-auth validate-key list/generate/delete backed by `api_key`, strict Mothership-to-Sim API-key entitlement preflight before initial runtime run claim/provider/SSE and before resume tool-result mutation, durable Mothership-to-Sim billing update-cost callback outbox plus immediate delivery before owned provider terminal complete/checkpoint pause, admin-key-gated billing callback processor endpoint with optional non-clean failure status, strict Mothership-to-Sim BYOK validation callback-gated Anthropic and OpenAI key selection, explicit-abort, resume runtime route, owned `/api/copilot`, `/api/mothership`, and `/api/mothership/execute` runtime routes, DB-backed run/checkpoint/tool-result/event seams, durable persist-before-enqueue stream writer, replay-only `GET /api/streams/replay` in JSON batch and SSE modes, a service-local Anthropic text provider kernel, first Anthropic tool checkpoint/resume continuation, first OpenAI Responses text provider path, first OpenAI Responses tool checkpoint/resume continuation, first CliProxyAPI chat-completions text path plus Sim-tool checkpoint/resume continuation with provider-specific billing and strict preflight, first workflow subagent spec/callback/helper/provider-continuation path, first provider-resume workflow-subagent callback context, first Sim workflow subagent execution engine, root dev/check scripts, `docker/mothership.Dockerfile`, a first-class Helm `mothership.server` deployment/service target, and a Helm billing callback processor CronJob target | P2-4 skeleton, P2-6 first routes plus title/fork/admin-BYOK/validate-key parity, P2-7 state seams, P2-10 replay serving, first provider/tool kernel, initial runtime and resume API-key callback preflight, owned Anthropic billing callback outbox/immediate delivery/processor endpoint, owned Anthropic and OpenAI BYOK callback-gated key selection, owned OpenAI Responses text streaming plus tool checkpoint/resume continuation with billing/error/retry hardening, first CliProxyAPI text streaming, Sim-tool checkpoint/resume, and preflight checks, workflow subagent spec/callback contract/provider seam, provider-resume workflow-subagent context, first Sim workflow subagent execution engine, first workflow-subagent public fixtures, explicit workflow-subagent `needs_input` semantics, workflow-subagent `needs_input` and cancelled public result fixtures, Helm-owned service target, and Helm billing processor CronJob target implemented and verified by render/tests; CliProxyAPI workflow subagent support, mixed Sim+subagent provider batches, broader provider breadth, full browser E2E proof, image publishing, live cluster CronJob execution, and Docker build remain open |
| Shared contract packages | `packages/mothership-contracts` now contains owned JSON contract sources, package-local route contracts, auth-boundary helpers, current-wire route contracts, and initial stream fixtures. Runtime stream bodies now require trimmed non-empty `workspaceId` because the API-key entitlement callback is workspace-scoped. | Implemented and verified in P2-1/P2-4 and tightened for the API-key preflight slice |
| Typed client package | `packages/mothership-client` provides contract-bound request validation, safe fingerprints, explicit legacy-wire header adapter tests, strict contract mode for owned routes, and a CI package check. Shared service-header/topology helpers now live in `@sim/mothership-contracts` and are re-exported for compatibility. Sim non-stream runtime slices now use typed helpers for models, validate-key list/delete/generate, explicit abort, chat fork, and title generation. Strict-mode chat replay uses the owned `streamReplayBatchContract`; BYOK proxying now uses hosted legacy admin compatibility only for `copilot.sim.ai` and strict admin auth for owned Mothership URLs. | Implemented for package/core helper, current safe non-stream app slices, BYOK admin auth migration, and strict-mode replay consumption; full provider/tool continuation is not complete |
| Migrations | Existing `copilot_runs`, `copilot_run_checkpoints`, `copilot_async_tool_calls`, `workspace_byok_keys`, `api_key`, and `outbox_event` tables are reused for the first run/checkpoint/tool-result/BYOK/API-key/billing-callback seams; migrations `0239_wet_vin_gonzales.sql` and `0240_new_slyde.sql` add durable stream events plus stable resume start sequencing; billing callback idempotency uses Sim's existing update-cost route semantics plus a stable Mothership run idempotency key and a durable billing-only outbox row; `bun run check:migrations` passes | First abort/resume/event/BYOK/API-key seams and billing callback outbox implemented; usage snapshots and broader callback/product retries remain open only where explicitly needed |
| Golden stream tests | `scripts/check-mothership-stream-fixtures.ts` validates package SSE fixtures against the generated stream JSON Schema and current Sim parser, rejects parser-invalid/schema-invalid/missing-terminal/duplicate-terminal fixtures, and Sim read-loop tests replay the valid fixture set | P2-5 strict fixture and parser replay slice implemented; owned service writer now persists before enqueue, owned replay serving can return stored envelopes, and owned pause-only, multi-tool pause, failed-result resume, cancelled-result resume, repeated-tool pause, full resume, OpenAI tool/resume public stream fixtures, and CliProxyAPI tool/resume public stream fixtures are covered; real-provider/browser E2E proof still remains open |
| Auth/security tests | `apps/sim/lib/mothership/service-auth.test.ts` covers callback key success, missing key, wrong callback key, runtime/admin/legacy `x-api-key` family rejection, missing config, reused callback/internal secret rejection, strict-vs-legacy runtime auth header creation, hosted-url legacy defaults, owned-url strict defaults, hosted BYOK admin legacy compatibility, and owned BYOK admin strict headers. Billing/API-key/BYOK callback route tests prove callback routes reject legacy `x-api-key`, missing callback credentials, and billing-disabled auth bypasses. `apps/mothership` tests cover runtime readiness/model-list/title/fork/auth-before-shutdown, BYOK admin auth-before-parse, runtime-key rejection on admin routes, validate-key runtime auth-before-parse and admin-key rejection, production admin/BYOK/API-key/callback/SIM-base requirements, API-key entitlement rejection before durable run claim, resume API-key entitlement rejection before durable tool-result mutation, durable workspace-only resume entitlement, caller workspace-conflict rejection, malformed checkpoint provider-request rejection before mutation, billing callback strict-header emission, billing outbox payload-without-secrets, idempotent 409 duplicate handling, billing fail-closed behavior before terminal complete/checkpoint pause, BYOK validation callback strict-header emission, initial BYOK rejection fallback to hosted credentials, BYOK resume source preservation with zero hosted billing, owned runtime route auth-before-parse, explicit-abort/resume auth-before-parse, generic wrong-family failures without a key oracle, body-size rejection, request-id preservation on adapter failures, and provider continuation without client-supplied provider secrets. | P2-3 callback route family, P2-4/P2-6/P2-7 runtime/admin auth, initial runtime and resume API-key callback preflight, owned Anthropic billing callback outbox/immediate delivery, and owned Anthropic BYOK callback-gated key selection implemented for completed routes |
| Rollout migration away from hosted `copilot.sim.ai` | Architecture non-negotiables and execution plan P2-10/P2-11 | Planned, partial prior code changes exist, not globally complete |
| Phase 3 product-vision hardening | Architecture Phase 3 table and execution plan P3-1 through P3-9 | Covered in plan |
| Admin/BYOK management | `/api/copilot/byok` remains superuser-gated and preserves opaque/empty upstream responses. It now uses legacy `x-api-key` runtime-key compatibility only for hosted `copilot.sim.ai` targets and strict `x-mothership-admin-key` for owned Mothership URLs. `apps/mothership` owns an admin-key-gated `/api/admin/byok` GET/POST/DELETE boundary that rejects runtime keys, authenticates before parsing, requires admin/encryption secrets in production, and lists/upserts/deletes encrypted keys in `workspace_byok_keys`. | Hosted compatibility retained; owned Mothership admin storage and Sim strict-admin proxy migration implemented |
| API-key management | Sim validate-key list/delete/generate routes use typed Mothership runtime contracts. `apps/mothership` owns runtime-auth `POST /api/validate-key/get-api-keys`, `POST /api/validate-key/generate`, and `POST /api/validate-key/delete` backed by `api_key` personal rows. List responses return display-only keys; generated keys are encrypted at rest with `API_ENCRYPTION_KEY` and returned once. Initial runtime streams call Sim's strict `/api/copilot/api-keys/validate` callback with `x-sim-callback-key` and fail closed before run claim/provider/SSE. Resume/tool-result requests reload the durable checkpoint, use only `copilot_runs.workspace_id` for entitlement, reject caller workspace conflicts, preflight the stored provider-request shape, and recheck workspace inside the record transaction before mutating tool rows. | Hosted compatibility retained; owned Mothership API-key storage, Sim display-only proxy migration, initial runtime entitlement preflight, and resume entitlement preflight implemented |
| Deployment and operability | `apps/mothership` has health/readiness endpoints, request-id propagation, graceful shutdown, root `dev:mothership`, production `SIM_BASE_URL` plus `MOTHERSHIP_TO_SIM_CALLBACK_KEY` requirements for callbacks, an admin-authenticated billing callback processor endpoint, a DB-backed restart replay smoke script, a Dockerfile/prune target, a Helm `mothership.server` deployment/service target that pins shared boundary secrets without mounting the full app Secret, and a Helm billing callback processor CronJob with strict admin auth, non-clean failure signaling, bounded shell retries, and dedicated egress NetworkPolicy. Image publishing, queues, persistence dashboards, cluster-level CronJob execution proof, and alerting remain in P2-11/P3-9. | P2-4 skeleton, P2-10 restart replay smoke, callback startup guard, admin processor endpoint, P2-11 service deployment target, and P2-11 processor CronJob target covered; production operability still planned |
| Subagent-driven development after approval | P2-1, P2-4, P2-5, P2-6, P2-7, owned explicit-abort, and owned resume route review loops completed; spec and code-quality findings were fixed | Covered for completed slices |
| Tests/checks passing for touched scope | P2-0, P2-1, P2-2/P2-3 groundwork, P2-4, P2-5, P2-6, P2-7, owned explicit-abort, owned resume, durable stream-event, owned runtime skeleton, durable replay serving, first owned provider kernel, owned Anthropic billing callback, billing callback outbox, owned OpenAI text and tool checkpoint/resume continuation, and owned Mothership Helm target checks passed after reviewer fixes | Verified for completed slices |
| Documented remaining unknowns | See unknowns below | Covered |

## Remaining Unknowns

| Unknown | Current position | How to resolve |
| --- | --- | --- |
| Private hosted backend internals | Not available in this repo. Public evidence suggests a separate Go service, but source is absent. | Treat hosted service only as a reference oracle if explicitly approved; do not depend on private internals. |
| Exact production persistence schema | Not inferable from Sim source alone. First owned seams reuse existing Sim run/checkpoint/tool-call tables, the existing shared `outbox_event` table, and a new owned stream-event table plus stable resume start-seq column. Owned Anthropic billing now writes a durable billing-only outbox row before the Sim callback, retries from that row, and treats `409` as completion. API-key and BYOK entitlement callbacks intentionally remain synchronous fail-closed because they gate key use and tool-result mutation. | Continue P2-7 for usage snapshots, Sim reconnect integration, restart/replay tests, and only add broader callback outboxing if a later product slice proves it necessary. |
| Exact provider orchestration internals | Not present in Sim repo. A first owned Anthropic text and tool/resume streaming adapter now exists, including repeated tool-use-after-resume proof, billing callback emission, and BYOK validation callback-gated Anthropic key selection. A first owned OpenAI Responses text and tool/resume adapter now exists with strict owned credentials, durable text/complete/error/tool checkpoint events, route-specific billing source, provider-specific cumulative billing idempotency, retry-safe resume delivery, fail-closed stored-checkpoint validation, OpenAI BYOK source preservation, and public stream fixtures. A first owned CliProxyAPI chat-completions text and Sim-tool/resume adapter now exists for `gpt-5.5` defaults, reasoning effort, text streaming, Chat Completions tool definitions, durable tool checkpoint pause, Chat Completions `role: "tool"` resume messages, billable-usage validation, sanitized provider errors, provider-specific billing idempotency, strict stored-envelope validation, and public fixtures. Catalog `route: "subagent"` initial Anthropic/OpenAI calls now route through the strict workflow callback, and pure `workflow` subagent calls during Anthropic/OpenAI provider resume now use stored strict callback context instead of the old unsupported-subagent terminal. CliProxyAPI workflow subagent callback continuation is intentionally fail-closed because it would require a separate Chat Completions subagent continuation path that lacks real E2E demand/proof. The first Sim workflow subagent execution slice runs an owned headless child Mothership lifecycle with only workflow child tools, strict workspace/workflow authorization, scoped non-terminal child events, bounded child tool/provider rounds, first public workflow-subagent stream fixtures, explicit `needs_input` classification for ambiguous instruction, missing permission, destructive action confirmation, and tool-confirmation cases, plus public `needs_input` and cancelled result fixtures. Mixed Sim+subagent provider batches, broader provider breadth, and real-provider/browser E2E are not complete. | Continue the owned provider/tool/subagent kernel behind contract-compatible stream behavior. |
| BYOK admin backend storage model | Sim proxies `/api/admin/byok` with hosted legacy auth for `copilot.sim.ai` and strict admin auth for owned URLs; `apps/mothership` has an admin-authenticated BYOK route family backed by existing `workspace_byok_keys` rows and compatible AES-GCM encrypted values. | Remaining work is rollout proof against an owned deployed URL, not storage/auth implementation. |
| API-key backend storage model | Sim proxies validate-key list/delete/generate through typed runtime contracts; `apps/mothership` has a runtime-authenticated validate-key route family backed by existing `api_key` personal rows with AES-GCM encrypted values and SHA-256 hashes. Initial runtime streams now call Sim's callback validator before durable run claim. Resume/tool-result requests read the durable checkpoint, require `copilot_runs.workspace_id`, reject mismatched caller workspace hints, preflight the stored owned-provider resume request, validate Sim API-key entitlement for the durable workspace, and only then record tool results with a transactional workspace recheck. | Remaining work is rollout proof against an owned deployed URL and browser/provider E2E proof, not list/generate/delete storage, initial-stream callback use, or current resume tool-result entitlement. |
| Full product capability ordering | Docs define capabilities, but implementation order after protocol baseline needs approval. | Use Phase 3 workstreams and review after G4. |

## Verification Performed For Planning Artifacts

Targeted checks already run for these docs:

```bash
git diff --check -- docs/README.md docs/superpowers/plans/mothership-backend-replacement-architecture.md docs/superpowers/plans/mothership-backend-replacement-execution-plan.md docs/superpowers/plans/mothership-secret-boundaries.md
LC_ALL=C rg -n '[^\x00-\x7F]' docs/README.md docs/superpowers/plans/mothership-backend-replacement-architecture.md docs/superpowers/plans/mothership-backend-replacement-execution-plan.md docs/superpowers/plans/mothership-secret-boundaries.md
rg -n '^```' docs/superpowers/plans/mothership-backend-replacement-architecture.md docs/superpowers/plans/mothership-backend-replacement-execution-plan.md docs/superpowers/plans/mothership-secret-boundaries.md
rg -n 'Owned Mothership backend replacement architecture|Owned Mothership backend replacement execution plan|Mothership secret boundary lessons' docs/README.md
```

Result: formatting checks passed, docs are ASCII, fences are balanced, and docs are linked.

## Verification Performed For P2-1

P2-1 implementation checks run after resolving spec and code-quality reviewer findings:

```bash
bun run mship-fixtures:check
bun run --cwd packages/mothership-contracts lint:check
bun run --cwd packages/mothership-contracts type-check
bun run mship-contracts:check
bun run mship-tools:check
bun run trace-spans-contract:check
bun run trace-attributes-contract:check
bun run trace-attribute-values-contract:check
bun run trace-events-contract:check
bun run metrics-contract:check
bun run mship:check
bun run check:boundaries
bun run check:api-validation:strict
bun run check:react-query
bun run type-check
git diff --check
rg -n "/Users/kyin/Projects/copilot|copilot/copilot/contracts|copilot\.sim\.ai|www\.copilot\.sim\.ai" scripts packages/mothership-contracts apps/sim/lib/copilot
```

Result: all commands passed. The final `rg` returned no runtime/package/script matches.

## Verification Performed For P2-2/P2-3 Groundwork

P2-2/P2-3 package and helper checks run after adding `@sim/mothership-client` and the Sim service-auth helper:

```bash
bun run mship-client:check
bun run --cwd apps/sim test lib/mothership/client.test.ts app/api/copilot/models/route.test.ts app/api/copilot/api-keys/route.test.ts app/api/copilot/api-keys/generate/route.test.ts
bun run --cwd apps/sim test lib/mothership/client.test.ts lib/copilot/request/session/explicit-abort.test.ts app/api/copilot/chat/abort/route.test.ts 'app/api/mothership/chats/[chatId]/fork/route.test.ts'
bun run --cwd apps/sim test lib/copilot/request/lifecycle/start.test.ts
bun run --cwd apps/sim test lib/mothership/client.test.ts app/api/copilot/byok/route.test.ts
bun run --cwd apps/sim test lib/mothership/service-auth.test.ts
bun run --cwd apps/sim test lib/mothership/service-auth.test.ts app/api/copilot/api-keys/validate/route.test.ts app/api/copilot/byok/validate/route.test.ts app/api/billing/update-cost/route.test.ts
bun -e 'import { readFileSync } from "node:fs"; import { parse } from "yaml"; const files = ["helm/sim/values.yaml", "helm/sim/values.schema.json", ...Array.from(new Bun.Glob("helm/sim/examples/*.yaml").scanSync()), ...Array.from(new Bun.Glob("helm/sim/tests/*.yaml").scanSync())]; for (const file of files) { const text = readFileSync(file, "utf8"); if (file.endsWith(".json")) JSON.parse(text); else parse(text); } console.log(`parsed ${files.length} helm yaml/json files`);'
bun run --cwd packages/mothership-contracts lint:check
bun run --cwd packages/mothership-contracts type-check
bun run lint:check
bun run check:api-validation:strict
bun run check:boundaries
bun run check:utils
bun run check:react-query
bun run type-check
bun run mship:check
bun run mship-fixtures:check
git diff --check
helm version --short
```

Result: all Bun/Vitest/policy/parse commands passed after review fixes. `helm version --short` failed with `command not found: helm`, so Helm lint/template/unit verification is blocked in this environment. `bun test apps/sim/lib/mothership/service-auth.test.ts` was also tried first and failed because it invokes Bun's test runner; the correct repo command is the app's Vitest script above.

Reviewer fixes applied:

1. Mixed callback plus wrong-family headers now fail before accepting the callback key.
2. Unknown callback keys return `401`; wrong service-key families return `403`.
3. Explicit legacy-wire modes now require the matching strict header family and strip all strict service headers before sending `x-api-key`.
4. Strict contract mode rejects caller-provided legacy `x-api-key` before fetch.
5. Billing update auth now runs before the billing-disabled early return.
6. Startup validation is wired through `apps/sim/instrumentation-node.ts` and Helm/env docs require `MOTHERSHIP_TO_SIM_CALLBACK_KEY`.
7. Callback route auth is strict-only on Sim: callback routes reject `x-api-key` even if the value matches the callback secret.
8. First non-stream runtime migration slice uses typed contracts/client for `/api/get-available-models` and `/api/validate-key/{get-api-keys,delete,generate}` while preserving explicit `legacy-runtime` wire auth and OTel attributes.
9. Second non-stream runtime migration slice uses typed contracts/client for `/api/streams/explicit-abort` and `/api/chats/fork`; `/api/copilot/chat/abort` now calls the shared explicit-abort helper while preserving best-effort local abort cleanup.
10. Third non-stream runtime migration slice adds a package contract for `/api/generate-chat-title` and moves title generation through the typed runtime client while preserving trimmed-title-or-null behavior.
11. Fourth non-stream review slice originally kept `/api/copilot/byok` on the current raw runtime-key proxy, preserving source-env forwarding plus upstream admin error statuses and empty bodies. A later admin migration kept hosted compatibility for `copilot.sim.ai` but uses strict admin headers for owned Mothership URLs.
12. Runtime stream calls and chat cleanup now resolve the preferred `SIM_TO_MOTHERSHIP_API_KEY` with legacy `COPILOT_API_KEY` fallback, so new deployments are not stuck on the old env name.
13. The previous `MOTHERSHIP_ALLOW_LEGACY_CALLBACK_X_API_KEY` compatibility flag was removed after review; runtime calls may keep hosted `x-api-key` compatibility, but Mothership-to-Sim callbacks must use `x-sim-callback-key`.
14. CI runs `bun run mship-client:check`, `bun run mship:check`, and `bun run mship-fixtures:check`.

## Verification Performed For P2-5 Stream Hardening

P2-5 checks run after strict fixture, writer, finalizer, and read-loop replay fixes:

```bash
bun run --cwd apps/sim test lib/copilot/request/session/writer.test.ts lib/copilot/request/lifecycle/start.test.ts lib/copilot/request/go/stream.test.ts
bun run --cwd apps/sim type-check
bun run mship-fixtures:check
bun run --cwd packages/mothership-contracts fixtures:check
bun run --cwd packages/mothership-contracts type-check
bun run mship-contracts:check
bun run mship:check
bun run mship-client:check
bun run check:utils
bunx biome check apps/sim/lib/copilot/request/session/writer.ts apps/sim/lib/copilot/request/session/writer.test.ts apps/sim/lib/copilot/request/lifecycle/finalize.ts apps/sim/lib/copilot/request/lifecycle/start.test.ts apps/sim/lib/copilot/request/go/stream.test.ts scripts/check-mothership-stream-fixtures.ts packages/mothership-contracts/README.md package.json bun.lock
git diff --check -- apps/sim/lib/copilot/request/session/writer.ts apps/sim/lib/copilot/request/session/writer.test.ts apps/sim/lib/copilot/request/lifecycle/finalize.ts apps/sim/lib/copilot/request/lifecycle/start.test.ts apps/sim/lib/copilot/request/go/stream.test.ts scripts/check-mothership-stream-fixtures.ts packages/mothership-contracts/fixtures
```

Result: all commands passed. Spec reviewer initially found that `StreamWriter` rejected duplicate terminals but did not require one before close, and that `finalizeStream` could publish a duplicate terminal after an upstream terminal. Both findings were fixed and re-reviewed. Code-quality reviewer passed after the fixes.

P2-5 fixes applied:

1. `StreamWriter` validates contract events against `MOTHERSHIP_STREAM_V1_SCHEMA` while still accepting synthetic file-preview events.
2. `StreamWriter` tracks `sawTerminal`, rejects duplicate terminal events, and closes transport while reporting an invariant error if a stream closes without a terminal event.
3. `finalizeStream` uses `sawTerminal` instead of `sawComplete`, so an upstream `error` terminal is not followed by a synthetic `complete(status:error)`.
4. Cancelled completion metadata is stored under the contract's opaque `response` field instead of uncontracted top-level payload keys.
5. Golden fixtures now cover normal completion, terminal error, cancelled completion, sync tool args/result, async checkpoint pause, multi-tool checkpoint pause, failed async tool result completion, cancelled async tool result completion, repeated async tool-use-after-resume pause, async checkpoint/resume/tool result, compaction, session metadata, resources, subagent lifecycle, structured/subagent result spans, and invalid envelope/payload/missing-terminal/duplicate-terminal/schema-extra cases.
6. Sim read-loop tests replay the real positive fixture files and fail closed on parser-invalid or missing-terminal fixtures.

## Verification Performed For P2-4 Service Skeleton

P2-4 checks run after service skeleton fixes and two re-review passes:

```bash
bun install --lockfile-only
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run --cwd packages/mothership-contracts lint:check
bun run --cwd packages/mothership-contracts fixtures:check
bun run check:boundaries
bun run type-check
git diff --check -- apps/mothership packages/mothership-contracts packages/mothership-client package.json bun.lock
rg -n "@sim/mothership-client|apps/sim|\\.\\./\\.\\./apps|wrong_service_key_family|requireAdminKey: env.NODE_ENV" apps/mothership packages/mothership-contracts packages/mothership-client
```

Result: all commands passed after fixes. The final `rg` returned no service-path dependency-direction or wrong-family-oracle matches.

P2-4 fixes applied:

1. Added `apps/mothership` with package scripts, TypeScript config, Vitest config, env loading, service auth, JSON responses, Fetch-style handler, Node HTTP adapter, and process entrypoint.
2. `/health` is unauthenticated liveness; `/ready` requires the runtime service key before reporting shutdown or ready state.
3. Service auth uses distinct runtime/admin headers from `@sim/mothership-contracts`, rejects invalid source-env headers, and does not reveal valid wrong-family keys through a distinct public status/code.
4. The Node adapter preserves request IDs on normal responses and adapter-level 500s.
5. Request body reads are capped at `MAX_REQUEST_BODY_BYTES` with `413` responses before handler dispatch.
6. Production startup requires both runtime and admin keys now that an owned admin route boundary exists; dev/test can omit the admin key and admin routes fail closed with 503. Provided secrets still must be distinct.
7. Shared header names and secret-topology validation moved into `@sim/mothership-contracts`; `apps/mothership` does not depend on `@sim/mothership-client`.
8. Root scripts now include `dev:mothership` and `mship-service:check`.

Reviewer fixes applied:

1. Spec reviewer found `/ready` exposed shutdown state before auth and adapter 500s dropped request IDs. Both were fixed and re-reviewed PASS.
2. Code-quality reviewer found uncapped body buffering, unused production admin-secret requirement, wrong-family key oracle, and service dependency on `@sim/mothership-client`. All four were fixed and re-reviewed PASS.

## Verification Performed For P2-6 First Owned Protocol Route

P2-6 checks run after adding owned `/api/get-available-models` and resolving two re-review rounds:

```bash
bun run mship-service:check
bun run mship-client:check
bun run --cwd apps/sim test lib/mothership/client.test.ts app/api/copilot/models/route.test.ts
bun run --cwd packages/mothership-contracts lint:check && bun run --cwd packages/mothership-contracts type-check
bun run type-check
bun run check:boundaries
bun -e 'import { readFileSync } from "node:fs"; import { parse } from "yaml"; const files = ["helm/sim/values.yaml", "helm/sim/values.schema.json", ...Array.from(new Bun.Glob("helm/sim/examples/*.yaml").scanSync()), ...Array.from(new Bun.Glob("helm/sim/tests/*.yaml").scanSync())]; for (const file of files) { const text = readFileSync(file, "utf8"); if (file.endsWith(".json")) JSON.parse(text); else parse(text); } console.log(`parsed ${files.length} helm yaml/json files`);'
bun run check:api-validation:strict
bun run mship:check
bun run mship-fixtures:check
git diff --check -- apps/mothership packages/mothership-contracts packages/mothership-client apps/sim/lib/mothership apps/sim/app/api/copilot/models apps/sim/lib/core/config/env.ts apps/sim/.env.example helm/sim/values.yaml helm/sim/values.schema.json
```

Result: all commands passed.

P2-6 fixes applied:

1. Added owned `GET /api/get-available-models` in `apps/mothership` using runtime service auth and the shared route contract.
2. Added `MOTHERSHIP_AVAILABLE_MODELS_JSON` startup validation. Missing catalog fails closed with a contract-shaped `503` instead of fake success.
3. Tightened `modelDescriptorSchema` to declare `friendlyName` and `displayName` and strip undeclared fields before responses leave the service/client boundary.
4. Changed `getAvailableModelsResponseSchema` to a discriminated union, so `success: true` cannot carry `error` and `success: false` must carry `error`.
5. Added `MOTHERSHIP_RUNTIME_HEADER_MODE=legacy|strict`. Sim keeps legacy `x-api-key` compatibility for pre-strict Copilot backends by default, and can send strict `x-mothership-runtime-key` to owned `apps/mothership` routes by setting `strict`.
6. Replaced adapter body buffering with a capped streaming body wrapper plus `Content-Length` fail-fast checks.

Reviewer fixes applied:

1. Spec reviewer found that current Sim runtime callers still sent legacy `x-api-key` while the owned route accepted only `x-mothership-runtime-key`. The explicit strict runtime header mode fixed this and re-reviewed PASS.
2. Code-quality reviewer found permissive model descriptors, missing response invariants, and body pre-buffering before route dispatch. The contract and adapter fixes above re-reviewed PASS.

## Verification Performed For P2-7 First Durable State Seam

P2-7 checks run after adding the first DB-backed run-state repository and resolving reviewer findings:

```bash
bun install --lockfile-only
bun run mship-service:check
bun run --cwd packages/db type-check
bun run check:migrations
bun run check:boundaries
bun run type-check
git diff --check -- apps/mothership package.json bun.lock docs/superpowers/plans/mothership-replacement-coverage-audit.md
```

Result: all commands passed. `check:migrations` reported no new migrations to check because this seam reuses the existing `copilot_runs` table.

P2-7 fixes applied:

1. Added `apps/mothership/src/state/run-store.ts` over the existing `copilot_runs` table.
2. Added durable lookup by `streamId + userId`.
3. Added durable cancellation update scoped by `streamId + userId` and restricted to `active`, `paused_waiting_for_tool`, and `resuming` statuses.
4. Added focused tests for lookup, missing run, cancellation update, and no-updated-row null result.
5. Declared `@sim/testing` as an `apps/mothership` dev dependency.

Reviewer fixes applied:

1. Both reviewers found that tests did not prove `streamId + userId` scoping or the abortable-status guard. Tests now mock `@sim/db/schema` and `drizzle-orm` operators and assert the exact predicate tree.
2. Both reviewers found `@sim/testing` was used but undeclared. It is now declared in `apps/mothership/package.json`.

## Verification Performed For Owned Explicit-Abort Route

Owned `POST /api/streams/explicit-abort` checks run after wiring the route to the shared contract and durable run-store seam, then fixing reviewer findings:

```bash
bun run mship-service:check
bun run --cwd apps/mothership vitest run src/http.test.ts src/state/run-store.test.ts
bun run check:boundaries
bun run check:api-validation:strict
bun run check:migrations
bun run type-check
```

Result: all commands passed. `mship-service:check` covered Biome, TypeScript, and 31 service tests. The focused HTTP/run-store suite covered 26 tests.

Explicit-abort fixes applied:

1. Added owned `POST /api/streams/explicit-abort` in `apps/mothership` using runtime service auth and `explicitAbortBodySchema`.
2. Auth runs before JSON parsing, so unauthenticated malformed bodies return auth errors and do not touch state.
3. Valid abort requests call `markMothershipRunCancelled({ streamId: messageId, userId, reason: 'explicit_abort' })`.
4. Missing streams return `404 stream_not_found` instead of fake success.
5. Existing terminal or otherwise non-abortable streams return `409 stream_not_abortable` with the durable run status.
6. Successful abort responses are parsed through the shared success response schema before leaving the route.
7. Request IDs are preserved on success and error responses.

Reviewer fixes applied:

1. Reviewer found auth-before-body-parse was not pinned because the unauthenticated test used valid JSON. Added an unauthenticated malformed-JSON test that expects `401` and no state calls.
2. Reviewer found the terminal fixture used impossible status `completed`; updated it to the DB enum value `complete`.

## Verification Performed For Owned Resume Durability And Route

Owned resume checks run after adding the DB-backed checkpoint/tool-result seam, wiring `POST /api/tools/resume`, and fixing the strict-header compatibility gap found by review:

```bash
bun run --cwd apps/sim test lib/mothership/service-auth.test.ts lib/copilot/request/lifecycle/run.test.ts
bun run mship-service:check
bun run check:boundaries
bun run check:api-validation:strict
bun run check:migrations
bun run type-check
```

Result: all commands passed. `mship-service:check` covered Biome, TypeScript, and 47 service tests. The focused Sim service-auth/lifecycle suite covered 28 tests.

Resume durability and route fixes applied:

1. Added `apps/mothership/src/state/resume-store.ts` over the existing `copilot_runs`, `copilot_run_checkpoints`, and `copilot_async_tool_calls` tables.
2. Durable resume lookup is scoped by `streamId + userId + checkpointId`, so one user's checkpoint cannot satisfy another user's resume request.
3. Resume input rejects duplicate result IDs, unknown result IDs, missing checkpoint tool results, consumed checkpoints, missing checkpoints, non-resumable runs, and terminal-result conflicts.
4. Terminal idempotency compares stored terminal status, payload, and error with stable deep key ordering before accepting a repeated terminal result.
5. Per-tool result updates happen inside the transaction; a late missed update rolls back and returns `result_conflict` instead of partial success.
6. Added owned `POST /api/tools/resume` in `apps/mothership` using runtime service auth and `resumeToolsBodySchema`.
7. Auth runs before JSON parsing, so unauthenticated malformed bodies return auth errors and do not touch state.
8. Route failures map missing checkpoint, non-resumable run, invalid results, already-consumed checkpoints, and conflicts to explicit 4xx responses.
9. Valid resume requests return a contract-shaped SSE response, but deliberately emit `run.resumed` followed by an `error` terminal with `resume_continuation_not_implemented` until owned provider continuation exists. This avoids fake completion.
10. Sim's stream lifecycle caller now uses `createMothershipRuntimeAuthHeaders()`: the helper supports legacy hosted Copilot compatibility and strict owned-service auth through one callsite; a later provider-kernel slice changed the default to strict for owned Mothership URLs and legacy only for hosted `copilot.sim.ai` URLs or explicit override.

Reviewer fixes applied:

1. Resume-store reviewer found terminal idempotency could accept a different terminal payload with the same status. Terminal idempotency now compares status, payload, and error.
2. Resume-store reviewer found a per-tool update miss could be swallowed after already mutating other rows. The store now aborts the transaction and returns `result_conflict`.
3. Route reviewer found the existing Sim stream lifecycle still hardcoded legacy `x-api-key`, which would 401 against strict owned runtime routes. The caller now uses the strict/legacy runtime header helper and has focused tests for both modes. Re-review passed with no functional/auth/security findings.

## Verification Performed For Durable Stream Event Foundation

Durable stream-event foundation checks run after adding the event table, owned event store, persist-before-enqueue writer, stable resume start sequencing, and fixing reviewer findings:

```bash
bun run --cwd apps/mothership test
bun run mship-service:check
bun run --cwd packages/db type-check
bun run check:migrations
bun run check:boundaries
bun run check:api-validation:strict
bun run type-check
```

Result: all commands passed. `mship-service:check` covered Biome, TypeScript, and 62 service tests. `type-check` passed 19/19 packages.

Durable stream-event fixes applied:

1. Added `copilot_run_events` with durable `run_id`, `stream_id`, `seq`, `cursor`, `event_type`, `request_id`, and raw `envelope` storage.
2. Added `resume_event_start_seq` on `copilot_run_checkpoints` so a resume response leg gets one stable sequence base across retries.
3. Added `appendMothershipRunEvents()` and `readMothershipRunEvents()` for DB-backed event append/read by stream sequence.
4. Event append uses `(streamId, seq)` uniqueness and treats duplicate inserts as idempotent only when the stored envelope matches the new logical event after ignoring volatile `ts` and `trace.requestId`.
5. Event append returns the stored durable envelope on idempotent conflicts; the stream writer enqueues that stored envelope, not a regenerated one.
6. Added `getLatestMothershipRunEventSeq()` for new forward-progress stream legs.
7. Added `getOrSetMothershipResumeEventStartSeq()` so resume retries reuse the original sequence base instead of appending duplicate logical events at newer seqs.
8. Added a Mothership stream writer that persists before enqueue, rejects duplicate terminals, and fails closed when closed without a terminal.
9. The current owned resume route still emits `run.resumed` then `error resume_continuation_not_implemented`, but those events now go through durable append and stable retry sequencing.

Reviewer fixes applied:

1. Reviewer found same-seq idempotent replay would fail because regenerated envelopes had new `ts` and `trace.requestId`. The event store now normalizes only those volatile fields for duplicate comparison and streams the stored durable envelope.
2. Reviewer found the writer always started at seq `1`, so resume could not append after a checkpoint stream history. The writer now accepts `startSeq` and defaults new legs from the latest durable seq.
3. Reviewer found default-latest seq would still make sequential retries append duplicate logical resume/error events. The resume route now stores one checkpoint-scoped `resume_event_start_seq` and passes it into the writer on every retry. Re-review passed.

## Verification Performed For Owned Runtime Route Skeletons

Owned `/api/copilot` and `/api/mothership` runtime route skeleton checks run after adding contract validation, Sim run-identity forwarding, durable run claiming, and honest unsupported-provider terminal streaming:

```bash
bun run --cwd apps/mothership test src/http.test.ts src/stream.test.ts src/state/run-store.test.ts
bun run --cwd apps/sim test lib/copilot/request/lifecycle/run.test.ts
bun run mship-service:check
bun run check:boundaries
bun run check:api-validation:strict
bun run check:migrations
bun run type-check
bun run mship-fixtures:check
```

Result: all commands passed. `mship-service:check` covered Biome, TypeScript, and 79 service tests. `type-check` passed 19/19 packages.

Runtime route fixes applied:

1. At the skeleton stage, shared runtime request contracts added optional `executionId` and `runId`, and Sim's lifecycle forwarded those fields on the initial runtime leg. The later route-parity slice tightened the stream runtime body contract to require `chatId`, `executionId`, and `runId`.
2. `apps/mothership` now accepts authenticated `POST /api/copilot` and `POST /api/mothership`, authenticates before parsing, validates the shared runtime body, requires durable `chatId + executionId + runId`, and claims the exact stream/run identity before opening SSE.
3. Claimed runtime runs reject cross-user stream conflicts, mismatched `runId`/`executionId`/`chatId`, and already-terminal `complete`/`cancelled` streams with JSON 409 responses before any SSE body is created.
4. At the skeleton stage, owned runtime routes deliberately marked the claimed run `error` and emitted a single durable `error` terminal with `owned_provider_continuation_not_implemented`. That was an honest terminal, not a fake provider completion; the later provider-kernel slice replaces it for the first Anthropic non-tool branch.
5. Reviewer found the first pass accepted same-user duplicate streams with different run identity and could produce a broken 200 SSE for terminal existing rows. Both are now rejected before status/event writes.

## Verification Performed For First Owned Provider Continuation Kernel

Owned provider continuation checks run after replacing the runtime unsupported terminal for the first Anthropic non-tool path, adding `/api/mothership/execute`, fixing strict-runtime header defaults for owned URLs, and resolving two quality-review passes:

```bash
bun run --cwd apps/mothership test src/http.test.ts src/stream.test.ts src/state/run-store.test.ts
bun run mship-service:check
bun run --cwd apps/sim test lib/mothership/service-auth.test.ts
bun run mship-client:check
bun run check:api-validation:strict
bun run check:boundaries
bun run type-check
git diff --check -- apps/sim/lib/mothership/service-auth.ts apps/sim/lib/mothership/service-auth.test.ts apps/sim/lib/core/config/env.ts apps/sim/.env.example docs/superpowers/plans/mothership-replacement-coverage-audit.md
```

Result: all commands passed. `mship-service:check` covered Biome, TypeScript, and 94 service tests. `mship-client:check` covered Biome, TypeScript, and 23 client tests. `type-check` passed 19/19 packages.

Provider kernel fixes applied:

1. Added `MOTHERSHIP_ANTHROPIC_API_KEY` as a service-local owned Mothership secret. Runtime request bodies do not carry provider API keys.
2. Added owned Anthropic text streaming for `POST /api/copilot`, `POST /api/mothership`, and `POST /api/mothership/execute` when the request selects Anthropic or a Claude model.
3. Preserved whitespace in streamed `text` deltas and emitted contract-valid `text`, `complete`, and `error` stream events through the durable writer.
4. Required Anthropic's `message_stop` terminal before emitting owned `complete`; truncated streams fail closed with `owned_provider_error`.
5. Sanitized non-2xx provider failures so raw provider response bodies are not streamed back to users.
6. Unsupported providers still emit an honest durable `owned_provider_continuation_not_implemented` terminal instead of a fake completion.
7. `complete`, `error`, and unsupported terminals now append the terminal event before mutating run status, then mutate run status before enqueueing the SSE event.
8. Successful provider completions mark durable runs `complete`; missing credentials, provider failures, truncated streams, and unsupported providers mark durable runs `error`.
9. Sim runtime auth now defaults to strict `x-mothership-runtime-key` for owned Mothership URLs and legacy `x-api-key` only for hosted `copilot.sim.ai` URLs or explicit legacy override.

Reviewer fixes applied:

1. The first provider pass could mark a truncated Anthropic stream complete. The provider now requires `message_stop` before `complete`.
2. The first provider pass defaulted Sim to legacy runtime auth even for owned local Mothership URLs. Header mode now auto-selects strict for owned URLs.
3. The first provider pass could leak raw non-2xx provider response bodies. The stream now reports only provider family plus status.
4. The first terminal-order fix still persisted unsupported status before appending the terminal event. The shared writer now supports `afterPersist`, and all runtime/provider unsupported, success, and error terminal paths use append-first ordering.
5. Reviewer-promoted route-parity tasks were moved into the next slice: runtime identity was tightened at the public body contract, and `generateChatTitleContract`/`forkChatContract` now have matching owned service routes.

## Verification Performed For Owned Route Parity And Runtime Contract Truth

Owned route-parity checks run after adding owned `POST /api/generate-chat-title`, owned `POST /api/chats/fork`, the service-local chat-fork verification seam, and required durable runtime identity in the shared stream body contract:

```bash
bun run --cwd apps/mothership test src/http.test.ts
bun run --cwd packages/mothership-client test src/client.test.ts
bunx biome check apps/mothership/src/http.ts apps/mothership/src/http.test.ts apps/mothership/src/provider-runtime.ts apps/mothership/src/state/chat-store.ts packages/mothership-contracts/src/routes/runtime.ts packages/mothership-client/src/client.test.ts
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run check:api-validation:strict
bun run check:boundaries
bun run type-check
git diff --check -- apps/mothership packages/mothership-contracts packages/mothership-client apps/sim/lib/mothership/service-auth.ts apps/sim/lib/mothership/service-auth.test.ts apps/sim/lib/core/config/env.ts apps/sim/.env.example docs/superpowers/plans/mothership-replacement-coverage-audit.md
```

Result: all commands passed before review handoff. `mship-service:check` covered Biome, TypeScript, and 99 service tests. `mship-client:check` covered Biome, TypeScript, and 23 client tests. `type-check` passed 19/19 packages.

Route-parity fixes applied:

1. Tightened `mothershipChatBodySchema` so `chatId`, `executionId`, and `runId` are required trimmed non-empty strings for stream runtime contracts.
2. Kept title and fork contracts identity-free because current Sim callers use them as non-stream service operations, not durable stream legs.
3. Added owned `POST /api/generate-chat-title` with runtime auth before parsing, shared body validation, service-local Anthropic credentials, sanitized provider errors, and contract-shaped `{ title }` success.
4. Added owned `POST /api/chats/fork` with runtime auth before parsing, shared body validation, DB ownership checks for source and new Mothership chat rows, and contract-shaped success.
5. Fork route returns `copied: false` because Sim already clones visible chat rows/messages before calling this service route and there is no separate owned conversation table to copy yet. This avoids a false success claim.
6. Focused tests cover title auth-before-parse, invalid title body before provider call, missing provider credentials, successful title generation, fork acknowledgement, invalid fork body before state access, source missing, new missing, and client-side runtime identity enforcement.

## Verification Performed For Owned Anthropic Tool Checkpoint And Resume Continuation

Owned Anthropic tool/resume checks run after replacing the resume not-implemented terminal with durable checkpoint pause and provider continuation behavior:

```bash
bun run --cwd apps/mothership test src/http.test.ts src/stream.test.ts src/state/run-store.test.ts src/state/resume-store.test.ts
bunx biome check apps/mothership/src/provider-runtime.ts apps/mothership/src/http.ts apps/mothership/src/http.test.ts apps/mothership/src/stream.ts apps/mothership/src/stream.test.ts apps/mothership/src/state/resume-store.ts apps/mothership/src/state/resume-store.test.ts apps/mothership/src/state/run-store.ts apps/mothership/src/state/run-store.test.ts
bun run mship-service:check
```

Result: all commands passed. `mship-service:check` covered Biome, TypeScript, and 109 service tests.

Tool/resume fixes applied:

1. The owned Anthropic provider kernel now passes Anthropic-shaped `integrationTools` and `mothershipTools` through to `/v1/messages` using the existing Sim payload shape.
2. The Anthropic SSE parser now accumulates `tool_use` content blocks, waits for complete `input_json_delta` JSON, records `message_delta.stop_reason`, and fails closed for malformed tool inputs.
3. When Anthropic stops with `tool_use`, `apps/mothership` persists a checkpoint and running async tool rows, emits contract-valid `tool` call events with `executor: sim` and `mode: async`, then emits `run.checkpoint_pause`.
4. `run.checkpoint_pause` is now a valid owned-service stream-leg terminal. The writer still rejects missing terminals and duplicate terminals.
5. The checkpoint provider request stores the original Anthropic request, execution ID, and assistant content blocks, so `/api/tools/resume` can reconstruct the required Anthropic conversation sequence.
6. Valid resume results now emit `run.resumed`, emit durable `tool` result events for success/error/cancelled outcomes, append Anthropic `tool_result` blocks as the next user message, and continue streaming text/complete/error from the provider.
7. Successful resumed continuations mark the run `complete`; provider errors still append an `error` terminal before mutating run status.
8. Async tool-row insertion is idempotent on `toolCallId` so duplicate delivery does not crash on the unique index.

## Verification Performed For Owned Pause-Only Stream Fixture Policy

Fixture policy checks run after making `run.checkpoint_pause` a valid stream-leg terminal and adding a pause-only owned service fixture:

```bash
bun run mship-fixtures:check
```

Result: the command passed. The valid fixture set now includes `tool-checkpoint-pause.sse`, `tool-checkpoint-multi-pause.sse`, `tool-checkpoint-failed-result-complete.sse`, `tool-checkpoint-cancelled-result-complete.sse`, and `tool-checkpoint-resume-next-pause.sse`; the invalid fixture set rejects `duplicate-checkpoint-terminal.sse` when a `complete` appears after a checkpoint pause without an intervening `run.resumed`.

Fixture-policy fixes applied:

1. `scripts/check-mothership-stream-fixtures.ts` now validates terminal events per stream leg, not per whole file.
2. `complete`, `error`, and `run.checkpoint_pause` end a stream leg.
3. `run.resumed` starts the next leg after a checkpoint pause.
4. Full lifecycle fixtures with `checkpoint_pause -> resumed -> complete` remain valid.
5. Pause-only owned service legs are now valid golden fixtures.
6. Multi-tool pause, failed tool-result completion, cancelled tool-result completion, and repeated tool-use-after-resume pause are covered by golden fixtures and Sim read-loop replay.

## Verification Performed For Durable Replay Serving

Durable replay serving checks run after adding replay contracts, route handling, SSE replay responses, ownership checks, cursor validation, and reviewer-requested contract mode separation:

```bash
bun run --cwd apps/mothership test src/http.test.ts src/stream.test.ts src/state/stream-event-store.test.ts
bun run mship-service:check
bun run --cwd packages/mothership-contracts type-check
bun run check:boundaries
bun run check:api-validation:strict
bun run type-check
bun run mship-fixtures:check
git diff --check
```

Result: all commands passed after formatting and reviewer fixes. `mship-service:check` covered Biome, TypeScript, and 86 service tests. `type-check` passed 19/19 packages.

Replay serving fixes applied:

1. Added owned authenticated `GET /api/streams/replay` in `apps/mothership`.
2. Auth and run ownership checks happen before event reads, so callers cannot replay another user's stream.
3. Cursor parsing rejects unsafe or invalid cursors with `400 invalid_cursor` before any event read.
4. JSON batch mode returns stored durable event envelopes plus run status and chat ID.
5. SSE mode streams stored durable event envelopes without appending new events or faking live tail behavior.
6. Shared contracts split the same path into mode-specific query contracts: stream replay rejects `batch=true`, and batch replay requires `batch=true`.
7. The route is intentionally replay-only. It does not perform live tailing, prove process-restart E2E behavior, or replace unsupported-provider terminals with real provider continuation.

## Verification Performed For Sim Strict-Mode Replay Consumption

Sim strict-mode replay consumption checks run after wiring the browser-facing chat stream replay route to the owned Mothership replay contract:

```bash
bun run --cwd apps/sim test app/api/copilot/chat/stream/route.test.ts
bunx biome check apps/sim/app/api/copilot/chat/stream/route.ts apps/sim/app/api/copilot/chat/stream/route.test.ts
bun run --cwd apps/sim type-check
bun run type-check
bun run check:api-validation:strict
bun run check:boundaries
git diff --check -- apps/sim/app/api/copilot/chat/stream/route.ts apps/sim/app/api/copilot/chat/stream/route.test.ts docs/superpowers/plans/mothership-replacement-coverage-audit.md apps/mothership/src/http.test.ts
```

Result: all commands passed before reviewer handoff and after reviewer fix. The focused route suite covered 9 tests.

Strict-mode replay consumption fixes applied:

1. Added a typed replay source helper inside `apps/sim/app/api/copilot/chat/stream/route.ts`.
2. Legacy runtime mode still reads local Redis outbox events through `readEvents`.
3. Strict runtime mode uses `requestMothershipRuntime(streamReplayBatchContract)` against the resolved Mothership base URL, so replay uses strict `x-mothership-runtime-key` auth instead of the legacy `x-api-key` adapter.
4. Owned replay event envelopes are validated with Sim's existing `parsePersistedStreamEventEnvelope` before the browser-facing route returns or streams them.
5. Batch replay merges owned events/status/chat ID with local preview sessions, preserving the local route's browser response shape.
6. SSE replay flushes owned durable events through the existing local SSE response path and stops when the owned replay includes a terminal event.
7. Strict mode skips the old local Redis replay-gap check because Redis is not authoritative once the owned service is the replay source.
8. The local `/api/mothership/chat/stream` route still delegates to `/api/copilot/chat/stream`, so the Mothership UI path gets the same strict replay behavior.
9. Reviewer found strict owned replay could truncate after the owned route's default page size and still expose terminal run status. Strict replay now requests `limit=1000`, paginates until a short page or terminal event, advances by parsed stream sequence, and rejects non-advancing cursors.
10. Owned replay envelopes are parsed before returning to the browser; invalid owned envelopes produce a fail-closed 500 instead of leaking malformed SSE/batch data.

## Verification Performed For Mothership Restart Replay Smoke

The restart replay smoke path was added in `apps/mothership/src/smoke/restart-replay.ts` and exposed as `bun run smoke:restart-replay` from `apps/mothership`.

Smoke behavior:

1. Requires `DATABASE_URL` and refuses to run if `copilot_run_events` is missing.
2. Seeds an isolated user, workspace, Copilot chat, run, and two durable replay events.
3. Starts a real `apps/mothership` Node HTTP server and verifies batch replay returns both events.
4. Stops that server, starts a fresh server process object against the same database, and verifies replay after cursor `1` returns the remaining event.
5. Cleans up the seeded workspace/user rows.

Commands run:

```bash
bunx biome check apps/mothership/src/smoke/restart-replay.ts apps/mothership/package.json
bun run --cwd apps/mothership type-check
bun install --lockfile-only
bun --env-file=../sim/.env run smoke:restart-replay
createdb sim_mship_smoke_codex_20260621_0001
DATABASE_URL=postgresql://kyin@localhost:5432/sim_mship_smoke_codex_20260621_0001 bun run db:migrate
DATABASE_URL=postgresql://kyin@localhost:5432/sim_mship_smoke_codex_20260621_0001 bun run smoke:restart-replay
dropdb sim_mship_smoke_codex_20260621_0001
```

Result: the normal local `simstudio` DB correctly refused the smoke because `copilot_run_events` is not migrated there. The isolated temporary DB migrated successfully, the smoke passed, and the temporary DB was dropped.

## Verification Performed For Owned BYOK Admin Storage

Owned BYOK admin storage checks run after adding admin-key-gated `GET`/`POST`/`DELETE /api/admin/byok` routes backed by `workspace_byok_keys`:

```bash
bun run --cwd apps/mothership test src/http.test.ts src/env.test.ts src/state/byok-store.test.ts
bun run mship-service:check
```

Result: the focused route/env/store tests passed, and the full Mothership service gate passed with 7 test files and 129 tests. The route family rejects missing admin keys, rejects runtime keys on admin routes, authenticates before parsing malformed JSON, validates authenticated POST bodies, requires `MOTHERSHIP_ADMIN_API_KEY` and `ENCRYPTION_KEY` in production, lists configured providers without exposing encrypted values, upserts encrypted provider keys using the shared AES-GCM format, deletes provider keys by workspace/provider, and fails closed with `encryption_not_configured` if an authenticated write lacks encryption configuration.

## Verification Performed For Sim BYOK Admin Proxy Migration

Sim BYOK proxy checks run after moving `/api/copilot/byok` to hosted legacy admin compatibility for `copilot.sim.ai` and strict admin auth for owned Mothership URLs:

```bash
bun run --cwd apps/sim test lib/mothership/service-auth.test.ts app/api/copilot/byok/route.test.ts
bunx biome check apps/sim/lib/mothership/service-auth.ts apps/sim/lib/mothership/service-auth.test.ts apps/sim/app/api/copilot/byok/route.ts apps/sim/app/api/copilot/byok/route.test.ts
```

Result: the focused Sim tests passed. Hosted Copilot admin targets still receive legacy `x-api-key` runtime-key compatibility, owned Mothership admin targets receive strict `x-mothership-admin-key`, source-env forwarding is preserved, upstream opaque/empty responses are still forwarded, and configuration failures return explicit 500 responses before fetch.

## Verification Performed For Owned Validate-Key API-Key Storage

Owned validate-key storage checks run after adding runtime-authenticated `POST /api/validate-key/get-api-keys`, `POST /api/validate-key/generate`, and `POST /api/validate-key/delete` routes backed by `api_key` personal rows:

```bash
bun run --cwd apps/mothership test src/state/api-key-store.test.ts src/http.test.ts src/env.test.ts
bun run --cwd apps/mothership type-check
bunx biome check apps/mothership/src/state/api-key-store.ts apps/mothership/src/state/api-key-store.test.ts apps/mothership/src/http.ts apps/mothership/src/http.test.ts apps/mothership/src/env.ts apps/mothership/src/env.test.ts apps/sim/app/api/copilot/api-keys/route.ts apps/sim/app/api/copilot/api-keys/route.test.ts
bun run mship-service:check
bun run --cwd apps/sim test app/api/copilot/api-keys/route.test.ts
bun run --cwd apps/sim test lib/mothership/client.test.ts lib/mothership/service-auth.test.ts app/api/copilot/api-keys/route.test.ts app/api/copilot/api-keys/generate/route.test.ts app/api/copilot/byok/route.test.ts
bun run mship:check
bun run check:api-validation
```

Result: focused Mothership route/env/store tests passed with 3 files and 89 tests; full Mothership service gate passed with 8 files and 143 tests; focused Sim API-key proxy tests passed with 1 file and 17 tests; the Sim client/auth/API-key/BYOK focused set passed with 5 files and 53 tests; `mship:check` and the API validation audit passed. The owned route family rejects missing runtime auth before parsing malformed JSON, rejects admin-key headers on runtime validate-key routes, lists display-only key values without plaintext secret material, encrypts generated keys at rest with `API_ENCRYPTION_KEY`, requires that key for authenticated generation, deletes only owner-scoped personal API keys, and returns a contract-valid 404 for delete misses. The Sim proxy now preserves owned `displayKey` values while retaining hosted legacy masking from `apiKey`. A spec-review failure found that `requestMothershipRuntime` still defaulted to legacy wire auth unless `MOTHERSHIP_RUNTIME_HEADER_MODE=strict` was set; the client now chooses strict runtime auth from the actual owned `baseUrl` by default and keeps legacy only for hosted `copilot.sim.ai` URLs or explicit legacy override. A code-quality review failure found the generate-route test still expected legacy `x-api-key` for an owned-like URL; that regression guard now expects strict `x-mothership-runtime-key` and is included in the focused gate.

## Verification Performed For Mothership-To-Sim API-Key Entitlement Preflight

Mothership-to-Sim API-key entitlement checks run after wiring initial runtime streams to Sim's strict `/api/copilot/api-keys/validate` callback:

```bash
bun install --lockfile-only
bun run --cwd apps/mothership test src/callbacks.test.ts src/http.test.ts src/env.test.ts
bun run --cwd packages/mothership-client test src/client.test.ts
bun run --cwd packages/mothership-contracts type-check
bun run --cwd apps/mothership type-check
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run mship:check
bun run check:api-validation
bun run check:boundaries
bun run type-check
bunx biome check apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts apps/mothership/src/http.ts apps/mothership/src/http.test.ts apps/mothership/src/env.ts apps/mothership/src/env.test.ts apps/mothership/package.json packages/mothership-contracts/src/routes/runtime.ts packages/mothership-client/src/client.test.ts apps/sim/app/api/copilot/chat/route.ts apps/sim/app/api/mothership/chat/route.ts docs/superpowers/plans/mothership-replacement-coverage-audit.md bun.lock
git diff --check -- apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts apps/mothership/src/http.ts apps/mothership/src/http.test.ts apps/mothership/src/env.ts apps/mothership/src/env.test.ts apps/mothership/package.json packages/mothership-contracts/src/routes/runtime.ts packages/mothership-client/src/client.test.ts apps/sim/app/api/copilot/chat/route.ts apps/sim/app/api/mothership/chat/route.ts docs/superpowers/plans/mothership-replacement-coverage-audit.md bun.lock
```

Result: focused Mothership route/env/callback tests passed with 3 files and 95 tests; the focused Mothership client test passed with 16 tests; package contract type-check passed; `apps/mothership` type-check passed; the full Mothership service gate passed with 9 files and 154 tests; the Mothership client gate passed with 2 files and 24 tests; contract sync, generated contract check, API validation audit, monorepo boundary check, full type-check, targeted Biome check, and whitespace diff check passed. The callback helper sends `x-sim-callback-key` only, never legacy `x-api-key`, to Sim's empty-response callback contract. Missing `MOTHERSHIP_TO_SIM_CALLBACK_KEY` or `SIM_BASE_URL` fails closed without fetch. Initial runtime stream routes require contract-valid trimmed non-empty `workspaceId`, call the Sim entitlement callback before durable run claim/provider/SSE, map Sim callback rejections to explicit failures, and do not write run/events when entitlement fails. Verification also fixed two existing wrapped-GET delegation callsites so full type-check stays green.

## Verification Performed For Mothership-To-Sim Billing Callback Emission

Owned Anthropic billing callback checks run after adding Mothership-to-Sim `update-cost` callback emission to text, checkpoint-pause, and resume-complete provider paths:

```bash
bun run --cwd apps/mothership test src/callbacks.test.ts src/http.test.ts
bun run --cwd apps/sim test lib/mothership/service-auth.test.ts app/api/billing/update-cost/route.test.ts app/api/copilot/byok/validate/route.test.ts app/api/copilot/api-keys/validate/route.test.ts
bun run --cwd apps/mothership type-check
bunx biome check apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts apps/mothership/src/provider-runtime.ts apps/mothership/src/http.ts apps/mothership/src/http.test.ts
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run mship:check
bun run check:api-validation
bun run check:boundaries
bun run type-check
bunx biome check apps/sim/lib/mothership/service-auth.ts apps/sim/lib/mothership/service-auth.test.ts apps/sim/lib/core/config/env.ts helm/sim/values.yaml helm/sim/examples/values-copilot.yaml helm/sim/values.schema.json apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts apps/mothership/src/provider-runtime.ts apps/mothership/src/http.ts apps/mothership/src/http.test.ts packages/mothership-client/src/client.ts packages/mothership-client/src/client.test.ts packages/mothership-client/src/auth.test.ts packages/mothership-contracts/src/auth.ts docs/superpowers/plans/mothership-backend-replacement-execution-plan.md docs/superpowers/plans/mothership-secret-boundaries.md docs/superpowers/plans/mothership-replacement-coverage-audit.md
git diff --check -- apps/sim/lib/mothership/service-auth.ts apps/sim/lib/mothership/service-auth.test.ts apps/sim/lib/core/config/env.ts helm/sim/values.yaml helm/sim/examples/values-copilot.yaml helm/sim/values.schema.json apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts apps/mothership/src/provider-runtime.ts apps/mothership/src/http.ts apps/mothership/src/http.test.ts packages/mothership-client/src/client.ts packages/mothership-client/src/client.test.ts packages/mothership-client/src/auth.test.ts packages/mothership-contracts/src/auth.ts docs/superpowers/plans/mothership-backend-replacement-execution-plan.md docs/superpowers/plans/mothership-secret-boundaries.md docs/superpowers/plans/mothership-replacement-coverage-audit.md
```

Result: focused Mothership callback/provider tests passed with 2 files and 88 tests; focused Sim callback auth/route tests passed with 4 files and 41 tests; `apps/mothership` type-check passed; targeted Biome passed; the full Mothership service gate passed with 9 files and 159 tests; the Mothership client gate passed with 2 files and 23 tests; contract sync, generated contract check, API validation audit, monorepo boundary check, full type-check, targeted doc/code Biome check, and whitespace diff check passed. Billing callback emission uses the strict `x-sim-callback-key` header, never `x-api-key`, and treats Sim's duplicate 409 response as idempotent success. Sim callback routes no longer have a legacy `x-api-key` compatibility flag or client mode. Owned Anthropic streams now send cumulative usage/cost to Sim before terminal complete or checkpoint-pause persistence; callback failure produces an honest error terminal and does not mark the run complete.

## Verification Performed For Durable Billing Callback Outbox

Durable billing callback outbox checks run after deciding that billing callbacks can be retried asynchronously, while API-key/BYOK entitlement callbacks must remain synchronous because they authorize key use and tool-result mutation:

```bash
bun run --cwd apps/mothership test src/callbacks.test.ts src/state/callback-outbox.test.ts
bun run --cwd apps/mothership test src/callbacks.test.ts src/state/callback-outbox.test.ts src/http.test.ts
bun run --cwd apps/mothership test src/callbacks.test.ts src/state/callback-outbox.test.ts src/provider-runtime.test.ts src/http.test.ts
bun run --cwd apps/mothership type-check
bunx biome check apps/mothership/src/http.ts apps/mothership/src/http.test.ts apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts apps/mothership/src/state/callback-outbox.ts apps/mothership/src/state/callback-outbox.test.ts packages/mothership-contracts/src/routes/admin.ts docs/superpowers/plans/mothership-replacement-coverage-audit.md
bun run --cwd apps/mothership --env-file ../../packages/db/.env smoke:callback-outbox
bun --env-file=packages/db/.env -e 'import postgres from "postgres"; const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 5 }); const rows = await sql`select count(*)::int as count from outbox_event where id like ${"mship-outbox-smoke-%"}`; console.log(`smoke_rows_remaining=${rows[0].count}`); await sql.end({ timeout: 5 });'
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run mship:check
bun run check:api-validation
bun run check:boundaries
bun run type-check
```

Result: focused callback/outbox tests passed with 2 files and 27 tests; callback/outbox/provider-runtime/HTTP tests passed with 3 files and 124 tests; `apps/mothership` type-check passed; targeted Biome passed; real-Postgres billing outbox smoke passed against the local migrated database from `packages/db/.env`; post-smoke cleanup verification returned `smoke_rows_remaining=0`; full Mothership service gate passed with 10 files and 200 tests; Mothership client gate passed with 2 files and 23 tests; Mothership contract sync/check, aggregate Mothership contract generation check, API validation audit, monorepo boundary check, and full repo type-check passed. `apps/mothership` now writes a durable `outbox_event` billing row before attempting Sim's `update-cost` callback, stores only billing payload fields and no callback secret, gives immediate by-id delivery a 30-second head start before batch workers may claim new rows, immediately claims/delivers the row with current env credentials, validates persisted callback payloads before delivery, marks invalid persisted payloads dead-lettered instead of retry-churning, marks `200` and duplicate `409` responses completed, leaves non-success callback attempts retryable with bounded backoff metadata, reclaims stale processing leases for crashed workers, exposes an admin-key-gated processor endpoint at `POST /api/admin/callbacks/billing/process`, and reports dead-lettered versus retryable versus lease-lost processor outcomes separately. The real-Postgres smoke proves a held first-row lock is skipped with `FOR UPDATE SKIP LOCKED`, stale `lockedAt` leases cannot complete or retry another worker's claim, current leases can complete, and current retry leases reschedule with attempts/lock metadata preserved. Billing misconfiguration fails closed before enqueueing an outbox row. API-key and BYOK entitlement callbacks do not enqueue outbox rows and remain synchronous fail-closed by design. A tested pending-outbox processor helper and HTTP endpoint exist; chart-level owned Mothership deployment/CronJob scheduling is not claimed here and remains a P2-11 task.

## Verification Performed For Mothership-To-Sim BYOK Validation Callback Use

Owned Anthropic BYOK validation checks run after wiring the provider runtime to Sim's strict `/api/copilot/byok/validate` callback and storage-backed `workspace_byok_keys` lookup:

```bash
bun run --cwd apps/mothership test src/callbacks.test.ts src/state/byok-store.test.ts src/http.test.ts
bun run --cwd apps/mothership type-check
bunx biome check apps/mothership/src/provider-runtime.ts apps/mothership/src/http.test.ts apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts apps/mothership/src/state/byok-store.ts apps/mothership/src/state/byok-store.test.ts
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run mship:check
bun run check:api-validation
bun run check:boundaries
bun run type-check
git diff --check -- docs/superpowers/plans/mothership-replacement-coverage-audit.md apps/mothership/src/provider-runtime.ts apps/mothership/src/http.test.ts apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts apps/mothership/src/state/byok-store.ts apps/mothership/src/state/byok-store.test.ts
```

Result: focused Mothership callback/BYOK-store/provider tests passed with 3 files and 106 tests; full Mothership service gate passed with 9 files and 173 tests; Mothership client gate passed with 2 files and 23 tests; contract sync/check, API validation audit, monorepo boundary check, aggregate Mothership contract generation check, full repo type-check, targeted Biome, and whitespace diff check passed. The BYOK callback helper sends `x-sim-callback-key` only, never legacy `x-api-key`, to Sim's empty-response callback contract. Initial `/api/mothership` and `/api/mothership/execute` Anthropic streams with `enterpriseByokEligible: true` must receive Sim BYOK authorization before decrypting and using a workspace Anthropic key. Initial BYOK callback rejection falls back to the hosted Mothership key and hosted billing instead of using an unauthorized BYOK key. Checkpoints persist `credentialSource`; a resumed run that was already using BYOK must revalidate BYOK, reload the workspace key, avoid hosted billing, and fail closed instead of silently switching billing source if BYOK can no longer be loaded.

## Verification Performed For API-Key Resume Tool-Result Entitlement

Owned resume entitlement checks run after wiring `POST /api/tools/resume` to Sim's strict `/api/copilot/api-keys/validate` callback before durable tool-result recording:

```bash
bun run --cwd apps/mothership test src/http.test.ts
bun run --cwd apps/mothership test src/callbacks.test.ts src/state/byok-store.test.ts src/http.test.ts
bun run --cwd apps/mothership type-check
bunx biome check apps/mothership/src/http.ts apps/mothership/src/http.test.ts apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts apps/mothership/src/state/byok-store.ts apps/mothership/src/state/byok-store.test.ts docs/superpowers/plans/mothership-replacement-coverage-audit.md
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run check:api-validation
bun run check:boundaries
```

Additional reviewer-promoted checks run after tightening the resume entitlement invariant:

```bash
bun run --cwd apps/mothership test src/state/resume-store.test.ts
bun run --cwd apps/mothership test src/http.test.ts
bun run --cwd apps/mothership type-check
bunx biome check apps/mothership/src/provider-runtime.ts apps/mothership/src/http.ts apps/mothership/src/http.test.ts apps/mothership/src/state/resume-store.ts apps/mothership/src/state/resume-store.test.ts
bun run --cwd apps/mothership test src/callbacks.test.ts src/state/byok-store.test.ts src/provider-runtime.test.ts src/http.test.ts
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run check:api-validation
bun run check:boundaries
bun run mship:check
bun run type-check
```

Result: focused resume-store tests passed with 17 tests, focused HTTP tests passed with 93 tests, focused callback/BYOK-store/provider/HTTP tests passed with 3 files and 114 tests, and `apps/mothership` type-check passed. Targeted Biome passed. The full Mothership service gate passed with 9 files and 182 tests; the Mothership client gate passed with 2 files and 23 tests; contract sync/check, API validation audit, monorepo boundary check, aggregate Mothership contract generation check, and full repo type-check passed. The resume route now authenticates the runtime caller and parses the request, performs a read-only checkpoint lookup, rejects missing/non-resumable checkpoints before callback or mutation, requires durable `copilot_runs.workspace_id`, rejects caller-supplied workspace conflicts, rejects malformed stored owned-provider resume requests before entitlement callbacks or tool-result mutation, calls Sim's API-key validation callback with `x-sim-callback-key`, and records tool results only after entitlement succeeds with the same workspace rechecked inside the transaction. Retry-flagged provider stream failures now bubble the stream error without appending a terminal error or marking the run failed, leaving the checkpoint/run retryable for the next attempt.

Additional sequence-coordination checks run after closing the reviewer-promoted stale resume producer gap:

```bash
bun run --cwd apps/mothership test src/state/resume-store.test.ts
bun run --cwd apps/mothership test src/http.test.ts -t "resume"
bun run --cwd apps/mothership test src/stream.test.ts
bun run mship-service:check
bunx biome check apps/mothership/src/state/resume-store.ts apps/mothership/src/state/resume-store.test.ts apps/mothership/src/http.ts apps/mothership/src/http.test.ts apps/mothership/src/provider-runtime.ts apps/mothership/src/stream.ts apps/mothership/src/stream.test.ts
```

Result: focused resume-store tests passed with 19 tests, focused HTTP resume tests passed with 19 tests, focused stream tests passed with 11 tests, targeted Biome passed, and the full Mothership service gate passed with 10 files and 206 tests. Resume result recording now reserves `resumeEventStartSeq` inside the same durable transaction that claims the run for resuming and records tool results; the HTTP route uses that returned start sequence and no longer performs a separate latest-seq read before streaming. A checkpoint whose run is already `resuming` is rejected before entitlement callbacks, result writes, provider fetch, or billing. Stream persistence failures are now typed and rethrown by provider continuations instead of being converted into a synthetic provider-error event at a later sequence, so a first resume append conflict fails before Anthropic fetch or billing work and releases the run back to `paused_waiting_for_tool`. Resume tool-result rows are marked `delivered` only after the tool-result stream event is durably persisted. For retryable resumes, delivery is deferred until the terminal complete/checkpoint-pause event persists and happens before the terminal run-status mutation, preserving retryability after provider stream failures while preventing stale checkpoint replay after a successful retryable pause-again continuation. Spec review passed, code-quality review initially found stale-checkpoint and retryability holes, and final re-review passed after those fixes.

## Strict-Mode E2E Preflight

Strict-mode browser/provider E2E was preflighted on 2026-06-21 without printing secret values. The runnable preflight gate now lives at `apps/mothership/src/smoke/strict-e2e-preflight.ts` and is exposed as `bun run --cwd apps/mothership smoke:strict-e2e-preflight`.

```bash
bun run --cwd apps/mothership smoke:strict-e2e-preflight
```

Result: the current process environment is blocked for real strict-mode E2E. The preflight reports missing `DATABASE_URL`, `SIM_AGENT_API_URL`, `SIM_BASE_URL`, `SIM_TO_MOTHERSHIP_API_KEY`, `MOTHERSHIP_ADMIN_API_KEY`, `MOTHERSHIP_TO_SIM_CALLBACK_KEY`, `MOTHERSHIP_ANTHROPIC_API_KEY`, and `MOTHERSHIP_OPENAI_API_KEY` without printing secret values. The project env files checked in this run only expose `DATABASE_URL` through `apps/sim/.env` and `packages/db/.env`; `apps/mothership/.env` is not present. Real strict-mode Sim-to-owned-`apps/mothership` provider/tool/subagent E2E remains blocked until the preflight passes against matching Sim/Mothership secrets, owned `SIM_AGENT_API_URL`, `SIM_BASE_URL`, a live Mothership `/health` plus authenticated `/ready`, and real provider keys.

## Verification Performed For Owned Mothership Helm Target

Owned Mothership deployment target checks run after adding `docker/mothership.Dockerfile`, Helm `mothership.server` values/schema/templates, strict secret-ownership validators, Mothership-only Secret/ExternalSecret rendering, app auto-targeting to the internal Mothership service, NetworkPolicy/PDB integration, docs/examples, and Helm unit-test fixtures:

```bash
bun -e 'import { readFileSync } from "node:fs"; import { globSync } from "glob"; import YAML from "yaml"; const files = ["helm/sim/values.yaml", ...globSync("helm/sim/examples/*.yaml"), ...globSync("helm/sim/tests/*.yaml")].sort(); for (const file of files) YAML.parse(readFileSync(file, "utf8")); JSON.parse(readFileSync("helm/sim/values.schema.json", "utf8")); console.log(`parsed_yaml_files=${files.length}`); console.log("helm/sim/values.schema.json: ok");'
bunx biome check helm/sim/templates/_helpers.tpl helm/sim/templates/deployment-app.yaml helm/sim/templates/deployment-realtime.yaml helm/sim/templates/deployment-mothership.yaml helm/sim/templates/statefulset-postgresql.yaml helm/sim/values.schema.json helm/sim/tests/mothership_test.yaml docker/mothership.Dockerfile apps/mothership/src/smoke/callback-outbox-concurrency.ts apps/mothership/package.json
git diff --check -- helm/sim/templates/_helpers.tpl helm/sim/templates/deployment-app.yaml helm/sim/templates/deployment-realtime.yaml helm/sim/templates/deployment-mothership.yaml helm/sim/templates/statefulset-postgresql.yaml helm/sim/values.yaml helm/sim/values.schema.json helm/sim/tests/mothership_test.yaml helm/sim/README.md helm/sim/examples/values-mothership.yaml helm/sim/examples/values-production.yaml helm/sim/examples/values-azure.yaml helm/sim/examples/values-external-db.yaml helm/sim/examples/values-development.yaml helm/sim/examples/values-aws.yaml helm/sim/examples/values-gcp.yaml helm/sim/examples/values-whitelabeled.yaml
/tmp/sim-helm-verify/darwin-arm64/helm lint helm/sim <required production-shaped --set values>
/tmp/sim-helm-verify/darwin-arm64/helm template t helm/sim --namespace sim <required production-shaped --set values>
/tmp/sim-helm-verify/darwin-arm64/helm template t helm/sim --namespace sim <mothership.enabled=true production-shaped --set values>
bun -e '<parse rendered manifests and assert app SIM_AGENT_API_URL/strict mode, Mothership explicit shared-key secretKeyRefs, no full app/db envFrom on Mothership, Mothership-only Secret ownership, and Deployment-level Reloader annotation>'
bun -e '<direct Helm negative/positive assertions for app.env/realtime.env provider-key leaks, Mothership shared-key leaks, existingSecret custom key mappings, ESO provider-key app remote-ref leaks, and ESO routing override no-shadow>'
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run mship:check
bun run check:api-validation
bun run check:boundaries
bun run type-check
bunx turbo prune @sim/mothership --docker --out-dir /tmp/sim-mothership-prune
docker version --format '{{.Server.Version}}'
```

Result: Helm YAML/JSON parsing passed for 22 values/examples/tests files plus the schema. Targeted Biome and whitespace diff checks passed. Helm v3.15.4 was downloaded to `/tmp` only and used for local verification; `helm lint` passed for default and `mothership.enabled=true` values, and `helm template` rendered both paths. Render assertions proved the app defaults to the internal Mothership URL plus strict runtime header mode, Mothership pins shared boundary keys and DB password through explicit `secretKeyRef`s, Mothership no longer mounts the full app or database Secrets via `envFrom`, the Mothership-only Secret contains `SIM_BASE_URL` and not shared encryption keys, and the Stakater Reloader annotation is on Deployment metadata while Helm checksum annotations remain on pod template metadata. Direct Helm negative assertions proved Mothership-only keys fail from `app.env`, `realtime.env`, and `externalSecrets.remoteRefs.app`, shared boundary keys fail from Mothership-only env surfaces, ESO routing overrides are not shadowed by inline defaults, and existingSecret custom key mappings materialize as canonical env vars. `mship-service:check`, `mship-client:check`, `mship-contracts:check`, `mship:check`, API validation, monorepo boundaries, full type-check, and Docker prune graph verification passed. Docker build remains unverified because the local Docker daemon is unavailable at `/Users/kyin/.colima/default/docker.sock`.

Reviewer fixes applied:

1. Chart mechanics reviewer found dead existingSecret key mapping, ESO rollout checksum gaps, existing-secret auto-targeting drift, Mothership schema drift, and Reloader annotation misplacement. Fixes were applied and re-reviewed PASS.
2. Security reviewer found Mothership-only provider secrets could leak into app/realtime shared Secret surfaces and shared boundary keys could drift through Mothership env surfaces. Fixes now reject misplaced keys, stop mounting the full app/db Secrets into Mothership, and pin only required boundary keys explicitly. Re-review PASS.

## Verification Performed For Mothership Billing Processor CronJob

Owned Mothership processor checks run after adding the Helm CronJob that calls `POST /api/admin/callbacks/billing/process`, adding `failOnNonClean` route behavior, separating processor selectors from Mothership service selectors, and adding processor egress NetworkPolicy:

```bash
bun run --cwd apps/mothership test src/http.test.ts -t "billing callback processor"
bun -e '<parse helm/sim values, examples, tests, and values.schema.json>'
/tmp/sim-helm-verify/darwin-arm64/helm lint helm/sim <mothership.enabled=true + processor + networkPolicy production-shaped --set values>
/tmp/sim-helm-verify/darwin-arm64/helm template t helm/sim --namespace sim <mothership.enabled=true + processor + networkPolicy production-shaped --set values>
bun -e '<assert processor CronJob body/header/internal URL, failOnNonClean default, retry defaults, selector isolation from Mothership Service, Mothership ingress allowance, and dedicated processor egress NetworkPolicy>'
bun -e '<assert failOnNonClean=false renders false>'
bun -e '<assert existingSecret boundary refs are secretKeyRef only and ESO wins over stale existingSecret names>'
bun -e '<assert activeDeadlineSeconds validation fails below retryAttempts*timeoutSeconds + (retryAttempts-1)*retryDelaySeconds>'
bunx biome check apps/mothership/src/http.ts apps/mothership/src/http.test.ts packages/mothership-contracts/src/routes/admin.ts helm/sim/values.schema.json
git diff --check -- apps/mothership/src/http.ts apps/mothership/src/http.test.ts packages/mothership-contracts/src/routes/admin.ts helm/sim/templates/_helpers.tpl helm/sim/templates/cronjob-mothership-billing-processor.yaml helm/sim/templates/networkpolicy.yaml helm/sim/values.yaml helm/sim/values.schema.json helm/sim/tests/mothership_test.yaml helm/sim/examples/values-mothership.yaml helm/sim/README.md
bun run mship-service:check
bun run mship-client:check
bun run mship-contracts:check
bun run mship:check
bun run check:api-validation:strict
bun run check:boundaries
bun run type-check
bunx turbo prune @sim/mothership --docker --out-dir /tmp/sim-mothership-prune
docker version --format '{{.Server.Version}}'
```

Result: focused HTTP tests passed with 5 billing-processor tests and `mship-service:check` passed with 10 files and 202 tests. Helm lint/template/render assertions passed for default, owned Mothership, and owned Mothership plus processor modes. Render assertions proved the processor sends `x-mothership-admin-key`, calls the internal owned Mothership service URL, sends `{"batchSize":25,"failOnNonClean":true}` by default, preserves `failOnNonClean:false` when explicitly configured, uses shell-loop retry authority with `restartPolicy: Never` and `backoffLimit: 0`, rejects too-low `activeDeadlineSeconds`, does not match the Mothership Service selector, is allowed by the Mothership NetworkPolicy ingress rule, and is isolated by its own egress NetworkPolicy to Mothership port `6891` plus DNS. ExistingSecret render assertions proved shared boundary keys are no longer inlined into Mothership/processor pod specs, and ESO render assertions proved ESO-owned app Secrets win over stale existingSecret names. `mship-client:check`, `mship-contracts:check`, aggregate `mship:check`, strict API validation, monorepo boundaries, full type-check, and Docker prune graph verification passed. Docker build remains unverified because the local Docker daemon is unavailable at `/Users/kyin/.colima/default/docker.sock`.

Reviewer fixes applied:

1. Operability reviewer found the processor pod matched the Mothership Service selector, `200` did not imply a clean processor batch, retry authority was ambiguous, boolean `false` was lost through Sprig `default`, and schema docs omitted stale-reaped failures. Fixes added a dedicated processor selector, `failOnNonClean` route behavior with HTTP `503` for non-clean batches, single-layer default retry semantics, active-deadline validation, explicit `false` handling, and updated docs/schema. Re-review PASS.
2. Security reviewer found existingSecret mode could inline shared auth secrets, existingSecret plus ESO could point refs at the wrong Secret, and processor pods had unrestricted egress after selector separation. Fixes made Mothership/processor shared key refs always use `secretKeyRef`, made ESO-generated Secret names win over existingSecret helpers when ESO is enabled, and added a dedicated processor egress NetworkPolicy. Re-review PASS.

## Verification Performed For Helm Unit Fixtures

Helm unit-test checks run after installing `helm-unittest` into isolated `/tmp` Helm cache/config/data/plugin directories:

```bash
git ls-remote --tags https://github.com/helm-unittest/helm-unittest.git
HELM_CACHE_HOME=/tmp/sim-helm-unittest-cache HELM_CONFIG_HOME=/tmp/sim-helm-unittest-config HELM_DATA_HOME=/tmp/sim-helm-unittest-data HELM_PLUGINS=/tmp/sim-helm-unittest-plugins /tmp/sim-helm-verify/darwin-arm64/helm plugin install https://github.com/helm-unittest/helm-unittest.git --version v0.8.2
HELM_CACHE_HOME=/tmp/sim-helm-unittest-cache HELM_CONFIG_HOME=/tmp/sim-helm-unittest-config HELM_DATA_HOME=/tmp/sim-helm-unittest-data HELM_PLUGINS=/tmp/sim-helm-unittest-plugins /tmp/sim-helm-verify/darwin-arm64/helm unittest helm/sim
bun -e '<parse .github/workflows/test-build.yml, .github/workflows/ci.yml, and .github/workflows/images.yml as YAML>'
bun -e '<assert test-build.yml installs Helm v3.15.4, installs helm-unittest v0.8.2, and runs helm unittest helm/sim>'
```

Result: `helm-unittest` `v1.1.1` was first attempted and rejected by Helm v3.15.4 because that plugin version's `plugin.yaml` uses `platformHooks`, which this Helm binary cannot load. The isolated install was retried with `helm-unittest` `v0.8.2`; installation succeeded under `/tmp`, and `helm unittest helm/sim` passed with 10 suites and 72 tests. Fixture fixes loaded checksum-included Secret/ExternalSecret templates for suites that render deployments, pinned validator assertions to `deployment-app.yaml`, corrected the Mothership negative-validation template, and used bracketed key-path syntax for dotted Kubernetes labels. `.github/workflows/test-build.yml` now installs Helm `v3.15.4`, installs `helm-unittest` `v0.8.2`, and runs `helm unittest helm/sim`; workflow YAML parsing and step assertions pass locally. Actual GitHub Actions execution of the new gate is not proven in this local run.

## Verification Performed For Mothership Image Publishing Wiring

Image publishing checks run after adding `docker/mothership.Dockerfile` to existing image workflows:

```bash
bun -e '<parse .github/workflows/images.yml and .github/workflows/ci.yml as YAML>'
bun -e '<assert both workflows include ./docker/mothership.Dockerfile, ghcr.io/simstudioai/mothership, and ECR_MOTHERSHIP>'
git diff --check -- .github/workflows/images.yml .github/workflows/ci.yml docker/mothership.Dockerfile
bunx turbo prune @sim/mothership --docker --out-dir /tmp/sim-mothership-prune
docker version --format '{{.Server.Version}}'
```

Result: the reusable `.github/workflows/images.yml` image workflow and branch-specific `.github/workflows/ci.yml` image jobs now include Mothership in AMD64 ECR/GHCR, main-branch GHCR ARM64, and GHCR manifest matrices. The workflow topology matches existing app, migrations, and realtime images and introduces one new required repository secret, `ECR_MOTHERSHIP`, for ECR pushes. YAML parsing, workflow matrix assertions, whitespace diff checks, and `turbo prune @sim/mothership --docker` passed. Local Docker build remains unverified because the local Docker daemon is unavailable at `/Users/kyin/.colima/default/docker.sock`.

## Verification Performed For Owned OpenAI Responses Text Provider

OpenAI provider-breadth checks run after adding a strict owned OpenAI Responses text path, strict Mothership-only provider-secret placement, and reviewer fixes:

```bash
bun run --cwd apps/mothership test src/http.test.ts -t "OpenAI"
bun run --cwd apps/mothership test src/http.test.ts
bun run --cwd apps/mothership test src/env.test.ts
bun run mship-service:check
bun -e 'import { readFileSync } from "node:fs"; import { parse } from "yaml"; const files = ["helm/sim/values.yaml", "helm/sim/values.schema.json", ...Array.from(new Bun.Glob("helm/sim/tests/*.yaml").scanSync()), ...Array.from(new Bun.Glob("helm/sim/examples/*.yaml").scanSync())]; for (const file of files) { const text = readFileSync(file, "utf8"); if (file.endsWith(".json")) JSON.parse(text); else parse(text); } console.log(`parsed ${files.length} helm yaml/json files`);'
bunx biome check apps/mothership/src/provider-runtime.ts apps/mothership/src/http.test.ts apps/mothership/src/env.ts apps/mothership/src/env.test.ts helm/sim/templates/_helpers.tpl helm/sim/tests/mothership_test.yaml helm/sim/values.yaml helm/sim/values.schema.json helm/sim/examples/values-mothership.yaml helm/sim/examples/values-external-secrets.yaml docs/superpowers/plans/mothership-replacement-coverage-audit.md
git diff --check -- apps/sim/.env.example apps/mothership/.env.example apps/mothership/src/provider-runtime.ts apps/mothership/src/http.test.ts apps/mothership/src/env.ts apps/mothership/src/env.test.ts helm/sim/templates/_helpers.tpl helm/sim/tests/mothership_test.yaml helm/sim/values.yaml helm/sim/values.schema.json helm/sim/examples/values-mothership.yaml helm/sim/examples/values-external-secrets.yaml docs/superpowers/plans/mothership-replacement-coverage-audit.md
```

Result: focused OpenAI HTTP tests passed with 6 tests, full Mothership HTTP tests passed with 107 tests, Mothership env tests passed with 13 tests, full `mship-service:check` passed with Biome, TypeScript, and 10 test files / 213 tests, Helm YAML/JSON parsing passed for 23 values/schema/test/example files, targeted Biome passed, and whitespace diff checks passed. `apps/mothership` now routes explicit OpenAI requests and supported/priced OpenAI-shaped models through `https://api.openai.com/v1/responses` with `MOTHERSHIP_OPENAI_API_KEY`, emits durable contract-valid text/complete/error stream envelopes, reports cumulative usage to Sim with idempotency key `mothership-run:<runId>:openai`, preserves route-specific billing source, fails OpenAI tool requests before provider fetch with `owned_provider_tooling_not_implemented`, and keeps unsupported non-OpenAI providers on the existing honest unsupported terminal. Helm values/schema/examples and validators keep `MOTHERSHIP_OPENAI_API_KEY` on Mothership-only Secret/ExternalSecret surfaces and reject app/realtime/ESO app leaks. `apps/sim/.env.example` no longer documents owned provider keys; local Mothership provider-key guidance lives in `apps/mothership/.env.example`. Spec review initially found stale-provider routing and missing example/docs coverage; code-quality review found provider-key guidance on the Sim app surface; both were fixed and final re-reviews passed. This text-provider slice left OpenAI tool checkpoint/resume, OpenAI BYOK, and real provider/browser E2E open; the OpenAI tool checkpoint/resume gap is closed in the next section.

## Verification Performed For Owned OpenAI Responses Tool Checkpoint And Resume

OpenAI tool/resume checks run after replacing the previous OpenAI unsupported-tool terminal with durable Responses API function-call checkpointing and provider continuation behavior:

```bash
bun run --cwd apps/mothership test src/http.test.ts -t "OpenAI"
bun run --cwd apps/mothership test src/http.test.ts -t "BYOK"
bun run --cwd apps/mothership type-check
bun run --cwd apps/mothership test src/http.test.ts
bun run mship-service:check
git diff --check -- apps/mothership/src/provider-runtime.ts apps/mothership/src/http.test.ts docs/superpowers/plans/mothership-replacement-coverage-audit.md
```

Result: focused OpenAI HTTP tests passed with 14 tests, full Mothership HTTP tests passed with 115 tests, `apps/mothership` type-check passed, full `mship-service:check` passed with Biome, TypeScript, and 10 test files / 221 tests, and whitespace diff checks passed. `apps/mothership` now converts Mothership tool definitions into OpenAI Responses function tools, streams OpenAI `function_call` output into durable Sim tool events, persists checkpoints before pause, resumes with `function_call_output` items, reports cumulative OpenAI usage/cost with provider-specific billing, keeps retryable truncated resume streams paused without marking tool results delivered, and supports pause-again when OpenAI returns another function call after resume. Malformed OpenAI function-call arguments now fail closed before billing, checkpoint, or pause. Stored OpenAI resume requests now reject malformed output items, missing tool definitions, missing referenced tools, model drift between the stored outer model and request body, unpriced models, and non-stream requests before entitlement callbacks or tool-result writes. Spec review found malformed args, missing-tool resume, and pricing-preflight gaps; code-quality review found streamed argument delta loss, model-drift acceptance, and invalid-JSON fail-open risk. All findings were fixed and re-reviewed PASS. Live OpenAI/browser E2E, OpenAI BYOK, failed/cancelled OpenAI result branch tests, provider-internal parser edge fixtures, and subagent provider continuation remain open.

## Verification Performed For OpenAI Tool/Resume Stream Fixtures

OpenAI fixture checks run after adding provider-specific public stream fixtures and a resumed-leg parser invariant:

```bash
bun run mship-fixtures:check
bun run --cwd apps/sim test lib/copilot/request/go/stream.test.ts -t "stream fixture"
bun run --cwd apps/sim test lib/copilot/request/go/stream.test.ts
bun run --cwd apps/sim type-check
bun run --cwd packages/mothership-contracts type-check
bunx biome check apps/sim/lib/copilot/request/go/parser.ts apps/sim/lib/copilot/request/go/stream.ts apps/sim/lib/copilot/request/go/stream.test.ts scripts/check-mothership-stream-fixtures.ts
rg -n '[[:blank:]]$' apps/sim/lib/copilot/request/go/parser.ts apps/sim/lib/copilot/request/go/stream.ts apps/sim/lib/copilot/request/go/stream.test.ts scripts/check-mothership-stream-fixtures.ts packages/mothership-contracts/fixtures docs/superpowers/plans/mothership-replacement-coverage-audit.md
LC_ALL=C rg -n '[^\x00-\x7F]' packages/mothership-contracts/fixtures scripts/check-mothership-stream-fixtures.ts docs/superpowers/plans/mothership-replacement-coverage-audit.md
```

Result: the fixture checker passed with 18 valid stream fixtures and 8 rejected invalid fixtures, including the new `openai-tool-resume-truncated.sse` missing-terminal case. Sim stream replay tests passed with 45 tests after adding the OpenAI invalid fixture to the read-loop rejection set, a live checkpoint-pause regression test, explicit assertions that the OpenAI resume fixtures consume `run.resumed` plus the expected completion or pause terminal, and a parser chunk-boundary regression test that proves buffered trailing data is not dispatched after a stop signal. The stream parser now supports explicit fixture/replay mode for `checkpoint_pause -> resumed -> terminal` bodies, while default live streams still stop immediately on `run.checkpoint_pause` without waiting for body close. A resumed leg that ends without `complete`, `error`, or another `run.checkpoint_pause` is treated as a backend error. `apps/sim` type-check, `packages/mothership-contracts` type-check, targeted Biome, and direct trailing-whitespace checks passed. Direct ASCII checks passed for the new fixtures, validator script, and ledger. Fixture review found that the first draft overclaimed public OpenAI `args_delta` streaming and included optional fields the current producer does not emit. The fixtures were corrected to match current producer output: final tool calls at checkpoint time, cursor-bearing Mothership envelopes, no synthetic OpenAI session frame, no OpenAI-public args-delta fixture, no OpenAI pause `frames`, and no optional `response` object on the OpenAI complete event.

## Verification Performed For OpenAI Edge Coverage And BYOK Source Preservation

OpenAI edge-coverage checks run after extending the owned OpenAI provider kernel to preserve BYOK credential source across checkpoint/resume and adding provider-specific resume/parser edge tests:

```bash
bun run --cwd apps/mothership test src/http.test.ts -t "OpenAI"
bun run --cwd apps/mothership type-check
bun run --cwd apps/mothership test src/http.test.ts
bun run mship-service:check
```

Result: focused OpenAI HTTP tests passed with 23 tests, BYOK-focused HTTP tests passed with 18 tests, full Mothership HTTP tests passed with 124 tests, `apps/mothership` type-check passed, and full `mship-service:check` passed with Biome, TypeScript, and 10 test files / 230 tests. `apps/mothership` now resolves OpenAI BYOK through the same Sim-authorized BYOK callback and encrypted provider-key store used by Anthropic, stores `credentialSource: 'byok'` in OpenAI checkpoints, resumes stored BYOK OpenAI checkpoints with the workspace key, reports zero hosted cost for OpenAI BYOK completions, and fails closed without hosted fallback when stored BYOK resume entitlement is rejected, including when the resume request asks to retry provider stream errors. OpenAI resume coverage now includes failed tool results, cancelled tool results, provider-call-order preservation even when recorded results arrive out of order, mixed `item_id`/`output_index` function-call argument assembly before checkpointing, malformed function-call shape rejection before billing/checkpointing, and cached-input token cost for the GPT-5.4/GPT-5.5 family rates shown on the official OpenAI pricing page (`https://openai.com/api/pricing/`). A spec review found that stored BYOK credential failures were still entering the retryable resume branch when `willRetryOnStreamError` was true; that is fixed for OpenAI and Anthropic by classifying BYOK credential failures separately from provider stream failures. A code review found silent malformed OpenAI function-call drops, weak multi-tool ordering proof, and cached-token billing drift; all three were fixed. This closes Task 41. Remaining provider work is subagent continuation, broader future-provider breadth, provider-internal fixture promotion where useful, pricing-policy hardening beyond standard under-270K rates, and real browser/provider E2E.

## Verification Performed For OpenAI Parser Edge Fixture Decision

Task 44 fixture-hardening decision: no new public stream fixture is added for mixed OpenAI `item_id`/`output_index` argument assembly. Those fields are OpenAI provider-internal SSE identifiers, while the public Mothership stream contract intentionally exposes only normalized Sim tool-call events with final `toolCallId`, `toolName`, and parsed `arguments`. The current public fixture set already covers the public OpenAI checkpoint/resume shapes the producer emits. Adding a public fixture with OpenAI provider internals would document behavior the public stream does not and should not expose. The edge is covered in provider-kernel HTTP tests, where the owned OpenAI parser receives mixed `item_id`/`output_index` provider frames and must checkpoint two normalized tool calls with complete arguments.

## Verification Performed For Subagent Route Safety And Scoped Stream Support

Subagent-route safety checks run after adding service-side tool-catalog route lookup from the shared contract package, scoped stream writer support, and provider-kernel guards that prevent catalog subagent tools from being treated as Sim-executed tool checkpoints:

```bash
bunx biome check --write apps/mothership/src/provider-runtime.ts apps/mothership/src/http.test.ts apps/mothership/src/stream.ts apps/mothership/src/stream.test.ts packages/mothership-contracts/src/tool-catalog.ts packages/mothership-contracts/src/index.ts
bun run --cwd apps/mothership test src/stream.test.ts
bun run --cwd apps/mothership test src/http.test.ts -t "subagent"
bun run --cwd packages/mothership-contracts type-check
bun run --cwd apps/mothership type-check
bun run mship-fixtures:check
bun run mship-service:check
```

Result: scoped stream writer tests passed with 12 tests, focused subagent provider tests passed with 2 tests, `packages/mothership-contracts` type-check passed, `apps/mothership` type-check passed, fixture validation passed with 18 valid stream fixtures and 8 rejected invalid fixtures, and full `mship-service:check` passed with Biome, TypeScript, and 10 test files / 233 tests. `@sim/mothership-contracts` now exposes a service-safe tool-catalog route lookup from the canonical JSON contract. `apps/mothership` can persist and stream scoped subagent envelopes. When Anthropic or OpenAI providers request a catalog `route: "subagent"` tool such as `workflow`, the owned provider kernel now reports the provider usage already incurred, emits an honest `executor: "go"` internal tool-call event, publishes terminal `owned_subagent_continuation_not_implemented`, marks the run failed, and does not create a Sim checkpoint or mark the run paused. This closes Task 42 as a safety/invariant slice only. Real subagent execution, scoped child-tool checkpoints, subagent result spans, and parent-provider resume after subagent completion remain open as the next subagent engine task.

## Verification Performed For Subagent Engine Reconnaissance

Task 46 reconnaissance checks run after the subagent safety slice to decide whether real owned subagent execution can be implemented from repo evidence without inventing private hosted behavior:

```bash
bun run --cwd apps/sim test lib/copilot/request/handlers/handlers.test.ts -t "subagent"
```

Result: focused Sim handler tests passed with 3 subagent tests and 21 skipped tests. Local inspection and the read-only explorer agree on the current boundary: normal Sim chat and Mothership block payloads do not expose canonical catalog `route: "subagent"` tools. `integrationTools` comes from visible block/tool registry entries through `apps/sim/lib/copilot/integration-tools.ts`, and `mothershipTools` currently adds only the user-skill loader. Sim can already consume scoped subagent stream events and execute scoped child Sim/client tools when a backend emits them, but the repo does not contain the owned subagent definitions needed to honestly run `workflow`, `research`, `deploy`, `file`, `knowledge`, or similar subagents: prompts/instructions, allowed child tools, inherited-history rules, result serialization, recursion limits, and model policy are missing. Therefore the next real implementation step is not to fake a generic subagent. It is to author a repo-owned subagent catalog and callback/continuation contract for one initial subagent, keep all other subagents fail-closed, and only then implement the engine branch with scoped lifecycle/result events and checkpoint `frames`.

## Verification Performed For First Owned Workflow Subagent Spec

Workflow was selected as the first owned subagent. Checks run after adding a repo-owned workflow subagent spec catalog without exposing or executing it at runtime:

```bash
bunx biome check --write apps/mothership/src/subagents/catalog.ts apps/mothership/src/subagents/catalog.test.ts
bun run --cwd apps/mothership test src/subagents/catalog.test.ts
bun run --cwd apps/mothership type-check
bun run mship-service:check
```

Result: the focused workflow subagent catalog test passed with 3 tests, `apps/mothership` type-check passed, and full `mship-service:check` passed with Biome, TypeScript, and 11 test files / 236 tests. `apps/mothership/src/subagents/catalog.ts` now defines the first owned `workflow` subagent spec tied to the canonical `workflow` catalog entry, with explicit input/result schemas, instructions, allowed child tools, no nested subagents for the first slice, depth/round/tool-call limits, inherited parent model policy, inherited parent workspace BYOK policy, and parent-run billing attribution. Unsupported subagents such as `research` and `deploy` remain unspecified and fail closed. This closes Task 46 as the first subagent prerequisite only; later tasks close runtime exposure, Sim callback contract, first engine execution, and first public fixtures for the `workflow` subagent.

## Verification Performed For Workflow Subagent Callback Contract

Task 47 checks run after adding the strict Sim/Mothership workflow subagent callback boundary without enabling runtime execution:

```bash
bunx biome check --write packages/mothership-contracts/src/routes/callbacks.ts apps/sim/lib/api/contracts/copilot.ts apps/sim/app/api/copilot/subagents/workflow/execute/route.ts apps/sim/app/api/copilot/subagents/workflow/execute/route.test.ts apps/mothership/src/callbacks.ts apps/mothership/src/callbacks.test.ts
bun run --cwd apps/sim test app/api/copilot/subagents/workflow/execute/route.test.ts
bun run --cwd apps/mothership test src/callbacks.test.ts -t "workflow subagent"
bun run --cwd packages/mothership-contracts type-check
bun run --cwd apps/mothership type-check
bun run --cwd apps/sim type-check
bun run check:api-validation:strict
bun run mship-service:check
bun run mship-contracts:check
bun run --cwd apps/mothership test src/callbacks.test.ts
```

Result: focused Sim route tests passed with 4 tests, focused Mothership workflow-subagent callback tests passed with 3 tests, full Mothership callback tests passed with 18 tests, `packages/mothership-contracts`, `apps/mothership`, and `apps/sim` type-checks passed, strict API validation passed after raising the route baseline for one new Zod-backed API route, `mship-contracts:check` passed, and full `mship-service:check` passed with Biome, TypeScript, and 11 test files / 239 tests. `@sim/mothership-contracts` now exposes `workflowSubagentExecuteCallbackContract` with strict callback headers, preserved run/stream/chat/workspace/user/model/provider/parent-tool identity, inherited message/resource context, bounded depth/round/tool-call limits, a typed result union, and optional scoped Mothership stream events for the future engine. `apps/mothership` has one tested `executeWorkflowSubagentCallback` helper that sends only `x-sim-callback-key`, never legacy `x-api-key`, and fails closed on missing callback config or Sim rejection. Task 47 originally left Sim's `POST /api/copilot/subagents/workflow/execute` as a typed 501 until a real engine existed; that stub is now superseded by Task 50, first public workflow-subagent fixture coverage is now closed by Task 49, and explicit `needs_input` semantics are now closed by Task 51. This closes Task 47 as a boundary-only slice; provider-resume subagent calls, broader behavior-specific subagent fixtures, and E2E proof remain open.

## Verification Performed For Workflow Subagent Provider Continuation Seam

Task 48 provider-kernel checks run after wiring Anthropic and OpenAI initial tool calls for the canonical `workflow` subagent through the strict Sim callback helper. At the time of Task 48, the Sim callback route still returned typed 501; Task 50 now supersedes that stub with the first real engine:

```bash
bunx biome check --write apps/mothership/src/provider-runtime.ts apps/mothership/src/http.test.ts
bun run --cwd apps/mothership test src/http.test.ts -t "subagent"
bun run --cwd apps/mothership test src/http.test.ts -t "OpenAI"
bun run --cwd apps/mothership test src/http.test.ts -t "Anthropic"
bun run --cwd apps/mothership test src/callbacks.test.ts
bun run --cwd apps/mothership type-check
bun run --cwd apps/mothership test src/http.test.ts
bun run mship-service:check
bun run --cwd packages/mothership-contracts type-check
bun run --cwd apps/sim test app/api/copilot/subagents/workflow/execute/route.test.ts
```

Result: focused subagent tests passed with 2 tests, OpenAI-focused tests passed with 24 tests, Anthropic-focused tests passed with 18 tests, full Mothership callback tests passed with 18 tests, full Mothership HTTP tests passed with 126 tests, `apps/mothership` type-check passed, `packages/mothership-contracts` type-check passed, the Sim workflow-subagent callback route test passed with 4 tests, and full `mship-service:check` passed with Biome, TypeScript, and 11 test files / 239 tests. `apps/mothership/src/provider-runtime.ts` now executes pure initial `workflow` subagent tool calls by calling `executeWorkflowSubagentCallback`, re-emits returned callback stream events through the parent stream with fresh parent sequence/cursor and preserved `scope`, publishes a `go` executor tool result, and feeds a structured Anthropic `tool_result` or OpenAI `function_call_output` back into the parent provider so it can continue to a normal terminal response. The tests prove the callback body preserves run/stream/chat/workspace/user/model/provider/parent-tool identity, inherited messages, workflow resource context, catalog limits, cumulative billing across the pre-subagent and post-subagent provider calls, no Sim tool checkpoint creation, no run pause, and no resume-result mutation. This closes Task 48 as the initial provider-kernel continuation seam; Task 52 below closes pure provider-resume workflow-subagent continuation, and mixed Sim+subagent tool batches remain fail-closed.

## Verification Performed For Workflow Subagent Execution Engine

Task 50 checks run after replacing the typed 501 callback stub with the first real Sim workflow subagent engine:

```bash
bunx biome check --write packages/mothership-contracts/src/subagents.ts packages/mothership-contracts/src/index.ts packages/mothership-contracts/src/routes/callbacks.ts apps/mothership/src/subagents/catalog.ts apps/sim/lib/copilot/subagents/workflow/execute.ts apps/sim/lib/copilot/subagents/workflow/execute.test.ts apps/sim/app/api/copilot/subagents/workflow/execute/route.ts apps/sim/app/api/copilot/subagents/workflow/execute/route.test.ts
bun run --cwd apps/sim test lib/copilot/subagents/workflow/execute.test.ts
bun run --cwd apps/sim test app/api/copilot/subagents/workflow/execute/route.test.ts
bun run --cwd packages/mothership-contracts type-check
bun run --cwd apps/mothership test src/subagents/catalog.test.ts
bun run --cwd apps/mothership type-check
bun run --cwd apps/mothership test src/http.test.ts -t "subagent"
bun run --cwd apps/sim type-check
bun run mship-service:check
bun run mship-contracts:check
bun run check:api-validation:strict
bun run --cwd apps/sim test lib/copilot/subagents/workflow/execute.test.ts app/api/copilot/subagents/workflow/execute/route.test.ts
```

Result: focused Sim workflow-subagent engine tests passed with 6 tests, focused callback route tests passed with 4 tests, combined Sim subagent tests passed with 10 tests, `packages/mothership-contracts` type-check passed, `apps/sim` type-check passed, `apps/mothership` type-check passed, focused Mothership subagent continuation tests passed with 2 tests, full `mship-service:check` passed with Biome, TypeScript, and 11 test files / 239 tests, `mship-contracts:check` passed, and strict API validation passed at the 859-route baseline. `@sim/mothership-contracts` now owns the shared workflow subagent spec, allowed child-tool list, and parsed callback body type. `apps/mothership/src/subagents/catalog.ts` consumes that shared spec instead of carrying a divergent local copy. Sim's strict callback route now authenticates with `checkSimCallbackAuth` before parsing, validates the shared contract, and calls `executeWorkflowSubagent`. The new engine verifies active workspace access, verifies workflow access and workspace match when a workflow is scoped, creates a child run/execution/stream identity instead of reusing the parent run identity, runs `runHeadlessCopilotLifecycle` against `/api/mothership`, exposes only the workflow child-tool allowlist as Mothership tools, carries inherited parent context and resource hints, enforces max depth, max child tool calls, max provider rounds, and disallowed child-tool failures with aborts, returns scoped non-terminal child events to the parent, filters child `complete`/`error`/`run`/`session` terminal events so the parent stream cannot be closed by a child stream, maps success/cancel/error into the shared callback response, and records best-effort changed-resource summaries from successful workflow/folder/run tool calls. This closes Task 50 as the first real workflow subagent execution slice. Task 49 separately closes first public workflow-subagent stream fixture coverage, Task 51 separately closes explicit `needs_input` classification, Task 52 separately closes pure provider-resume workflow-subagent continuation, and Task 55 separately closes public `needs_input`/cancelled result fixtures; real-provider/browser E2E remains open.

## Verification Performed For Workflow Subagent Public Stream Fixtures

Task 49 checks run after adding producer-style public stream fixtures for real workflow subagent execution:

```bash
bunx biome check --write scripts/check-mothership-stream-fixtures.ts
bun run mship-fixtures:check
bun run --cwd packages/mothership-contracts fixtures:check
```

Result: fixture validation now includes valid `workflow-subagent-tool-complete.sse` with 10 events and invalid `workflow-subagent-child-terminal-leak.sse`, which is rejected as expected because a scoped child `complete` would terminate the parent stream before the parent workflow tool result. The valid fixture proves the public parent stream shape for a workflow subagent call: parent `workflow` tool call, scoped workflow subagent start span, scoped subagent text, scoped child `edit_workflow` tool call/result, scoped subagent end span, parent `workflow` tool result with changed resources, parent assistant text, and final parent `complete`. This closes Task 49 for first public workflow-subagent fixture coverage. Task 55 adds behavior-specific `needs_input` and cancelled subagent fixtures below.

## Verification Performed For Workflow Subagent Needs Input Semantics

Task 51 checks run after adding explicit `needs_input` classification to the Sim workflow subagent engine:

```bash
bunx biome check --write apps/sim/lib/copilot/subagents/workflow/execute.ts apps/sim/lib/copilot/subagents/workflow/execute.test.ts
bun run --cwd apps/sim test lib/copilot/subagents/workflow/execute.test.ts
bun run --cwd apps/sim test lib/copilot/subagents/workflow/execute.test.ts app/api/copilot/subagents/workflow/execute/route.test.ts
bun run --cwd apps/sim type-check
```

Result: focused Sim workflow-subagent engine tests passed with 10 tests, combined route/helper tests passed with 14 tests, and `apps/sim` type-check passed. The engine now returns contract-shaped `result.status: "needs_input"` for concrete non-security cases: no actionable prompt or inherited message (`ambiguous_instruction`), child tool permission denial (`missing_permission`), cancelled/rejected destructive `delete_folder` action (`destructive_action`), and unresolved child tool confirmation (`tool_confirmation`). Callback auth, workspace access, workflow access, workflow/workspace mismatch, depth limits, disallowed child tools, child tool limits, and provider round limits still fail closed as callback failures instead of being converted into user prompts. This closes Task 51. Task 52 closes pure provider-resume subagent calls and Task 55 closes behavior-specific public stream fixtures below; browser/provider E2E remains open.

## Verification Performed For Workflow Subagent Behavior Result Fixtures

Task 55 checks run after adding public `needs_input` and cancelled workflow-subagent result fixtures:

```bash
bunx biome check --write scripts/check-mothership-stream-fixtures.ts
bun run mship-fixtures:check
bun run --cwd packages/mothership-contracts fixtures:check
```

Result: fixture validation now includes valid `workflow-subagent-tool-needs-input.sse` with 7 events and valid `workflow-subagent-tool-cancelled.sse` with 7 events. The `needs_input` fixture proves the parent `workflow` tool result is published as `success: false`, `status: "error"`, and an output object with `status: "needs_input"`, `reason`, `summary`, and `prompt`. The cancelled fixture proves the parent result is published as `success: false`, `status: "cancelled"`, and an output object with `status: "cancelled"` plus summary. Invalid `workflow-subagent-needs-input-post-terminal-leak.sse` is rejected because no scoped child event may publish after the parent stream terminal. This closes Task 55.

## Verification Performed For Workflow Subagent Provider Resume Context

Task 52 checks run after persisting strict workflow-subagent callback context into owned provider checkpoints and using it during Anthropic/OpenAI resume:

```bash
bunx biome check --write apps/mothership/src/provider-runtime.ts apps/mothership/src/http.test.ts
bun run --cwd apps/mothership test src/http.test.ts
bun run --cwd apps/mothership type-check
bun run mship-service:check
```

Result: full Mothership HTTP tests passed with 129 tests, `apps/mothership` type-check passed, and full `mship-service:check` passed with Biome, TypeScript, and 11 test files / 242 tests. `apps/mothership/src/provider-runtime.ts` now stores a sanitized workflow-subagent context in Anthropic/OpenAI provider checkpoints when the original chat body is available, rejects malformed stored context instead of using partial identity, restores that context during provider resume, and uses the same strict `executeWorkflowSubagentCallback` path when a resumed Anthropic/OpenAI provider emits a pure `workflow` subagent call. The new tests prove resume preserves run/stream/chat/workspace/user/model/provider/parent-tool identity, inherited user message, workflow resource context, scoped callback stream events, cumulative billing across pre-subagent and post-subagent provider calls, and provider continuation via Anthropic `tool_result` or OpenAI `function_call_output`. The provider runtime also no longer emits invalid `ui` chrome on subagent tool-result frames; call frames still carry internal UI metadata. This closes Task 52. Mixed Sim+subagent tool batches, browser/provider E2E, and production rollup proof remain open.

## Verification Performed For Durable Workflow Subagent Parent Attribution

Task 54 checks run after making workflow subagent child-run attribution first-class in the owned runtime claim path:

```bash
bunx biome check --write packages/mothership-contracts/src/routes/runtime.ts packages/mothership-contracts/src/routes/callbacks.ts apps/mothership/src/state/run-store.ts apps/mothership/src/state/run-store.test.ts apps/mothership/src/http.test.ts apps/mothership/src/callbacks.test.ts apps/sim/lib/copilot/subagents/workflow/execute.test.ts apps/sim/app/api/copilot/subagents/workflow/execute/route.test.ts apps/mothership/src/smoke/strict-e2e-preflight.ts apps/mothership/src/smoke/strict-e2e-preflight.test.ts apps/mothership/package.json
bun run --cwd apps/mothership test src/state/run-store.test.ts src/http.test.ts src/callbacks.test.ts src/smoke/strict-e2e-preflight.test.ts
bun run --cwd apps/sim test lib/copilot/subagents/workflow/execute.test.ts app/api/copilot/subagents/workflow/execute/route.test.ts
bun run --cwd packages/mothership-contracts type-check
bun run mship-contracts:check
bun run mship:check
bun run mship-fixtures:check
bun run mship-service:check
bun run check:api-validation:strict
bun run --cwd apps/mothership smoke:strict-e2e-preflight
```

Result: focused Mothership state/HTTP/callback/preflight tests passed with 172 tests, Sim workflow-subagent engine/route tests passed with 14 tests, `packages/mothership-contracts` type-check passed, `mship-contracts:check` passed, aggregate `mship:check` passed, `mship-fixtures:check` passed, full `mship-service:check` passed with Biome, TypeScript, and 12 test files / 251 tests, and strict API validation passed. The runtime body contract now exposes optional UUID-shaped `parentRunId`, the workflow subagent callback contract now requires UUID-shaped parent `runId`, Sim's child workflow subagent payload is parsed against `mothershipChatBodySchema` in tests, the owned Mothership runtime route passes `parentRunId` into `claimMothershipRuntimeRun`, and the run store persists `copilot_runs.parent_run_id` for child claims. Existing DB schema and migration already had `copilot_runs.parent_run_id` plus `copilot_runs_parent_run_id_idx`, so no new migration was needed. Reusing a stream with a different parent run identity now returns `run_identity_conflict`, including the concurrent-claim winner path, and errored runs are now terminal for fresh runtime claims. The new strict E2E preflight script is verified and currently blocks because required secrets/topology are absent. This closes Task 54 as durable attribution persistence, UUID boundary validation, terminal-status hardening, and runnable E2E preflight. Billing/product rollup views over the parent-child tree remain future production-reporting work.

## Verification Performed For Provider Timeout And Node Streaming

Task 56 checks run after hardening provider request lifecycle and the Node HTTP adapter:

```bash
bunx biome check --write apps/mothership/src/provider-runtime.ts apps/mothership/src/http.ts apps/mothership/src/server.ts apps/mothership/src/env.ts apps/mothership/src/http.test.ts apps/mothership/src/env.test.ts
bun run --cwd apps/mothership test src/http.test.ts src/env.test.ts
bun run --cwd apps/mothership type-check
bun run --cwd apps/mothership lint:check
bun run mship-service:check
bun run mship:check
bun run mship-fixtures:check
git diff --check -- apps/mothership/src/provider-runtime.ts apps/mothership/src/http.ts apps/mothership/src/server.ts apps/mothership/src/env.ts apps/mothership/src/http.test.ts apps/mothership/src/env.test.ts apps/mothership/.env.example
```

Result: focused Mothership HTTP/env tests passed with 157 tests, `apps/mothership` type-check passed, `apps/mothership` lint passed, full `mship-service:check` passed with Biome, TypeScript, and 13 test files / 279 tests, aggregate `mship:check` passed, stream fixture validation passed, and whitespace diff checks passed. `apps/mothership` now exposes `MOTHERSHIP_PROVIDER_REQUEST_TIMEOUT_MS`, attaches a bounded provider request signal to Anthropic, OpenAI, CliProxyAPI, and title-generation provider fetches, forwards request abort signals from runtime/resume/title routes into provider work, and publishes a durable terminal provider error on provider timeout. The Node HTTP adapter now writes `Response.body` chunks to `ServerResponse` as they arrive instead of buffering `arrayBuffer()` to completion, propagates client disconnects into the Fetch `Request.signal`, and handles backpressure/closed sockets without hanging. This closes Task 56 as a reliability slice only; real browser/provider E2E and live deployment streaming proof remain separate acceptance evidence.

## Verification Performed For CliProxyAPI Text Provider And Preflight

Task 57 checks run after adding first-class CliProxyAPI text-provider support:

```bash
bun run --cwd apps/mothership test src/http.test.ts src/env.test.ts src/smoke/strict-e2e-preflight.test.ts
bun run --cwd apps/mothership type-check
bun run --cwd apps/mothership lint:check
bun run mship-service:check
bun run mship:check
bun run mship-fixtures:check
bun run check:api-validation:strict
```

Result: focused Mothership HTTP/env/preflight tests passed with 169 tests, `apps/mothership` type-check passed, `apps/mothership` lint passed, full `mship-service:check` passed with Biome, TypeScript, and 13 test files / 279 tests, aggregate `mship:check` passed, stream fixture validation passed, and strict API validation passed at the 859-route baseline. The current source now supports `provider: "cliproxyapi"` and the `cliproxy` alias, selects `gpt-5.5` by default for CliProxyAPI, routes explicit CliProxyAPI requests before OpenAI `gpt*` inference, calls `/v1/chat/completions` with `reasoning_effort`, `max_completion_tokens`, and `stream_options.include_usage`, streams text into durable Mothership envelopes, requires billable prompt/completion usage before billing, reports usage through the provider-specific `mothership-run:<runId>:cliproxyapi` idempotency key, fails missing usage and provider errors without billing, sanitizes provider error details before streaming to clients, and supports CliProxyAPI title generation. `apps/mothership/src/smoke/strict-e2e-preflight.ts` now has a CliProxyAPI branch that does not require Anthropic/OpenAI provider keys, rejects unsafe CliProxyAPI base URLs, and can check `/v1/models` for the selected `gpt-5.5` model. This closes the first CliProxyAPI text path and preflight slice only. CliProxyAPI tool calls, CliProxyAPI resume checkpoints, browser-originated strict-mode E2E, and live deployment proof remain open.

## Verification Performed For Agent Operating System And Client Gate Repair

Task 58 checks run after codifying the final-vision operating contract and repairing a worker-found Mothership client test fixture drift:

```bash
oracle --dry-run summary --files-report -p "$(cat /tmp/oracle-sim-control-panel-v2-prompt.md)" ...
oracle --engine browser --model gpt-5.5-pro --browser-model-strategy current --copy-profile "$HOME/Library/Application Support/Google/Chrome" --browser-chrome-profile "Profile 1" --slug "sim-control-panel-v2" ...
bun run mship-client:check
git diff --check -- packages/mothership-client/src/client.test.ts docs/README.md docs/superpowers/plans/mothership-agent-operating-system.md
rg -n '[[:blank:]]$' packages/mothership-client/src/client.test.ts docs/README.md docs/superpowers/plans/mothership-agent-operating-system.md
LC_ALL=C rg -n '[^\x00-\x7F]' packages/mothership-client/src/client.test.ts docs/README.md docs/superpowers/plans/mothership-agent-operating-system.md
rg -n 'Mothership agent operating system|mothership-agent-operating-system' docs/README.md docs/superpowers/plans/mothership-agent-operating-system.md
```

Result: Oracle browser review completed and saved a transcript at `/Users/kyin/.oracle/sessions/sim-control-panel-v2/artifacts/transcript.md`. `docs/superpowers/plans/mothership-agent-operating-system.md` now defines the Adjudicated Evidence OS: always orchestrate, evaluate/review/grade/iterate after every feature, use role-scoped workers/reviewers/graders, apply hard fail gates and grade caps, update the coverage audit and timestamped handoff after closed or blocked slices, and prevent fake completion claims. `docs/README.md` now indexes the operating-system doc. `packages/mothership-client/src/client.test.ts` now uses UUID-shaped runtime identity fixtures for `chatId` and `runId`, matching `mothershipChatBodySchema`; `mship-client:check` passed with Biome, TypeScript, and 2 test files / 23 tests. Targeted whitespace, ASCII, README-link, and diff checks passed. This closes Task 58 as a process/evidence-gate hardening and local client-gate repair slice only; it does not claim browser E2E, provider E2E, Docker build/push, Kubernetes smoke, CliProxyAPI tool/resume, provider-pricing finality, full repo test-suite health, or backend replacement completion.

## Verification Performed For Provider Pricing Policy Guard

Task 59 checks run after hardening provider-pricing policy freshness and fail-closed runtime preflight:

```bash
bun run --cwd apps/mothership test src/pricing-policy.test.ts
bun run --cwd apps/mothership test src/http.test.ts -t "pricing policy is stale|unpriced models before provider fetch|cached-input pricing|OpenAI long-context|CliProxyAPI chat completions"
bun run mship-service:check
git diff --check -- apps/mothership/src/provider-runtime.ts apps/mothership/src/pricing-policy.ts apps/mothership/src/pricing-policy.test.ts apps/mothership/src/http.test.ts docs/superpowers/plans/mothership-replacement-coverage-audit.md
rg -n '[[:blank:]]$' apps/mothership/src/provider-runtime.ts apps/mothership/src/pricing-policy.ts apps/mothership/src/pricing-policy.test.ts apps/mothership/src/http.test.ts docs/superpowers/plans/mothership-replacement-coverage-audit.md
```

Result: focused provider-pricing policy tests passed with 7 tests, targeted HTTP pricing/preflight tests passed with 4 tests and 140 skipped, full `mship-service:check` passed with Biome, TypeScript, and 13 files / 281 tests, and diff/trailing-whitespace checks passed. Official OpenAI and Anthropic pricing pages were checked on 2026-06-22 before updating `PROVIDER_PRICING_POLICY.reviewedAt`, `staleAfter`, and the Anthropic source URL; OpenAI standard GPT-5.4/GPT-5.5 long-context rates still match the local policy, and `gpt-5.5-pro` now uses the same long-context multiplier as `gpt-5.4-pro`. Hosted Anthropic, OpenAI, and CliProxyAPI continuations now assert policy freshness before provider fetch and before hosted billing cost calculation; stale policy emits an honest terminal error and does not fetch the provider or call the billing callback. Anthropic now preflights unpriced models before credentials/provider fetch/billing, matching the existing OpenAI/CliProxyAPI fail-closed behavior. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: batch/flex/regional/data-residency pricing modes are still not modeled as request inputs, pricing remains a reviewed in-code policy rather than a generated external data artifact, and no live provider/browser/deployment E2E was run.

## Verification Performed For CliProxyAPI Tool Resume

Task 60 checks run after replacing the old CliProxyAPI tool/resume unsupported terminal with a reviewed Chat Completions stored-provider envelope:

```bash
bun run --cwd apps/mothership test src/http.test.ts -t "CliProxyAPI|matching tool definitions"
bun run --cwd apps/mothership type-check
bun run mship-service:check
bun run mship:check
bun run mship-fixtures:check
```

Result: targeted CliProxyAPI/resume tests passed with 13 tests, `apps/mothership` type-check passed, full `mship-service:check` passed with Biome, TypeScript, and 13 files / 284 tests, aggregate `mship:check` passed, and stream fixture validation passed. `apps/mothership` now sends valid Chat Completions `tools` to CliProxyAPI, captures streamed `delta.tool_calls`, rejects malformed tool-call arguments before billing or checkpoint mutation, persists a `provider: "cliproxyapi"` stored-provider envelope with the original chat-completions request, output tool calls, cumulative billing state, and matching tool definitions, validates stored CliProxyAPI tool definitions before resume entitlement callbacks or result writes, resumes with `assistant.tool_calls` plus `role: "tool"` messages, preserves provider-specific billing idempotency key `mothership-run:<runId>:cliproxyapi`, and keeps subagent tool calls unsupported through an honest terminal rather than routing them through the Anthropic/OpenAI workflow callback contract. Grade: `B_CLOSE_SAFE_PARTIAL`. Remaining cap reason: no real CliProxyAPI provider/browser E2E was run, and CliProxyAPI workflow subagent support remains intentionally unsupported.

## Verification Performed For CliProxyAPI Tool Resume Fixtures

Task 61 checks run after promoting the CliProxyAPI Sim-tool checkpoint/resume public stream surface from HTTP-only proof to package fixtures:

```bash
bun run mship-fixtures:check
bun run mship:check
bun run mship-service:check
bun run mship-client:check
```

Result: stream fixture validation passed with 24 valid fixtures and 10 expected invalid-fixture rejections. The new valid fixtures are `cliproxy-tool-checkpoint-pause.sse`, `cliproxy-tool-checkpoint-resume.sse`, and `cliproxy-tool-malformed-args-error.sse`; they match the current public producer behavior for CliProxyAPI tool pause, tool-result resume completion, and sanitized malformed-arguments failure. Aggregate `mship:check` passed with generated contracts up to date, full `mship-service:check` passed with Biome, TypeScript, and 13 files / 284 tests, and `mship-client:check` passed with Biome, TypeScript, and 2 files / 23 tests. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: this closes public fixture coverage only; no real CliProxyAPI provider/browser E2E was run, no live replay tail was exercised, and CliProxyAPI workflow subagent callbacks remain unsupported.

## Verification Performed For Strict E2E Probe And CliProxyAPI Workflow Subagent Decision

Task 62 checks run after probing strict-mode real-key E2E readiness and closing the remaining CliProxyAPI workflow-subagent decision as an explicit fail-closed deferral:

```bash
bun run --cwd apps/mothership smoke:strict-e2e-preflight
bun run --cwd apps/mothership test src/http.test.ts -t "CliProxyAPI workflow subagent|CliProxyAPI|subagent"
bun run mship-service:check
bun run mship-fixtures:check
bun run mship:check
bun run mship-client:check
git diff --check -- apps/mothership/src/http.test.ts docs/superpowers/plans/mothership-agent-operating-system.md docs/superpowers/plans/mothership-replacement-coverage-audit.md
! rg -n '[[:blank:]]$' apps/mothership/src/http.test.ts docs/superpowers/plans/mothership-agent-operating-system.md docs/superpowers/plans/mothership-replacement-coverage-audit.md
! LC_ALL=C rg -n '[^\x00-\x7F]' apps/mothership/src/http.test.ts docs/superpowers/plans/mothership-agent-operating-system.md docs/superpowers/plans/mothership-replacement-coverage-audit.md
```

Result: strict E2E preflight blocked on this shell because `DATABASE_URL`, `SIM_AGENT_API_URL`, `SIM_BASE_URL`, `SIM_TO_MOTHERSHIP_API_KEY`, `MOTHERSHIP_ADMIN_API_KEY`, `MOTHERSHIP_TO_SIM_CALLBACK_KEY`, `MOTHERSHIP_ANTHROPIC_API_KEY`, and `MOTHERSHIP_OPENAI_API_KEY` are not exported. That is an external-environment blocker for E2E proof, not a product-completion claim. The focused CliProxyAPI/subagent HTTP test target passed with 18 tests and 130 skipped. Full `mship-service:check` passed with Biome, TypeScript, and 13 files / 285 tests. Stream fixture validation passed with 24 valid fixtures and 10 expected invalid-fixture rejections. Aggregate `mship:check` passed with generated contracts up to date. `mship-client:check` passed with Biome, TypeScript, and 2 files / 23 tests. Diff, trailing-whitespace, and ASCII checks passed. The new regression proves that when CliProxyAPI emits a `workflow` subagent tool call, Mothership reports already-incurred CliProxyAPI billing, emits a `go` executor tool-call event, publishes terminal `owned_subagent_continuation_not_implemented`, marks the run failed, does not call the workflow subagent callback, does not create a Sim tool checkpoint, and does not mark the run paused. `docs/superpowers/plans/mothership-agent-operating-system.md` now reflects the current state: CliProxyAPI Sim-tool checkpoint/resume is accepted, while CliProxyAPI workflow subagent callback continuation remains deliberately unsupported until real provider/browser E2E proves the need and safety of a separate Chat Completions continuation path. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: this closes the decision/regression only; it does not prove strict E2E, live provider behavior, or production subagent parity.

## Verification Performed For OpenAI Pricing Modes

Task 63 checks run after closing the current provider-pricing calculator gap that could be safely advanced without secrets, Docker, registry, or cluster access:

```bash
bun run --cwd apps/mothership test src/pricing-policy.test.ts
bun run --cwd apps/mothership type-check
bun run mship-service:check
bun run mship-fixtures:check
bun run mship:check
bun run mship-client:check
```

Result: focused pricing-policy tests passed with 9 tests. `apps/mothership` type-check passed. Full `mship-service:check` passed with Biome, TypeScript, and 13 files / 287 tests. Stream fixture validation passed with 24 valid fixtures and 10 expected invalid-fixture rejections. Aggregate `mship:check` passed with generated contracts up to date. `mship-client:check` passed with Biome, TypeScript, and 2 files / 23 tests. Official OpenAI pricing was checked on 2026-06-22 before adding explicit calculator support for `standard`, `batch`, `flex`, and `priority` pricing modes plus the 10% regional processing uplift for configured eligible GPT-5.4/GPT-5.5-family models. Unsupported mode/model combinations fail closed, including `gpt-5.5-pro` batch/flex long-context pricing, `gpt-5.5-pro` priority pricing, unmodeled `gpt-4.1` batch/regional pricing, and invalid runtime mode strings. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: this closes pricing calculator policy only; runtime hosted billing still uses standard mode until a trusted provider-processing mode is carried from the actual request/deployment path, pricing remains an in-code reviewed policy rather than generated or snapshotted source automation, and no live provider/browser/deployment E2E was run.

## Verification Performed For FeatureCase Closure Checker Hardening

Task 64 checks run after switching the next unblocked work away from billing/pricing and into the evidence-governed command-plane path:

```bash
bun run --cwd apps/mothership smoke:strict-e2e-preflight
docker info --format '{{json .ServerVersion}}'
kubectl version --client=true --output=yaml
bun run mship-case:check
bunx biome check scripts/check-mothership-feature-case.ts scripts/fixtures/mothership-feature-cases
```

Result: strict-mode real-key E2E preflight is blocked in this shell because `DATABASE_URL`, `SIM_AGENT_API_URL`, `SIM_BASE_URL`, `SIM_TO_MOTHERSHIP_API_KEY`, `MOTHERSHIP_ADMIN_API_KEY`, `MOTHERSHIP_TO_SIM_CALLBACK_KEY`, `MOTHERSHIP_ANTHROPIC_API_KEY`, and `MOTHERSHIP_OPENAI_API_KEY` are not exported. Docker proof is blocked because the local Docker client cannot connect to `/Users/kyin/.colima/default/docker.sock`. Live Kubernetes proof is blocked because `kubectl` is not installed in this shell. `mship-case:check` now validates closed FeatureCase gate evidence for F0-F8, requires concrete `gateEvidence` source prefixes, requires passed `pwd` and `git status --short --branch` proof for F0, requires at least one focused passed verification command for F4, validates real role separation instead of trusting `roleSeparated: true`, requires each review to name a listed reviewer, scans forbidden completion/E2E/deployment/billing claims across objective, proof text, claims, review findings, and next action, and requires invalid fixtures to name their expected failure reasons. The valid closed-case fixture passes, and invalid fixtures now prove rejection for fake E2E claims, missing evidence review, missing handoff, next-action overclaim, fake role separation, and weak closure evidence. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: this is a local machine-checkable closure gate and ledger prerequisite only; it does not create the case ledger, backend API, UI, browser/provider E2E proof, Docker proof, Kubernetes proof, or replacement-complete claim.

## Verification Performed For FeatureCase Ledger

Task 65 checks run after adding the first append-only case ledger over the hardened FeatureCase checker:

```bash
bun run --cwd apps/mothership smoke:strict-e2e-preflight
docker info --format '{{json .ServerVersion}}'
kubectl version --client=true --output=yaml
bun run mship-case:check
bun run mship-case-ledger:check
bun run scripts/mothership-feature-case-ledger.ts list
bunx biome check scripts/check-mothership-feature-case.ts scripts/mothership-feature-case-ledger.ts scripts/fixtures/mothership-feature-cases docs/superpowers/ledgers/mothership-feature-cases.jsonl docs/superpowers/plans/mothership-agent-operating-system.md docs/superpowers/plans/mothership-replacement-coverage-audit.md docs/README.md package.json
bunx tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2020 --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --allowImportingTsExtensions scripts/check-mothership-feature-case.ts scripts/mothership-feature-case-ledger.ts
```

Result: strict-mode real-key E2E preflight remains blocked in this shell because `DATABASE_URL`, `SIM_AGENT_API_URL`, `SIM_BASE_URL`, `SIM_TO_MOTHERSHIP_API_KEY`, `MOTHERSHIP_ADMIN_API_KEY`, `MOTHERSHIP_TO_SIM_CALLBACK_KEY`, `MOTHERSHIP_ANTHROPIC_API_KEY`, and `MOTHERSHIP_OPENAI_API_KEY` are not exported. Docker proof remains blocked because the local Docker client cannot connect to `/Users/kyin/.colima/default/docker.sock`. Live Kubernetes proof remains blocked because `kubectl` is not installed in this shell. `docs/superpowers/ledgers/mothership-feature-cases.jsonl` now records the first hash-chained FeatureCase snapshot event with sequence, event id, appended timestamp, embedded validated case, case digest, previous-entry digest, entry digest, coverage audit path, handoff path, and list-ready summary fields. `mothership-feature-case-ledger.ts` can append a validated case, check the ledger, and list current case summaries. `mship-case-ledger:check` validates the real ledger and rejects synthetic duplicate-event-id, bad-case-digest, broken-hash-chain, and summary-drift cases. The checker remains read-only. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: this creates a local append-only ledger foundation only; it does not create the control-panel backend, YES UI, browser/provider E2E proof, Docker proof, Kubernetes proof, or replacement-complete claim.

## Verification Performed For FeatureCase Control-Panel Backend

Task 66 checks run after adding the first read-only control-panel backend over the FeatureCase ledger:

```bash
bun run --cwd apps/mothership smoke:strict-e2e-preflight
docker info --format '{{json .ServerVersion}}'
kubectl version --client --output=json
bun run --cwd apps/sim test lib/mothership/control-panel/feature-case-ledger.test.ts app/api/mothership/control-panel/feature-cases/route.test.ts
bunx biome check apps/sim/lib/api/contracts/mothership-control-panel.ts apps/sim/lib/api/contracts/index.ts apps/sim/lib/mothership/control-panel/feature-case-ledger.ts apps/sim/lib/mothership/control-panel/feature-case-ledger.test.ts apps/sim/app/api/mothership/control-panel/feature-cases/route.ts apps/sim/app/api/mothership/control-panel/feature-cases/route.test.ts scripts/check-api-validation-contracts.ts
bun run check:api-validation
bun run check:api-validation:strict
bun run --cwd apps/sim type-check
bun run mship-case:check
bun run mship-case-ledger:check
```

Result: strict-mode real-key E2E preflight remains blocked in this shell because `DATABASE_URL`, `SIM_AGENT_API_URL`, `SIM_BASE_URL`, `SIM_TO_MOTHERSHIP_API_KEY`, `MOTHERSHIP_ADMIN_API_KEY`, `MOTHERSHIP_TO_SIM_CALLBACK_KEY`, `MOTHERSHIP_ANTHROPIC_API_KEY`, and `MOTHERSHIP_OPENAI_API_KEY` are not exported. Docker proof remains blocked because the local Docker client cannot connect to `/Users/kyin/.colima/default/docker.sock`. Live Kubernetes proof remains blocked because `kubectl` is not installed in this shell. The new `listMothershipFeatureCasesContract` exposes a typed, read-only `/api/mothership/control-panel/feature-cases` contract with `caseId` and bounded `limit` query support. The route authenticates the user session before parsing query input, reads the repo-local ledger through `readFeatureCaseLedger`, returns current case summaries for UI use, and fails closed on ledger corruption. The reader validates JSONL entries, embedded-case digests, entry digests, case-path drift, duplicate event IDs, sequence continuity, previous-entry linkage, nondecreasing timestamps, filters, and newest-first limits. Focused tests cover the real ledger summary, case filtering, duplicate-event rejection, tamper rejection, success route behavior, auth-before-query-parse, invalid query rejection, and fail-closed reader errors. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: this creates the backend source for the YES UI only; it does not create the UI, browser/provider E2E proof, Docker proof, Kubernetes proof, or replacement-complete claim.

## Verification Performed For FeatureCase Control-Panel UI

Task 67 checks run after adding the first workspace UI over the FeatureCase control-panel backend:

```bash
pwd
git status --short --branch
bun run --cwd apps/mothership smoke:strict-e2e-preflight
docker info --format '{{json .ServerVersion}}'
kubectl version --client --output=json
curl -sS 'http://localhost:6888/api/mothership/control-panel/feature-cases?limit=100'
bunx biome check apps/sim/lib/api/contracts/mothership-control-panel.ts apps/sim/hooks/queries/mothership-control-panel.ts apps/sim/hooks/queries/mothership-control-panel.test.ts 'apps/sim/app/workspace/[workspaceId]/mothership/page.tsx' 'apps/sim/app/workspace/[workspaceId]/mothership/mothership-control-panel.tsx' 'apps/sim/app/workspace/[workspaceId]/mothership/mothership-control-panel.test.ts' 'apps/sim/app/workspace/[workspaceId]/w/components/sidebar/sidebar.tsx'
bun run --cwd apps/sim test hooks/queries/mothership-control-panel.test.ts 'app/workspace/[workspaceId]/mothership/mothership-control-panel.test.ts'
bun run --cwd apps/sim type-check
bun run check:api-validation:strict
bun run check:react-query
bun run mship-case:check
bun run mship-case-ledger:check
Playwright headless load of http://localhost:6888/workspace/e16205a1-7107-4ab0-9eb1-dfb46028bc14/mothership
```

Result: strict-mode real-key E2E preflight remains blocked in this shell because `DATABASE_URL`, `SIM_AGENT_API_URL`, `SIM_BASE_URL`, `SIM_TO_MOTHERSHIP_API_KEY`, `MOTHERSHIP_ADMIN_API_KEY`, `MOTHERSHIP_TO_SIM_CALLBACK_KEY`, `MOTHERSHIP_ANTHROPIC_API_KEY`, and `MOTHERSHIP_OPENAI_API_KEY` are not exported. Docker proof remains blocked because the local Docker client cannot connect to `/Users/kyin/.colima/default/docker.sock`. Live Kubernetes proof remains blocked because `kubectl` is not installed in this shell. The quoted API curl returned `success: true`, `eventCount: 2`, `ledgerPath: docs/superpowers/ledgers/mothership-feature-cases.jsonl`, and `task-67-control-panel-ui` as the newest case after appending the UI slice into the hash-chained ledger. The new workspace route `/workspace/[workspaceId]/mothership` renders the control-panel shell in the existing `Resource` layout, with a contract-bound React Query hook over `requestJson`, sidebar navigation, search, summary counts, hard-gate status strip, case list, case detail, claims, non-claims, blockers, evidence commands, reviews, grade, next action, and ledger digest/path details. Headless Playwright against the local dev server loaded the route for workspace `e16205a1-7107-4ab0-9eb1-dfb46028bc14`, found two ledger events, `task-67-control-panel-ui`, `task-64-case-runner`, the Browser/provider E2E gate, no failed-load state, and Docker/image proof marked `Blocked / unproven`; final screenshot: `/var/folders/mc/qjwd1ld97_bfhl86xpbfrpp00000gn/T/sim-mothership-ui-ledger-two-cases.png`. A read-only subagent review (`019eedbe-95d5-7c02-b3a3-6aafffbb7e08`) found that scanning `claimsAdvanced` made future positive hard-gate claims display as blocked; the classifier now derives blocked hard-gate status only from `nonClaims` and `blockers`, adds `image-build` coverage for the Docker blocker, and the regression test covers positive claims not marking Browser/provider E2E as blocked. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: this creates and locally browser-renders the YES control-panel UI over the evidence ledger, but it does not prove real provider/browser E2E, Docker build/push, live Kubernetes service/CronJob execution, or replacement completion.

## Verification Performed For FeatureCase Artifact Drill-Through

Task 68 checks run after adding authenticated artifact drill-through from the Mothership control panel to ledger-backed case, coverage-audit, and handoff artifacts:

```bash
pwd
git status --short --branch
bun run --cwd apps/mothership smoke:strict-e2e-preflight
docker info --format '{{json .ServerVersion}}'
kubectl version --client --output=json
bunx biome check apps/sim/lib/api/contracts/mothership-control-panel.ts apps/sim/lib/mothership/control-panel/feature-case-ledger.ts apps/sim/lib/mothership/control-panel/feature-case-ledger.test.ts apps/sim/app/api/mothership/control-panel/feature-case-artifact/route.ts apps/sim/app/api/mothership/control-panel/feature-case-artifact/route.test.ts 'apps/sim/app/workspace/[workspaceId]/mothership/mothership-control-panel.tsx' 'apps/sim/app/workspace/[workspaceId]/mothership/mothership-control-panel.test.ts' scripts/check-api-validation-contracts.ts
bun run --cwd apps/sim test lib/mothership/control-panel/feature-case-ledger.test.ts app/api/mothership/control-panel/feature-case-artifact/route.test.ts 'app/workspace/[workspaceId]/mothership/mothership-control-panel.test.ts'
bun run --cwd apps/sim type-check
bun run check:api-validation:strict
bun run check:react-query
bun run mship-case:check
bun run mship-case-ledger:check
curl -sS -D - 'http://localhost:6888/api/mothership/control-panel/feature-case-artifact?eventId=task-67-control-panel-ui%3A2026-06-22T05%3A14%3A42.000Z&artifact=case'
curl -sS -D - 'http://localhost:6888/api/mothership/control-panel/feature-case-artifact?eventId=task-67-control-panel-ui%3A2026-06-22T05%3A14%3A42.000Z&artifact=handoff'
curl -sS -o /tmp/sim-mship-forbidden.out -w '%{http_code}\n' 'http://localhost:6888/api/mothership/control-panel/feature-case-artifact?eventId=missing&artifact=case'
Playwright headless load of http://localhost:6888/workspace/e16205a1-7107-4ab0-9eb1-dfb46028bc14/mothership
```

Result: strict-mode real-key E2E preflight remains blocked in this shell because `DATABASE_URL`, `SIM_AGENT_API_URL`, `SIM_BASE_URL`, `SIM_TO_MOTHERSHIP_API_KEY`, `MOTHERSHIP_ADMIN_API_KEY`, `MOTHERSHIP_TO_SIM_CALLBACK_KEY`, `MOTHERSHIP_ANTHROPIC_API_KEY`, and `MOTHERSHIP_OPENAI_API_KEY` are not exported. Docker proof remains blocked because the local Docker client cannot connect to `/Users/kyin/.colima/default/docker.sock`. Live Kubernetes proof remains blocked because `kubectl` is not installed in this shell. The new `getMothershipFeatureCaseArtifactContract` exposes a text-mode, typed query contract for `/api/mothership/control-panel/feature-case-artifact` with an `eventId` plus `case | coverage-audit | handoff` artifact enum. The route authenticates the user session before query parsing, returns text/plain artifacts with `Content-Disposition` and `X-Mothership-Artifact-Path`, and maps missing artifacts to 404 and forbidden paths to 403. The ledger reader now supports selected artifact reads, rejects absolute or parent-traversal repo artifacts, requires handoffs to use the Sim Mothership markdown filename convention under the temp directory, caps artifact size at 2 MiB, and uses `realpathSync` checks so repo-relative or temp symlinks cannot escape the allowed roots. The control-panel detail view now selects cases by `eventId` and renders artifact links for Case JSON, Coverage Audit, and Handoff. Focused tests cover success, auth-before-query-parse, invalid query rejection, missing/forbidden/unexpected route errors, artifact reads, unknown events, forbidden handoffs, and symlink escapes. API validation strict mode now has a route-count baseline of 861 because this route was added; boundary metrics were not weakened. `mship-case:check` now validates `artifact-drill-through.json`, and `mship-case-ledger:check` validates the hash-chained ledger with three events. Local control-panel API proof returned `success: true`, `eventCount: 3`, and `task-68-artifact-drill-through` as the newest case. Local curl proof returned 200 for the Task 68 case and handoff artifacts. Headless Playwright against installed Google Chrome found Task 68 in the local UI, found the Case JSON, Coverage Audit, and Handoff links for that event, and found no failed-load state; final screenshot: `/var/folders/mc/qjwd1ld97_bfhl86xpbfrpp00000gn/T/sim-mothership-ui-task68-ledgered.png`. A read-only subagent review (`019eedcd-cc62-7cc1-a5a0-54e4c8fb27c7`) found three issues: symlink escape risk, API-validation route-count baseline failure, and wrong artifact selection when multiple ledger events share a `caseId`. All three were fixed and covered by regression tests or the strict API validation rerun. A documentation subagent review (`019eeddd-eccc-7a42-af5e-4618bc96741a`) required this Task 68 FeatureCase, handoff, and ledger append before closure; this is now done. Grok CLI review session `019eede0-d20c-76a0-a0e6-d2a25ae98168` confirmed safe promotion only for local artifact drill-through and called out workspace authorization, E2E, Docker, Kubernetes, and completion as non-claims; export: `/var/folders/mc/qjwd1ld97_bfhl86xpbfrpp00000gn/T/sim-mothership-grok-cli-task68-review-20260622T054954Z.md`. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: this creates authenticated local artifact drill-through for the control-panel ledger, but it does not prove real provider/browser E2E, Docker build/push, live Kubernetes service/CronJob execution, autonomous swarm completion, or replacement completion.

## Verification Performed For FeatureCase Review Evidence Panels

Task 69 checks run after grouping FeatureCase reviews into source-authority evidence panels in the workspace Mothership control panel:

```bash
bunx biome check 'apps/sim/app/workspace/[workspaceId]/mothership/mothership-control-panel.tsx' 'apps/sim/app/workspace/[workspaceId]/mothership/mothership-control-panel.test.ts'
bun run --cwd apps/sim test mothership-control-panel.test
bun run --cwd apps/sim type-check
bun run check:api-validation:strict
bun run check:react-query
bun run mship-case:check
bun run mship-case-ledger:check
```

Result: strict-mode real-key E2E preflight, Docker proof, and live Kubernetes proof remain blocked in this shell (missing env/secrets, no Docker socket, no `kubectl`). The control-panel detail view replaces the flat reviews list with three source-authority panels — Subagent, Grok CLI, and Oracle — grouped by reviewer family via the pure, exported `classifyReviewerFamily` and `getReviewFamilyGroups`; the three families always render in fixed order with an honest empty-state, an Other panel appears only for unmatched reviewers, each panel carries a jurisdiction subtitle and count badge, and findings render as bulleted lists. The change is frontend read-side only and adds no API routes, contract changes, or ledger-writing code. The implementation was produced by a Fusion orchestration (grok + codex + mimo panel, three of three usable, grok judge at high confidence, codex synthesis); the Oracle (GPT-5.5 Pro, browser) final-vision review contributed the source-authority/jurisdiction framing, and a second Oracle review ranked the next slice as verdict-first case detail. Focused tests (11) cover classification, fixed ordering, empty Oracle, and Other-only-when-present. Biome, app type-check, `check:api-validation:strict`, and `check:react-query` pass. `mship-case:check` now validates `review-evidence-panels.json`, and `mship-case-ledger:check` validates the hash-chained ledger with four events. Independent role-separated reviews: spec by the Oracle vision review, code by the Grok fusion judge, and evidence by an independent `typescript-reviewer` subagent (verdict PASS, with non-blocking P2/P3 notes). The slice was committed at `00cbeac16` and appended to the ledger as the fourth event, so the Oracle panel now renders real review evidence. The new panels are not yet proven in a running browser. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: this groups review evidence into local source-authority panels with focused tests, policy checks, a fusion-built implementation, and independent role-separated reviews, but it does not prove real provider/browser E2E, Docker build/push, live Kubernetes service/CronJob execution, autonomous swarm completion, or replacement completion.

## Verification Performed For Verdict-First Case Detail

Task 70 checks run after redesigning the selected FeatureCase detail into a verdict-first Verdict Stack and surfacing `capReason`:

```bash
bun run --cwd apps/sim test mothership-control-panel.test
bun run --cwd apps/sim type-check
bun run check:api-validation:strict
bun run check:react-query
bun run mship-case:check
bun run mship-case-ledger:check
```

Result: external provider/browser E2E, Docker, and Kubernetes proofs are deferred to the final deployment phase (the operator runs only Sim locally). The selected case detail now leads with a `VerdictHeader` (decision and grade instruments, a human-readable cap reason via `formatCapReason`, an imperative next action, and a claims/non-claims summary); raw ledger metadata moved to a subordinate `QuietDetailSection` footer with no fields dropped. `capReason` is now optional in the contract `featureCaseSnapshotSchema.grade` and `mothershipControlPanelCaseSchema`, mapped from `event.case.grade.capReason`. `formatCapReason` and `formatClaimsNonClaimsSummary` are pure, exported, and unit-tested. The implementation was produced by a Fusion orchestration (grok + codex + mimo panel, grok judge at high confidence, codex synthesis; a panelist's `font-semibold` was corrected to `font-medium` before applying). Independent role-separated reviews: spec by the Oracle next-move review, code by the Grok fusion judge, evidence by an independent grok inline-diff review (verdict PASS, grade A, one non-blocking P3). Committed at `e532ccd2f`, appended to the ledger as the fifth event. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: safe local verdict-first detail; external deploy gates deferred; not yet proven in a running browser.

## Verification Performed For Artifact Exhibits

Task 71 checks run after upgrading the case-detail artifact links into evidence exhibit cards:

```bash
bunx biome check 'apps/sim/app/workspace/[workspaceId]/mothership/mothership-control-panel.tsx'
bun run --cwd apps/sim test mothership-control-panel.test
bun run --cwd apps/sim type-check
bun run check:api-validation:strict
bun run check:react-query
bun run mship-case:check
bun run mship-case-ledger:check
```

Result: external provider/browser E2E, Docker, and Kubernetes proofs are deferred to the final deployment phase. Each artifact (Case JSON, Coverage Audit, Handoff) now renders as an evidence exhibit card with a per-type icon, an "Exhibit" seal, the backing event ID (`shortDigest`), an inset path panel, a copy-to-clipboard button with a visible "Copied" confirmation that clears its timer on re-click and unmount, and an Open action. `getFeatureCaseArtifactRows` carries `type` and `eventId` while keeping `id`/`label`/`path`/`href`; a new exported `getFeatureCaseArtifactIcon` maps type to icon. The change is frontend read-side only and reuses the existing artifact route. Built by a Fusion orchestration (grok + codex + mimo panel, grok judge at high confidence, codex synthesis; candidate C disqualified for wrong artifact keys and nonexistent icons; all referenced icons verified to exist before applying). Independent role-separated reviews: spec by the Oracle next-move review, code by the Grok fusion judge, evidence by an independent grok inline-diff review (verdict PASS, grade A, two non-blocking P3s). Committed at `97be2c0ac`, appended to the ledger as the sixth event. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: safe local artifact-exhibit upgrade; external deploy gates deferred; not yet proven in a running browser.

## Verification Performed For F0-F8 Gate Rail

Task 72 checks run after surfacing FeatureCase `gateEvidence` and rendering a compact F0-F8 gate rail in the verdict header:

```bash
bunx biome check 'apps/sim/app/workspace/[workspaceId]/mothership/mothership-control-panel.tsx'
bun run --cwd apps/sim test mothership-control-panel.test
bun run --cwd apps/sim type-check
bun run check:api-validation:strict
bun run check:react-query
bun run mship-case:check
bun run mship-case-ledger:check
```

Result: external provider/browser E2E, Docker, and Kubernetes proofs are deferred to the final deployment phase. `gateEvidence` is now an optional typed field (`z.record(z.string(), z.array(z.string()))`) in `featureCaseSnapshotSchema` and `mothershipControlPanelCaseSchema`, mapped from `event.case.gateEvidence`. The verdict header renders a compact, non-dominant gate rail of F0–F8 derived by the pure exported `getGateRailItems`: a gate is `passed` when its evidence is non-empty, `pending` when empty, and F8 (Promoted) stays `partial` unless `decision === 'PROMOTE'` — so `CLOSE_SAFE_PARTIAL` cases never overclaim promotion. The implementation was produced by a Fusion orchestration (grok + codex + mimo panel, grok judge at high confidence, codex synthesis; candidate C rejected for inline styles and wrong import path, candidate B empty). Independent role-separated reviews: spec by the Oracle next-move review, code by the Grok fusion judge, evidence by an independent grok inline-diff review (verdict PASS, grade B; non-blocking notes on hardcoded status hex consistent with the file's existing palette, a loosely-typed `decision`, and a couple of omitted test assertions). Committed at `81f8544a2`, appended to the ledger as the seventh event. Grade: `B_CLOSE_SAFE_PARTIAL`. Cap reason: safe local gate rail; external deploy gates deferred; not yet proven in a running browser.

## Not Yet Verified

These are deliberately not claimed complete:

1. `apps/mothership` exists and boots for health/readiness, implements owned runtime model listing, owned title generation, owned fork acknowledgement, admin-key-gated BYOK list/upsert/delete, runtime validate-key list/generate/delete, initial runtime API-key entitlement preflight to Sim, API-key resume/tool-result entitlement preflight to Sim before checkpoint mutation with durable workspace-only authorization, billing update-cost callback emission/idempotency plus durable billing-only outbox for owned Anthropic text/tool/resume streams, BYOK validation callback-gated Anthropic and OpenAI key selection, BYOK resume source preservation, explicit abort, resume-result intake, owned runtime routes for `/api/copilot`, `/api/mothership`, and `/api/mothership/execute`, first Anthropic text and tool/resume provider continuation, first OpenAI Responses text and tool/resume provider continuations, first CliProxyAPI text and Sim-tool/resume provider continuation, OpenAI edge coverage, OpenAI tool/resume public stream fixtures, workflow-subagent public stream fixtures including `completed`, `needs_input`, and cancelled result branches, subagent-route fail-closed guards, explicit CliProxyAPI workflow-subagent fail-closed deferral, first owned workflow subagent spec, strict workflow subagent callback contract/helper/Sim route, initial provider-kernel workflow subagent continuation through the callback helper, provider-resume workflow-subagent continuation through stored strict context, first Sim workflow subagent execution engine, explicit workflow-subagent `needs_input` classification, durable workflow child `parentRunId` persistence/conflict detection, and DB-backed run/checkpoint/tool-result/event/BYOK/API-key seams. It does not yet implement mixed Sim+subagent provider batches, provider-internal OpenAI parser edge fixtures beyond HTTP tests, future-provider BYOK/billing breadth, production parent-child rollup views, or full provider breadth.
2. Sim now imports selected `@sim/mothership-contracts` route contracts for owned runtime helpers, including strict replay consumption. The generated stream parser remains in place for browser-facing event handling until the full stream runtime migration is complete.
3. `packages/mothership-client` exists and passes focused checks; models, validate-key list/delete/generate, explicit abort, chat abort's Mothership marker, chat fork, title generation, BYOK hosted/owned admin auth selection, strict callback invocation, and strict-mode replay consumption use it. Initial stream POST still uses the current Sim read/write path; strict stream auth, required trimmed run/workspace identity forwarding, strict replay consumption, owned validate-key storage, owned Anthropic text streaming, owned Anthropic billing callback emission, first owned Anthropic tool/resume continuation, first owned OpenAI Responses text streaming, first owned OpenAI tool/resume provider-kernel continuation, first owned CliProxyAPI text streaming and Sim-tool/resume continuation, owned title generation, owned fork acknowledgement, fail-closed subagent-route guards, and first workflow subagent execution are tested. Browser/client E2E for OpenAI tool/resume, CliProxyAPI real-key browser use, and real subagent continuation are not complete.
4. New service-auth headers exist in package contracts/client helpers, the Sim service-auth helper, the `apps/mothership` runtime routes, and the storage-backed `apps/mothership` admin BYOK route family.
5. Startup secret topology validation now requires callback and runtime keys when hosted/runtime URLs or the legacy runtime key are configured; `apps/mothership` production startup requires admin, BYOK encryption, API-key encryption, callback secret, and Sim callback base URL now that admin BYOK, validate-key storage, and initial runtime entitlement preflight exist, while dev/test can omit affected secrets and fail closed on affected routes. Helm only requires the runtime key when Copilot/Mothership runtime is configured.
6. Wrong-key auth matrix tests pass for the Sim callback helper, callback routes, `apps/mothership` runtime routes, initial runtime API-key entitlement preflight, and the storage-backed `apps/mothership` admin BYOK route boundary.
7. Stream fixtures validate against the generated JSON Schema and current Sim parser through `bun run mship-fixtures:check`; the owned service has durable append/read, replay-only serving, persist-before-enqueue writer, scoped subagent envelope support, Sim strict-mode replay consumption, Mothership restart replay smoke coverage, first owned Anthropic text streaming, first owned Anthropic tool/resume continuation, repeated tool-use-after-resume pause proof, first owned OpenAI Responses text streaming, first owned OpenAI tool/resume provider-kernel HTTP coverage, first owned CliProxyAPI text and Sim-tool/resume provider HTTP coverage, OpenAI tool/resume public stream fixtures, CliProxyAPI tool/resume public stream fixtures, workflow-subagent public stream fixtures, owned pause-only service-leg fixtures, multi-tool pause fixtures, failed-result completion fixtures, cancelled-result completion fixtures, resumed-leg missing-terminal rejection, and owned unsupported-provider terminals. Provider-internal OpenAI parser edge fixtures, real-provider/browser E2E, and live tailing are not implemented yet.
8. Helm lint/template/render assertions now pass using a temporary Helm v3.15.4 binary under `/tmp`, including the owned Mothership service/deployment target and billing processor CronJob target. Helm-unittest local plugin execution now passes in isolated `/tmp` plugin/cache/config/data directories, and the CI gate is wired in `test-build.yml`; actual GitHub Actions execution of that gate is not proven locally. Mothership image publishing workflow wiring exists for ECR/GHCR, but Docker image build and actual registry push are not run because the local Docker daemon is unavailable and CI has not executed here.
9. Migrations `0239_wet_vin_gonzales.sql` and `0240_new_slyde.sql` are additive and pass safety checks; no evidence yet exists for future usage snapshot or BYOK callback idempotency migrations. Owned BYOK storage reuses the existing `workspace_byok_keys` table, owned validate-key storage reuses the existing `api_key` table, and owned billing callback outbox reuses the existing `outbox_event` table with Sim's existing `update-cost` idempotency behavior.
10. Durable abort and resume state can now be updated through owned service seams, but Sim has not yet been run end-to-end against the owned Mothership service for a browser-originated provider-backed chat. Initial runtime streams now preflight API-key entitlement through Sim before run claim. Owned URLs now default to strict runtime auth; hosted `copilot.sim.ai` URLs still default to legacy compatibility.
11. Sim consumes the owned replay route during strict-mode reconnect through the local `/api/copilot/chat/stream` and `/api/mothership/chat/stream` path, and `apps/mothership` restart replay is smoke-tested against a migrated temporary database. No evidence yet that a full browser chat or browser-originated tool/resume loop completes against the owned provider kernel with a real provider key.
12. Billing callback durable rows, immediate delivery, first-delivery worker grace, persisted-payload validation, retry state, dead-letter accounting, stale processing lease reclaim, pending-outbox processor helper, admin-authenticated processor endpoint, and Helm billing processor CronJob render path are tested. No live Kubernetes cluster execution proof exists yet for the CronJob schedule, DNS/service reachability, NetworkPolicy enforcement, image pull, or real callback drain under cluster conditions.
13. No evidence yet that every repo test suite passes. The relevant Mothership/chart/API-boundary/type-check gates pass for completed slices.
14. The Mothership control-panel UI now exists, locally renders ledger-backed FeatureCases in a workspace route, and links selected cases to their case JSON, coverage-audit markdown, and handoff markdown artifacts through an authenticated route. It is not yet a full autonomous operator cockpit: no live provider/browser E2E run is attached to a case, no Docker/Kubernetes proof is attached, no subagent/Oracle transcript viewer exists, and no replacement-complete claim is permitted.
15. No evidence yet that Phase 3 product capabilities are implemented.

## Promoted Tasks

These tasks were added from P2-1 review and should remain active until closed:

1. P2-2 route migration must continue with stream routes only after OTel, abort, retry, and raw response behavior are preserved. Completed non-stream slices: models, validate-key list/delete/generate, explicit abort, chat abort's Mothership marker, chat fork, title generation, and legacy-compatible BYOK proxy preservation.
2. P2-3 must keep runtime/admin/callback keys distinct as owned service routes are added; callback and runtime startup/deployment validation are wired, and `apps/mothership` production now requires admin auth for the storage-backed owned admin BYOK route family.
3. P2-5 full golden fixture expansion is implemented for the current Sim parser. Keep adding fixtures for new owned service writer branches as provider continuation, durable replay, and callback paths land.
4. P2-6 must keep current wire compatibility for `/api/validate-key/*`, empty API-key callback validate responses, and Sim-authoritative billing/BYOK callbacks until a deliberate migration changes both sides. Initial runtime API-key callback preflight is now implemented through the strict Sim callback header.
5. P2-3 admin route-family auth now exists for `/api/admin/byok`; keep extending the same runtime/admin/callback separation as additional owned admin routes are implemented.
6. P2-4/P2-11 must keep a body-size/backpressure policy for every new `apps/mothership` route; the skeleton has a 1 MiB adapter cap, and streaming/runtime routes need explicit route-level limits before accepting larger payloads.
7. P2-6/P2-7 must preserve generic public auth failures for wrong-family secrets. Internal logs may classify families, but public responses must not confirm that an admin/callback/runtime key is valid in another family.
8. P2-11 must add deployment wiring for `apps/mothership` only after protocol routes, persistence, and queue/shutdown semantics have their own checks.
9. P2-6/P2-10 must preserve strict runtime auth for owned `apps/mothership` URLs while keeping legacy mode only as a hosted `copilot.sim.ai` compatibility adapter. Legacy mode must not be treated as final architecture.
10. P2-7 durable run-state seam is in place for abortable runs and the owned explicit-abort route uses it without fake success for missing or already-terminal streams.
11. P2-7 durable checkpoint/tool-result resume intake, durable stream event append/read, replay serving, strict-mode Sim replay consumption, first owned Anthropic billing update-cost callback emission, billing-only callback outbox, and Mothership restart replay smoke are in place. Still required: usage snapshots, BYOK callback-idempotency seams, and live-tail decision before chat/resume/billing routes are accepted as production complete.
12. P2-6/P2-7 owned `POST /api/tools/resume` is wired for result intake, honest failure, and first provider-loop continuation through success/error/cancelled tool-result branches.
13. P2-6/P2-7 owned runtime routes for `POST /api/copilot`, `/api/mothership`, and `/api/mothership/execute` now validate contracts, require exact durable run identity, reject identity/terminal conflicts before SSE, stream first Anthropic non-tool provider output, stream first OpenAI Responses text output, stream first OpenAI Responses tool checkpoint/resume continuations with OpenAI edge coverage, and emit durable unsupported-provider terminals for unsupported branches. Next add subagent provider breadth and real-provider/browser E2E.
14. P2-7/P2-10 replay-only `GET /api/streams/replay` is implemented from `copilot_run_events` in JSON batch and SSE modes, Sim strict-mode reconnect consumes the owned replay batch contract, and `apps/mothership` restart replay smoke passed against a migrated temporary database. Still required: live-tail behavior if the product requires it.
15. Closed P2-7 provider/tool continuation sequence coordination: resume result recording reserves `resumeEventStartSeq` inside the durable resume claim, HTTP consumes the returned sequence without a separate latest-seq read, duplicate `resuming` producers fail before callbacks/mutation/provider fetch, first-append sequence conflicts fail before provider/billing work and release the run back to `paused_waiting_for_tool`, and retryable resumes defer `delivered` marking until terminal success/pause persistence so retries remain possible after provider stream failure while stale checkpoint replay is blocked after a successful pause-again continuation.
16. P2-10 must run Sim end-to-end against an owned `apps/mothership` URL with strict runtime auth before any hosted Copilot fallback is removed.
17. P2-10 strict-mode Sim replay consumption, real `apps/mothership` durable restart replay smoke, first owned Anthropic text provider continuation, and first owned Anthropic tool/resume continuation are implemented. Next prove full browser-originated strict-mode provider chat and tool/resume continuation with a real provider key.
18. P2-6 route parity now serves contract-exposed `POST /api/generate-chat-title` and `POST /api/chats/fork` routes from `apps/mothership`. The fork route is an honest acknowledgement with `copied: false` until a separate owned conversation store exists.
19. P2-6 runtime contract truth now aligns the public request contract with the route invariant: `chatId`, `executionId`, and `runId` are required for durable runtime streams.
20. P2-6/P2-7 first owned Anthropic tool calls, checkpoint pause, tool-result resume, repeated tool-use-after-resume pause, first owned OpenAI Responses text streaming, first owned OpenAI Responses tool checkpoint/resume continuation, OpenAI BYOK source preservation, owned BYOK admin storage, Sim BYOK proxy strict-admin migration, owned validate-key API-key storage, and Sim display-only API-key proxy migration are implemented without weakening terminal-event durability. Multi-tool pause, failed-result, cancelled-result, repeated-tool, and OpenAI public tool/resume stream fixtures now exist. Still required: subagent routing, broader provider breadth, provider-internal OpenAI parser edge fixtures, and real-provider/browser E2E.
21. P2-5/P2-7 owned-service pause-only stream fixtures are added, and fixture validation now treats `run.checkpoint_pause` as a stream-leg terminal while preserving full lifecycle `checkpoint_pause -> resumed -> complete` fixtures.
22. P2-6 validate-key storage, initial runtime API-key callback validation, and resume/tool-result API-key entitlement preflight are no longer gaps for list/generate/delete, first stream admission, or owned tool-result resume admission. Resume entitlement now uses durable run workspace only, rejects mismatched caller workspace hints, rejects malformed provider-request state before mutation, and transactionally rechecks workspace when recording results. Next API-key work is owned deployed URL proof and real strict-mode E2E.
23. P2-8/P2-9 billing `update-cost` callback emission/idempotency is implemented for owned Anthropic text/tool/resume streams: Mothership writes a durable billing-only outbox row, sends cumulative usage/cost to Sim with `x-sim-callback-key`, uses a stable `mothership-run:<runId>:anthropic` idempotency key, treats 409 duplicate handling as completed delivery, and preserves fail-closed ordering before terminal complete/checkpoint pause. BYOK validation callback-gated Anthropic and OpenAI key selection is implemented for initial eligible Mothership streams and BYOK resumes, including hosted fallback on initial rejection and zero hosted billing for BYOK resume. Resume/tool-result API-key entitlement now validates against durable run workspace before recording tool results and keeps retry-flagged provider failures retryable instead of terminal-failing early. Still required: extension of billing/entitlement semantics to future providers without weakening callback/runtime/admin secret separation.
24. P2-8/P2-9 next entitlement work is provider breadth beyond first Anthropic/API-key admission and first OpenAI text/tool-resume/BYOK streaming: extend the same callback-before-mutation and billing-source-preservation rules to future provider adapters, subagent continuations, and any owned tools that produce billable provider work.
25. P2-10 must run real strict-mode Sim-to-`apps/mothership` provider chats with `MOTHERSHIP_ANTHROPIC_API_KEY` and `MOTHERSHIP_OPENAI_API_KEY`, then a tool/resume chat that exercises `executor: sim`, before hosted fallback removal.
26. P2-7 must prove real-provider/browser E2E for successful, failed, cancelled, and repeated tool-use-after-resume behavior before the tool loop is called production complete; fixture and unit coverage now exists for failed/cancelled/repeated result branches.
27. Reviewer-promoted resume hardening is now a future-provider invariant: every provider resume path must use durable run workspace for entitlement, reject caller workspace conflicts, validate stored provider-request shape before tool-result writes, record with a transactional workspace recheck, and preserve retryable runs when `willRetryOnStreamError` is set.
28. Closed P2-11 processor infrastructure wiring: the admin billing callback processor endpoint now has a Helm CronJob target with strict admin-key auth, non-clean batch HTTP failure signaling for retry/dead-letter/lease-lost/stale-reaped outcomes, bounded shell retries, active-deadline validation, selector isolation from the Mothership service, and dedicated egress NetworkPolicy. Remaining production observability work is cluster execution proof plus metrics/dashboards/alerts, not first CronJob wiring.
29. Closed P2-11 chart target: Helm now has a first-class owned `mothership.server` service/deployment target, Mothership-only Secret/ExternalSecret rendering, app auto-targeting to the internal owned service, strict shared-boundary versus Mothership-only secret validation, explicit Mothership secretKeyRefs for shared keys/DB password, NetworkPolicy/PDB integration, docs/examples/schema/tests, and a `docker/mothership.Dockerfile` with `turbo prune @sim/mothership --docker` proof. Do not claim image publishing, Docker build, helm-unittest plugin execution, or billing processor CronJob scheduling from this task.
30. Closed P2-11 real-Postgres billing outbox concurrency proof: `apps/mothership/src/smoke/callback-outbox-concurrency.ts` and `smoke:callback-outbox` now seed two namespaced billing rows, hold the first row locked, prove `claimNextMothershipBillingCallbackOutboxEvent()` skips to the unlocked second row, prove stale complete/retry leases are rejected, prove current complete/retry leases update the row, and delete all inserted smoke rows afterward.
31. P2-11 should decide whether `smoke:callback-outbox` becomes a DB-backed CI/preflight job or remains a documented manual smoke. It requires a migrated Postgres `DATABASE_URL`, so it is intentionally not folded into `mship-service:check` until the CI database contract is explicit.
32. Closed P2-11 image publishing workflow wiring: existing image workflows now include `docker/mothership.Dockerfile`, `ghcr.io/simstudioai/mothership`, and the new `ECR_MOTHERSHIP` secret path for dev/main/staging ECR, main GHCR AMD64/ARM64, and GHCR manifests. Local Docker build and actual registry push remain separately unverified.
33. Closed P2-11 local helm-unittest proof: `helm-unittest` `v0.8.2` installed into isolated `/tmp` Helm plugin/cache/config/data directories and `helm unittest helm/sim` passed with 10 suites and 72 tests. `v1.1.1` is not compatible with the local Helm v3.15.4 binary because it uses `platformHooks`.
34. Closed P2-11 billing processor CronJob: Helm now renders `t-sim-mothership-billing-processor`, sourcing `MOTHERSHIP_ADMIN_API_KEY` by explicit `secretKeyRef`, calling the owned internal Mothership service endpoint, preserving `failOnNonClean` true/false semantics, and avoiding any hosted `copilot.sim.ai` dependency.
35. P2-11 next deployment proof task: run a live Kubernetes smoke for the owned Mothership service plus billing processor CronJob once an image registry/cluster path is available, proving image pull, DNS/service reachability, NetworkPolicy enforcement, admin auth, scheduled Job status, non-clean failure signaling, and real outbox drain against a migrated database.
36. Closed P2-11 helm-unittest CI wiring: `test-build.yml` now pins Helm `v3.15.4`, installs `helm-unittest` `v0.8.2`, and runs `helm unittest helm/sim`. Local workflow YAML parsing, step assertions, and isolated plugin execution pass; actual GitHub Actions execution remains future CI evidence.
37. P2-11 must prove the Mothership image build/push path with a live Docker daemon or CI run: build `docker/mothership.Dockerfile`, push to the selected ECR/GHCR targets, and confirm the Helm default `simstudioai/mothership` image can be pulled by the deployment target.
38. Closed P2-8/P2-9 first OpenAI Responses text provider breadth: `apps/mothership` uses `MOTHERSHIP_OPENAI_API_KEY` for owned OpenAI Responses text streaming, routes explicit OpenAI and supported OpenAI-shaped models to OpenAI, emits durable text/complete/error SSE events, reports cumulative billing to Sim with `mothership-run:<runId>:openai`, kept OpenAI tool requests on an honest unsupported-tool terminal at that text-only checkpoint, keeps non-OpenAI unsupported providers on the existing unsupported terminal, and keeps OpenAI/Anthropic provider keys on Mothership-only env surfaces. OpenAI tool handling is superseded by Task 39.
39. Closed P2-8/P2-9 OpenAI Responses tool checkpoint/resume continuation: `apps/mothership` now sends OpenAI function tools, persists OpenAI function-call checkpoints before pause, resumes with `function_call_output` items, preserves cumulative OpenAI billing and route billing source, keeps retryable stream failures paused without delivered-result marking, supports pause-again continuations, rejects malformed function-call arguments before billing/checkpoint/pause, and rejects malformed/missing-tool/model-drift/unpriced stored OpenAI resume requests before entitlement callbacks or tool-result writes. Remaining work is fixture/E2E/product breadth, not the first provider-kernel continuation.
40. Closed P2-5/P2-7 OpenAI tool/resume public stream fixtures: added producer-style valid fixtures for initial OpenAI checkpoint pause, successful OpenAI resume completion, OpenAI pause-again after resume, and malformed OpenAI function-call arguments as an honest terminal error. Added invalid `openai-tool-resume-truncated.sse` and fixed the Sim parser/read loop so explicit fixture/replay batches can process `checkpoint_pause -> resumed -> terminal`, live streams still stop immediately at checkpoint pause, buffered trailing data after a stop signal is ignored, and a `run.resumed` leg must still end in `complete`, `error`, or another `run.checkpoint_pause`.
41. Closed P2-8/P2-9 OpenAI edge coverage and BYOK source preservation: added provider-specific tests for failed and cancelled OpenAI tool-result branches, multi-tool OpenAI resume ordering even when tool results are recorded out of provider-call order, mixed `item_id`/`output_index` parser interleavings beyond the earlier pause-again HTTP proof, malformed OpenAI function-call shape fail-closed behavior, initial OpenAI BYOK checkpoint source persistence, OpenAI BYOK resume with zero hosted billing, fail-closed stored OpenAI BYOK resume rejection without hosted fallback even when `willRetryOnStreamError` is true, and cached-input OpenAI billing for official GPT-5.4/GPT-5.5 standard rates. `apps/mothership` now resolves OpenAI BYOK through Sim authorization plus encrypted provider-key storage, persists BYOK credential source across checkpoint/resume, and treats BYOK credential failures as terminal authorization/config failures rather than retryable provider stream failures.
42. Closed P2-9 subagent route safety slice: provider-kernel route lookup now comes from `@sim/mothership-contracts`, the stream writer can persist scoped subagent envelopes, and Anthropic/OpenAI provider calls to catalog `route: "subagent"` tools fail closed with terminal `owned_subagent_continuation_not_implemented` instead of being checkpointed as Sim-executed tools. This does not claim real subagent execution.
43. P2-10 next E2E task: run strict-mode browser-originated Sim-to-`apps/mothership` chats with real Anthropic and OpenAI provider keys, including at least one `executor: sim` tool/resume loop, before hosted fallback removal.
44. Closed P2-5/P2-7 fixture-hardening decision: the mixed OpenAI `item_id`/`output_index` parser edge remains provider-kernel HTTP coverage, not a public stream fixture, because the public Mothership stream contract exposes normalized tool-call events and intentionally hides OpenAI provider-internal SSE identifiers.
45. P2-8/P2-9 provider-pricing policy is partially closed by Task 59 and Task 63 for audited source metadata, cached input, long-context thresholds, model aliases, stale-price detection, hosted-runtime stale-policy enforcement before provider fetch/billing, and explicit OpenAI standard/batch/flex/priority plus regional-processing calculator support for configured GPT-5.4/GPT-5.5-family models. Deferred and not active unless explicitly reprioritized: trusted runtime pricing-mode attribution/request inputs, stronger generated-or-snapshotted price-source automation, and live price-validation evidence before billing is called final for every future OpenAI-family model.
46. Closed P2-9 first workflow subagent prerequisite: `apps/mothership/src/subagents/catalog.ts` now defines a repo-owned `workflow` subagent spec tied to the canonical catalog entry, including input/result schemas, instructions, allowed child tools, no nested subagents in the first slice, recursion/round/tool-call limits, inherited parent model/BYOK policy, parent-run billing attribution, and fail-closed behavior for unsupported subagents. This is a prerequisite artifact only and does not enable runtime execution.
47. Closed P2-9 workflow subagent callback contract: `@sim/mothership-contracts` now defines the strict Mothership-to-Sim `workflowSubagentExecuteCallbackContract`, `apps/mothership` has a tested `executeWorkflowSubagentCallback` helper that sends only `x-sim-callback-key`, and Sim has a callback-auth-first route that validates the shared body. This was originally an honest typed-501 boundary and is now superseded by Task 50's real execution engine. No `INTERNAL_API_SECRET`, runtime key, admin key, legacy `x-api-key`, or hosted `copilot.sim.ai` fallback is used for this callback boundary.
48. Closed P2-9 workflow subagent provider-continuation seam: pure initial Anthropic/OpenAI `workflow` subagent tool calls now call `executeWorkflowSubagentCallback`, re-emit callback stream events through the parent stream with fresh parent sequence/cursor and preserved `scope`, publish a `go` executor result, and continue the parent provider with an Anthropic `tool_result` or OpenAI `function_call_output`.
49. Closed P2-9 first workflow subagent public stream fixture task: added valid `workflow-subagent-tool-complete.sse` for parent workflow tool call, scoped workflow subagent span/text/child tool call/result/end, parent workflow result, parent text, and final complete; added invalid `workflow-subagent-child-terminal-leak.sse` to prove a leaked scoped child terminal is rejected before parent continuation events. Task 55 extends this with `needs_input` and cancelled subagent result fixtures.
50. Closed P2-9 first Sim workflow subagent engine: `POST /api/copilot/subagents/workflow/execute` now uses a real callback-authenticated workflow subagent engine that shares the owned workflow subagent spec from `@sim/mothership-contracts`, inherits parent context, exposes only the workflow child-tool allowlist, runs a child headless `/api/mothership` lifecycle with separate child run/execution/stream identity, emits scoped non-terminal child events, enforces workspace/workflow authorization, max depth, max provider rounds, max child tool calls, and disallowed tool aborts, and returns honest completed/cancelled/error callback results without exposing `INTERNAL_API_SECRET` or falling back to hosted `copilot.sim.ai`.
51. Closed P2-9 workflow subagent result-semantics task: Sim's workflow subagent engine now returns explicit contract-shaped `needs_input` results for ambiguous/no-task input, child missing-permission tool failures, cancelled/rejected destructive `delete_folder` actions, and unresolved child tool-confirmation cases. Callback auth, workspace/workflow authorization, depth/tool/provider/disallowed-tool guardrails remain fail-closed callback failures rather than user prompts.
52. Closed P2-9 provider-resume subagent task: owned Anthropic/OpenAI provider checkpoints now store sanitized workflow-subagent callback context, resume restores it, and pure `workflow` subagent calls emitted during provider resume use the same strict Sim callback path instead of the old unsupported-subagent terminal. Mixed Sim+subagent batches remain fail-closed.
53. P2-9/P2-10 next workflow subagent E2E task: run strict-mode browser-originated Sim-to-owned-Mothership workflow subagent chats with real Anthropic and OpenAI provider keys, including at least one child workflow tool execution path, before claiming production subagent parity.
54. Closed P2-9 child-run attribution task: the runtime contract now exposes optional `parentRunId`, Mothership runtime claims persist it into existing `copilot_runs.parent_run_id`, and same-stream claims with a different parent identity fail closed as `run_identity_conflict`. Billing/product rollup over the parent-child tree remains future production-reporting work.
55. Closed P2-9 behavior-specific workflow subagent fixture task: added valid public stream fixtures for `workflow` subagent `needs_input` and `cancelled` result branches, and invalid `workflow-subagent-needs-input-post-terminal-leak.sse` to prove scoped child events cannot publish after the parent terminal.
56. Closed P2-4/P2-8 provider lifecycle and Node streaming reliability slice: provider calls now use a bounded abort signal with `MOTHERSHIP_PROVIDER_REQUEST_TIMEOUT_MS`, runtime/resume/title routes propagate request aborts into provider fetches, provider timeouts publish durable terminal errors, and the Node adapter streams response chunks instead of buffering the whole response before writing. Live browser/provider E2E and deployed streaming proof remain open.
57. Closed P2-8/P2-9 first CliProxyAPI text provider slice: `apps/mothership` now supports explicit `cliproxyapi` and `cliproxy` provider selection, default `gpt-5.5` model selection, configured CliProxyAPI base URL/API key/reasoning effort/max completion tokens, chat-completions text streaming, provider-specific billing idempotency, title generation, sanitized provider errors, strict preflight without requiring Anthropic/OpenAI provider keys, and `/v1/models` readiness checks for the selected model. CliProxyAPI Sim-tool checkpoint/resume is superseded by Task 60; CliProxyAPI workflow subagent tool calls remain unsupported by policy and fail closed.
58. Closed final-vision agent operating-system slice: `docs/superpowers/plans/mothership-agent-operating-system.md` now defines the Adjudicated Evidence OS with always-on orchestration, evaluate/review/grade/iterate after every feature, role-scoped workers/reviewers/graders, grade caps, hard fail gates, coverage-audit/handoff requirements, and a long-loop agent prompt; `docs/README.md` indexes it. It also establishes the long-term self-governing command-plane goal, the YES UI as an evidence-ledger/operator surface rather than a decorative agent board, and allowed subagent/Oracle use with main-agent ownership of final truth. A worker-found `mship-client:check` regression caused by non-UUID runtime test fixtures is fixed, and `mship-client:check` now passes again. This does not promote browser E2E, provider E2E, Docker/registry, Kubernetes, CliProxyAPI tool/resume, pricing-policy, full-suite, or replacement-complete claims.
59. Closed provider-pricing fail-closed guard slice: `apps/mothership/src/pricing-policy.ts` now has 2026-06-22 reviewed source metadata, a refreshed Anthropic source URL, `gpt-5.5-pro` long-context handling, and focused tests for source freshness, aliases, cached input, long-context, and unknown-model failures. `apps/mothership/src/provider-runtime.ts` now blocks hosted Anthropic/OpenAI/CliProxyAPI provider fetches when the policy is stale, blocks hosted cost calculation behind the same freshness assertion, and rejects unpriced Anthropic models before credentials/provider fetch/billing. BYOK zero hosted billing remains preserved for priced models. This does not claim batch/flex/regional/data-residency support, live price validation, live provider/browser E2E, or replacement completion.
60. Closed first CliProxyAPI Sim-tool checkpoint/resume slice: `apps/mothership` now serializes Chat Completions `tools` for CliProxyAPI, captures streamed `delta.tool_calls`, fails malformed tool-call arguments before billing/checkpointing, persists a provider-specific `cliproxyapi` stored request with matching tool definitions and cumulative billing, validates that stored envelope before entitlement callbacks or result writes, resumes with `assistant.tool_calls` plus `role: "tool"` messages, preserves `mothership-run:<runId>:cliproxyapi` billing idempotency, and keeps CliProxyAPI workflow subagent calls unsupported. This does not claim real CliProxyAPI/browser E2E or workflow subagent support.
61. Closed CliProxyAPI Sim-tool public fixture slice: added provider-specific public stream fixtures for CliProxyAPI checkpoint pause, successful tool-result resume completion, and sanitized malformed-arguments terminal error. `mship-fixtures:check` now validates 24 valid fixtures and still rejects 10 invalid fixtures. This does not claim real CliProxyAPI/browser E2E, live replay tailing, or workflow subagent callback support.
62. Closed CliProxyAPI workflow-subagent decision slice: strict E2E preflight was attempted and is blocked by missing local env/secrets, so no E2E claim advanced. CliProxyAPI workflow subagent continuation is intentionally kept fail-closed; a focused regression proves the branch reports incurred billing, emits the unsupported-subagent terminal, marks the run failed, and does not call the workflow subagent callback or create a Sim tool checkpoint. Revisit only after real provider/browser E2E creates evidence that a separate Chat Completions workflow-subagent continuation is necessary and safe.
63. Closed OpenAI provider-pricing mode calculator slice: `apps/mothership/src/pricing-policy.ts` now supports explicit `standard`, `batch`, `flex`, and `priority` OpenAI pricing modes plus regional-processing uplift for configured eligible GPT-5.4/GPT-5.5-family models, with focused tests for batch/flex, priority, regional uplift, long-context batch pricing, unsupported mode/model combinations, and invalid mode strings. This does not claim trusted runtime pricing-mode attribution, generated price-source automation, live price validation, live provider/browser E2E, or billing finality.
64. Closed FeatureCase closure checker hardening slice: `mship-case:check` now validates closed FeatureCase F0-F8 gate evidence, checks concrete gate sources, verifies F0/F4 command proof, validates actual role separation and review actors, scans forbidden overclaims outside `grade.claimsAdvanced`, and requires invalid fixtures to assert expected failure reasons. This converts the first case-runner slice from metadata smoke toward a machine-checkable closure gate. It does not create the case ledger, control-panel backend, YES UI, real provider/browser E2E proof, Docker proof, Kubernetes proof, or replacement-complete claim.
65. Closed first FeatureCase ledger slice: `docs/superpowers/ledgers/mothership-feature-cases.jsonl` now stores a hash-chained FeatureCase snapshot event, and `mship-case-ledger:check` validates append-only sequencing, entry digest, previous-entry digest, embedded-case digest, case-path drift, summary consistency, duplicate event IDs, and current checker validity. This does not create the control-panel backend, YES UI, real provider/browser E2E proof, Docker proof, Kubernetes proof, or replacement-complete claim.
66. Closed first FeatureCase control-panel backend slice: `apps/sim/app/api/mothership/control-panel/feature-cases` now exposes a session-authenticated, contract-bound, read-only route over the hash-chained FeatureCase ledger, and `apps/sim/lib/mothership/control-panel/feature-case-ledger.ts` validates ledger integrity before returning UI-ready case summaries. This creates the backend source for the YES UI. It does not create the UI, real provider/browser E2E proof, Docker proof, Kubernetes proof, or replacement-complete claim.
67. Closed first YES control-panel UI slice: `apps/sim/app/workspace/[workspaceId]/mothership` now renders FeatureCase summaries and details from the contract-bound control-panel backend, `apps/sim/hooks/queries/mothership-control-panel.ts` provides the React Query client path, and the workspace sidebar links to Mothership. A local dev-server Playwright proof rendered the route and fixed the reviewer-found hard-gate classifier bug. This does not claim real provider/browser E2E, Docker proof, Kubernetes proof, autonomous swarm completion, or replacement completion.
68. Closed FeatureCase artifact drill-through slice: `apps/sim/app/api/mothership/control-panel/feature-case-artifact` now serves selected ledger-backed case JSON, coverage audit, and handoff text artifacts after session auth, `apps/sim/lib/mothership/control-panel/feature-case-ledger.ts` enforces repo/temp realpath containment and size bounds, and the workspace Mothership UI links to those artifacts by `eventId`. A subagent-found symlink escape risk, route-count baseline failure, and `caseId` selection bug were fixed. This does not claim real provider/browser E2E, Docker proof, Kubernetes proof, autonomous swarm completion, or replacement completion.

69. Closed FeatureCase review evidence panels slice: the workspace Mothership control panel now groups case reviews into source-authority panels (Subagent, Grok CLI, Oracle) by reviewer family via pure, exported `classifyReviewerFamily`/`getReviewFamilyGroups`, each labeled with its jurisdiction, with an honest empty Oracle state and an Other panel only for unmatched reviewers. Built via Fusion (grok+codex+mimo panel, grok judge, codex synth) with the Oracle final-vision review contributing the source-authority framing, and closed with independent role-separated spec, code, and evidence reviews. Frontend read-side only; committed at `00cbeac16` and appended to the ledger as the fourth event. This does not claim real provider/browser E2E, Docker proof, Kubernetes proof, runtime browser render of the new panels, autonomous swarm completion, or replacement completion.

70. Closed verdict-first case detail slice: the selected FeatureCase detail leads with a `VerdictHeader` (decision/grade instruments, human-readable cap reason, imperative next action, claims/non-claims summary) and moves raw ledger metadata into a subordinate quiet footer; `capReason` is surfaced through the contract and ledger mapper as an optional field; `formatCapReason`/`formatClaimsNonClaimsSummary` are pure, exported, unit-tested. Fusion-built, independent role-separated spec/code/evidence reviews (PASS, grade A). Committed at `e532ccd2f`, ledger event five. This does not claim real provider/browser E2E, Docker proof, Kubernetes proof, runtime browser render, autonomous swarm completion, or replacement completion.

71. Closed artifact exhibits slice: case-detail artifact links upgraded to evidence exhibit cards (per-type icon, Exhibit seal, backing event ID, inset path panel, copy-to-clipboard with confirmation and unmount cleanup, Open action); `getFeatureCaseArtifactRows` carries `type`/`eventId` without dropping fields; adds exported `getFeatureCaseArtifactIcon`. Frontend read-side only, reuses the existing artifact route. Fusion-built (candidate C disqualified), independent role-separated reviews (PASS, grade A). Committed at `97be2c0ac`, ledger event six. This does not claim real provider/browser E2E, Docker proof, Kubernetes proof, runtime browser render, autonomous swarm completion, or replacement completion.

72. Closed F0-F8 gate rail slice: FeatureCase `gateEvidence` surfaced through the contract and ledger mapper as an optional typed field; the verdict header renders a compact F0-F8 rail derived by the pure exported `getGateRailItems` (passed/partial/pending; F8 partial unless decision is PROMOTE). Fusion-built, independent role-separated reviews (PASS, grade B). Committed at `81f8544a2`, ledger event seven. This completes the local cockpit queue (review panels, verdict-first detail, artifact exhibits, gate rail). This does not claim real provider/browser E2E, Docker proof, Kubernetes proof, runtime browser render, autonomous swarm completion, or replacement completion.

## Next Required Action

Deferred to the final deployment phase (bundled together, not pursued until explicitly reprioritized at the very end): owned Mothership image build/push (Docker), live Kubernetes service plus CronJob smoke, the real-key browser/provider E2E that depends on production hosting, and all provider-pricing/billing/payment work. The operator runs only Sim locally, so these prod-deploy and billing gates are intentionally the last milestone, not the next one. Until then, continue the command-plane path by turning the control panel into an active closure cockpit: append every closed slice into the FeatureCase ledger, refresh the UI against the new ledger event, expose subagent/Oracle review evidence, and add next-action execution controls without weakening the non-claim gates. Provider-pricing and billing-only work are deferred unless explicitly reprioritized. Keep CliProxyAPI workflow subagent callbacks fail-closed unless later real E2E evidence justifies implementing a separate Chat Completions continuation path. Each slice must keep auth before parsing, stream only contract-valid SSE events, preserve terminal-event invariants, append durable terminal events before status mutation, preserve billing-source identity across checkpoint/resume, validate entitlement before durable mutation or billable provider work, keep entitlement callbacks synchronous fail-closed, carry the durable-workspace/provider-request/retry invariants into future provider adapters, and fail honestly for unsupported provider/tool branches.
