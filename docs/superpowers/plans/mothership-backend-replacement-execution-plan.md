# Owned Mothership Backend Replacement Execution Plan

Date: 2026-06-22

Status: Active Phase 2 and Phase 3 execution artifact. G0 is in place; Phase 2 workstreams are partially implemented and Phase 3 remains in flight, with current progress tracked in [Mothership replacement coverage audit](mothership-replacement-coverage-audit.md).

## Operating Rule

This is not an MVP plan. Each milestone must move toward the final owned Mothership system:

1. Dedicated backend service.
2. Shared contracts.
3. Strict auth boundaries.
4. Protocol-compatible streaming, checkpoint, resume, abort, billing, BYOK, and admin behavior.
5. Product-complete workspace Mothership capability.

Partial product breadth is allowed only when unsupported operations fail explicitly, safely, and observably through the protocol. Silent success, fake tool completion, hidden hosted fallback, and undocumented degraded behavior are not allowed.

## Approval Gates

| Gate | Required evidence |
| --- | --- |
| G0: Architecture approval | User approves the dedicated `apps/mothership` service, shared packages, TypeScript/Bun service boundary, strict secret plan, and protocol-complete baseline. |
| G1: Contract package approval | `packages/mothership-contracts` exists; Sim consumes generated or exported contracts; contract checks pass without `/Users/kyin/Projects/copilot`. |
| G2: Auth boundary approval | Distinct headers and env names exist; startup rejects equal secrets; wrong-key matrix tests pass. |
| G3: Stream compatibility approval | Golden stream fixtures pass for normal, tool, subagent, checkpoint/resume, abort, error, and missing-terminal cases. |
| G4: Runtime service approval | `apps/mothership` boots locally; Sim can target it; no hosted fallback exists in normal runtime path. |
| G5: Product hardening approval | Full workspace Mothership capabilities have tested tool/subagent coverage, runbooks, observability, and reliability drills. |

## Subagent Review Loop

After G0, every implementation workstream uses this loop:

1. Implementer: make the smallest coherent change that satisfies the assigned workstream acceptance criteria.
2. Spec reviewer: compare the diff against the architecture, secret-boundary doc, and this execution plan.
3. Code-quality reviewer: check repo style, package boundaries, tests, and maintainability.
4. Main agent: resolve findings, run verification, update the task list, then move to the next workstream.

No workstream closes on "it compiles" alone. It closes only when its acceptance evidence is present.

## Phase 2 Workstreams

### P2-0: Baseline And Dirty-Tree Control

Purpose: make sure implementation starts from known state without reverting unrelated work.

Tasks:

1. Capture `git status --short`.
2. Identify pre-existing dirty files unrelated to Mothership.
3. Keep new Mothership work in isolated files or clearly related diffs.
4. Confirm current contract checks and targeted tests before moving code.

Verification:

```bash
git status --short
bun run mship:check
bun run type-check
git diff --check
```

Acceptance:

1. Dirty tree is documented.
2. Mothership changes are distinguishable from unrelated edits.
3. No unrelated file is reverted.

### P2-1: Shared Contract Package

Purpose: move the source of truth out of `apps/sim` into a reusable monorepo package.

Tasks:

1. Create `packages/mothership-contracts`.
2. Keep owned JSON schema sources under `packages/mothership-contracts/contracts/`.
3. Generate TypeScript contract exports from the package source.
4. Export request/response schemas for:
   - `POST /api/copilot`
   - `POST /api/mothership`
   - `POST /api/tools/resume`
   - `POST /api/streams/explicit-abort`
   - `GET /api/get-available-models`
   - `/api/validate-key/*`
   - `/api/admin/byok`
   - `POST /api/chats/fork`
5. Add golden SSE fixtures under the package.
6. Update sync scripts so package contracts are default source.
7. Keep optional external contract paths as explicit override only.

Verification:

```bash
bun run mship-contracts:check
bun run mship-tools:check
bun run trace-spans-contract:check
bun run trace-attributes-contract:check
bun run trace-attribute-values-contract:check
bun run trace-events-contract:check
bun run metrics-contract:check
bun run mship:check
bun run mship-fixtures:check
bun run check:boundaries
bun run check:api-validation:strict
bun run type-check
git diff --check
```

Acceptance:

1. Contract checks pass without `/Users/kyin/Projects/copilot`.
2. `packages/mothership-contracts` imports no app code.
3. Sim and future Mothership code can import the same contract package.
4. Golden fixtures represent the current Sim parser expectations.
5. Callback and backend-key contracts match the current Sim wire shape until an explicit migration changes both sides.

### P2-2: Typed Client Package

Purpose: avoid ad-hoc `fetch` calls and centralize service-to-service auth headers, tracing, and response parsing.

Tasks:

1. Create `packages/mothership-client` or a package-local client module if package overhead is not justified yet.
2. Implement typed runtime client methods.
3. Implement typed admin client methods.
4. Implement callback client helpers for Mothership-to-Sim.
5. Add explicit legacy-wire adapters only for current Sim-to-Go runtime/admin `x-api-key` compatibility before route migration. Sim callback routes are strict-only and reject `x-api-key`.
6. Add trace propagation support.
7. Add key fingerprint logging helpers without raw secret logging.

Verification:

```bash
bun run mship-client:check
bun run type-check
bun run check:boundaries
```

Acceptance:

1. Runtime/admin/callback clients use distinct headers.
2. Legacy `x-api-key` is available only through an explicit adapter mode that validates strict contract headers first.
3. No generic service-to-service `x-api-key` remains in owned replacement paths after route migration.
4. Client methods are contract typed.

### P2-3: Strict Service Auth

Purpose: close the misconfiguration class documented in [Mothership secret boundary lessons](mothership-secret-boundaries.md).

Tasks:

1. Add env names:
   - `SIM_TO_MOTHERSHIP_API_KEY`
   - `MOTHERSHIP_TO_SIM_CALLBACK_KEY`
   - `MOTHERSHIP_ADMIN_API_KEY`
2. Add compatibility alias for `COPILOT_API_KEY` to runtime key only.
3. Do not alias `INTERNAL_API_SECRET` to the callback key.
4. Add startup secret topology validation.
5. Add route-family auth middleware.
6. Add wrong-key matrix tests.
7. Add structured auth outcome logging.

Verification:

```bash
bun run test --filter=mothership
bun run --cwd apps/sim test lib/mothership/service-auth.test.ts
bun run --cwd apps/sim test lib/mothership/service-auth.test.ts app/api/copilot/api-keys/validate/route.test.ts app/api/copilot/byok/validate/route.test.ts app/api/billing/update-cost/route.test.ts
bun run mship-client:check
bun run type-check
rg -n "x-api-key" apps/mothership packages/mothership-* apps/sim/lib/copilot apps/sim/app/api/copilot apps/sim/app/api/mothership
```

Acceptance:

1. Missing production secrets fail startup.
2. Equal service secrets fail startup.
3. Runtime key works only on runtime routes.
4. Callback key works only on Sim callback routes.
5. Admin key works only on admin routes.
6. Public workflow API keys do not authenticate service routes.

### P2-4: `apps/mothership` Service Skeleton

Purpose: create the owned process boundary.

Tasks:

1. Create `apps/mothership/package.json`.
2. Add Bun HTTP server entrypoint.
3. Add `/health` and `/ready`.
4. Add request id propagation.
5. Add logger.
6. Add service auth middleware.
7. Add graceful shutdown.
8. Add dev script wiring.

Verification:

```bash
bun run --cwd apps/mothership test
bun run type-check
bun run check:boundaries
```

Acceptance:

1. Service boots locally.
2. Health/readiness routes work.
3. Routes have request id and auth context.
4. Shutdown drains or rejects streams predictably.

### P2-5: Stream Writer And Golden Fixtures

Purpose: make backend stream behavior contract-first.

Tasks:

1. Implement an SSE writer that accepts only valid `MothershipStreamV1EventEnvelope`.
2. Enforce monotonic `seq`.
3. Enforce exactly one terminal event.
4. Add fixtures for:
   - normal text completion
   - tool call and tool result
   - subagent span/text/result
   - checkpoint pause and resume
   - compaction start/done
   - error terminal
   - abort terminal
   - invalid envelope
   - closed body without terminal event
5. Add Sim-side replay tests against fixtures.

Verification:

```bash
bun run test --filter=mothership-stream
bun run mship:check
bun run type-check
```

Acceptance:

1. Fixtures pass against current Sim parser.
2. Invalid events fail loudly.
3. Missing terminal event is covered by tests.
4. Subagent routing keeps parent tool/span identity.

### P2-6: Runtime Route Compatibility

Purpose: provide the route surface Sim already expects.

Tasks:

1. Implement `POST /api/mothership`.
2. Implement `POST /api/copilot`.
3. Implement `POST /api/tools/resume`.
4. Implement `POST /api/streams/explicit-abort`.
5. Implement `GET /api/get-available-models`.
6. Implement `/api/validate-key/*` or explicit migration adapter.
7. Implement `POST /api/chats/fork`.
8. Implement `/api/admin/byok`.

Verification:

```bash
bun run --cwd apps/mothership test
bun run test --filter=copilot
bun run type-check
```

Acceptance:

1. Sim route callers can target the owned service.
2. Every route validates request and response contracts.
3. Unsupported behavior returns typed protocol errors.
4. No route silently proxies to hosted Sim.ai.

### P2-7: Durable Runtime State

Purpose: support resume, abort, retries, and one-hour jobs.

Tasks:

1. Design migrations for:
   - mothership runs
   - stream events
   - checkpoints
   - tool calls
   - abort markers
   - usage snapshots
   - callback idempotency keys
2. Add repositories with tests.
3. Add restart-safe resume.
4. Add idempotent callback handling.

Verification:

```bash
bun run check:migrations
bun run --cwd packages/db db:generate
bun run test --filter=mothership
```

Acceptance:

1. Checkpoints survive service restart.
2. Resume is idempotent.
3. Abort is durable.
4. Billing retry cannot double-charge.

### P2-8: Sim Callback Client And Callback Routes

Purpose: make callback direction explicit and contract typed.

Tasks:

1. Update Sim callback routes to accept `X-Sim-Callback-Key`.
2. Preserve temporary compatibility only if explicitly needed and tested.
3. Implement Mothership callback client.
4. Add callback contract tests for:
   - API-key validation
   - BYOK validation
   - billing update cost
   - callback auth failures
   - trace propagation
5. Add monotonic billing tests.

Verification:

```bash
bun run test apps/sim/app/api/billing/update-cost/route.test.ts
bun run test apps/sim/app/api/copilot/api-keys/validate/route.test.ts
bun run test apps/sim/app/api/copilot/byok/validate/route.test.ts
bun run type-check
```

Acceptance:

1. Callback routes fail closed on missing/wrong callback key.
2. Runtime/admin/public keys fail callback routes.
3. Billing usage remains cumulative and idempotent.
4. BYOK entitlement remains Sim authoritative.

### P2-9: Tool And Subagent Kernel

Purpose: create real orchestration instead of protocol-only stubs.

Tasks:

1. Route tool calls by generated catalog target.
2. Execute Mothership-owned tools.
3. Emit checkpoints for Sim tools.
4. Emit checkpoints for client tools.
5. Run subagents and emit scoped span/text/tool/result events.
6. Add typed errors for unavailable tools.
7. Add provider adapter interface.
8. Add cost/usage tracking.

Verification:

```bash
bun run test --filter=mothership-tool
bun run test --filter=mothership-subagent
bun run mship-tools:check
bun run type-check
```

Acceptance:

1. Tool routing matches catalog.
2. Subagent UI fixtures render through current Sim path.
3. Unsupported tools fail through `error` or `tool.result` with a typed code.
4. Provider usage is captured for billing callback.

### P2-10: Sim Runtime Migration

Purpose: make Sim use the owned service with no hosted fallback.

Tasks:

1. Update Sim runtime clients to use new typed client.
2. Update env docs.
3. Update admin BYOK proxy to new admin header.
4. Update cleanup/fork/abort/model/key routes.
5. Add runtime hosted URL regression checks.
6. Add dev script for Sim + realtime + Mothership.

Verification:

```bash
rg -n "copilot\\.sim\\.ai|www\\.copilot\\.sim\\.ai" apps/sim apps/mothership packages scripts
rg -n "/Users/kyin/Projects/copilot|../copilot/copilot" apps/sim apps/mothership packages scripts
bun run type-check
bun run check:api-validation:strict
bun run check:boundaries
```

Acceptance:

1. Normal runtime cannot silently call hosted Sim.ai.
2. Missing owned backend URL fails closed.
3. Dev command starts owned Mothership path.
4. Documentation names the required envs and headers.

### P2-11: Deployment

Purpose: make the owned backend operable.

Tasks:

1. Add Dockerfile or Docker target.
2. Add compose or dev orchestration.
3. Add Helm templates if the existing deployment path needs them.
4. Add readiness probes.
5. Add secret templates with no committed secrets.
6. Add rollout and rollback notes.

Verification:

```bash
bun run lint:helm
bun run type-check
```

Acceptance:

1. Local deployment boots.
2. Production deployment shape is documented.
3. Secrets are mounted separately per trust domain.
4. Rollback does not re-enable hosted fallback.

## Phase 3 Workstreams

### P3-1: Workspace Context Engine

Tasks:

1. Build a snapshot schema for workflows, tables, files, knowledge bases, jobs, integrations, credentials metadata, and permissions.
2. Add selective retrieval so every prompt does not require full heavy context.
3. Add permission filtering.
4. Add stale-context detection.
5. Add context-size telemetry.

Acceptance:

1. Mothership can refer to workspace objects by name.
2. Sensitive credential values are never sent as raw context.
3. Context decisions are traceable.

### P3-2: Workflow Control Plane

Tasks:

1. Create workflow.
2. Edit workflow.
3. Run workflow.
4. Debug failed workflow.
5. Deploy API/chat/MCP.
6. Roll back deployment.
7. Organize folders.
8. Set variables.
9. Delete workflows with confirmation semantics.

Acceptance:

1. Each operation has a tool path, tests, and trace events.
2. Mutating operations are auditable.
3. Dangerous actions require explicit confirmation where appropriate.

### P3-3: Research And Web Retrieval

Tasks:

1. Search web.
2. Read public pages.
3. Crawl bounded sites.
4. Produce citations.
5. Save reports as workspace files.
6. Respect robots/auth limitations.

Acceptance:

1. Research reports cite sources.
2. Long research jobs survive resume/restart.
3. Web failures produce typed errors.

### P3-4: Files, Documents, Images, Charts, Presentations

Tasks:

1. Upload ingestion.
2. File read/write/edit.
3. Markdown/text/code/CSV/JSON generation.
4. Chart generation.
5. Image generation or variation pipeline.
6. PPTX generation.
7. Resource panel event updates.

Acceptance:

1. Generated files are saved in workspace storage.
2. Resource events open/update the right panel.
3. Large file operations stream progress.

### P3-5: Tables

Tasks:

1. Create tables from schema or CSV.
2. Query tables in natural language.
3. Add/update/delete rows.
4. Export CSV.
5. Join/combine tables.
6. Generate typed result previews.

Acceptance:

1. SQL/query generation is permission scoped.
2. Destructive table changes are auditable.
3. Large results are bounded and resumable.

### P3-6: Knowledge Bases

Tasks:

1. Create knowledge bases.
2. Add documents.
3. Fetch public URLs.
4. Query KBs.
5. Attach KBs to workflows.
6. Inspect connector/index status.

Acceptance:

1. Indexing status is visible.
2. Connector setup remains settings-driven unless a safe chat flow is built.
3. KB operations can be resumed after long indexing.

### P3-7: Automation And Direct Actions

Tasks:

1. Create scheduled Mothership jobs.
2. Run scheduled prompt with current workspace state.
3. Pause/resume/delete jobs.
4. Execute direct integration actions.
5. Manage environment variables.
6. Add MCP servers and custom tools.

Acceptance:

1. Jobs have logs and retry policy.
2. Direct external actions are auditable.
3. Irreversible actions require clear confirmation boundaries.

### P3-8: Admin, BYOK, Billing, And Governance

Tasks:

1. Admin BYOK management.
2. Per-workspace and per-user usage attribution.
3. Audit log events.
4. Data retention policy.
5. Enterprise permission checks.
6. Service secret rotation plan.

Acceptance:

1. Billing is monotonic and idempotent.
2. BYOK use is entitlement-gated and traceable.
3. Admin actions have audit logs.

### P3-9: Reliability And Operations

Tasks:

1. Queueing for one-message-at-a-time behavior.
2. One-hour task support.
3. Backpressure and stream throttling.
4. Graceful deploy draining.
5. Restart-safe resume.
6. Load targets and stress tests.
7. Dashboards and runbooks.
8. Failure drills for provider outage, callback outage, DB outage, and deploy restart.

Acceptance:

1. Operators can diagnose stuck streams.
2. Draining deploy does not lose checkpoints.
3. Load and soak tests meet documented targets.

## Global Verification Gate

Before calling the replacement complete:

```bash
bun run mship:check
bun run mship-contracts:check
bun run mship-tools:check
bun run trace-spans-contract:check
bun run trace-attributes-contract:check
bun run trace-attribute-values-contract:check
bun run trace-events-contract:check
bun run metrics-contract:check
bun run format:check
bun run lint:check
bun run type-check
bun run check:api-validation:strict
bun run check:react-query
bun run check:utils
bun run check:boundaries
bun run check:realtime-prune
bun run check:migrations
bun run test
git diff --check
rg -n "copilot\\.sim\\.ai|www\\.copilot\\.sim\\.ai" apps/sim apps/mothership packages scripts
rg -n "/Users/kyin/Projects/copilot|../copilot/copilot" apps/sim apps/mothership packages scripts
```

Completion requires current evidence for every acceptance item. Passing tests alone is not enough if a required route, tool family, secret boundary, migration, runbook, or product capability is missing.
