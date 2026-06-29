# Pro Handoff: Sim Daily Cockpit

## Intent

Kevin wants Sim to become his daily command cockpit, not just a workflow builder. He is explicitly open to redesign and novelty if it is the best shape for his daily use.

The real product goal is a single operating surface where he can see, think, prioritize, delegate, review, and schedule work across projects, GitHub, Plane-style tasks, AI workers, knowledge, files, workflows, logs, and Mothership.

## Repo snapshot

Root: `/Users/kyin/Projects/sim`

Git state when opened:

```text
main...upstream/main [ahead 14, behind 97]
```

Do not update from upstream before inspecting the 14 local commits.

## Observed structure

```text
.
├── apps/
│   ├── sim/          main Next app
│   ├── mothership/   orchestration/control-plane service
│   ├── realtime/     realtime service
│   └── docs/         docs app
├── packages/         db, workflow, realtime, mothership, authz, testing packages
├── scripts/          checks, contract sync, migration safety
├── .agents/skills/   agent skills for adding/validating connectors/tools/triggers/models
├── .claude/rules/    project rules
└── .github/workflows CI and publishing
```

Important app areas:

```text
apps/sim/app/workspace/[workspaceId]/
├── home/                  Mothership chat/home surface
├── mothership/            Mothership control panel
├── understand/            likely anchor for system/repo comprehension
├── integrations/          integration catalog and connected accounts
├── settings/components/mcp/ existing MCP settings surface
├── scheduled-tasks/       time-based control
├── knowledge/             knowledge bases and connectors
├── files/                 files/documents
├── tables/                structured data
├── logs/                  execution logs
├── skills/                workspace skills
└── w/[workflowId]/         workflow editor
```

Package facts:

- Root uses `bun@1.3.13` and Turbo.
- Main app uses Next `16.2.6`, React `19.2.4`.
- `apps/sim` already has `reactflow`, `zustand`, React Query, MCP SDK, GitHub integration/triggers, Mothership code, knowledge/files/tables/schedules/logs.
- `apps/sim` has `dev:capped`: `NODE_OPTIONS='--max-old-space-size=4096' next dev --port 6888`.
- Build/type-check currently use larger Node heap.

## Product thesis

Build a Daily Cockpit: a typed operational graph, not a generic dashboard.

```text
open loop / goal
  -> context: GitHub, Plane, files, knowledge, docs, messages
  -> reasoning: Mothership and Understand
  -> planning: Plane-like issue graph
  -> execution: workflows, MCP tools, subagents, scheduled tasks
  -> evidence: logs, diffs, tests, artifacts
  -> review: pass/fail gates
  -> next action: schedule/delegate/kill
```

## First major task: reduce local CPU/RAM

Prompt Pro:

```text
You are working in /Users/kyin/Projects/sim. Kevin wants this repo to become his daily command cockpit, but first local dev must stop burning CPU/RAM. Inspect the repo and implement a targeted resource-reduction plan. Do not give generic Next.js advice.

Goals:
1. Reduce idle CPU during local dev.
2. Reduce dev RAM/heap pressure.
3. Preserve normal development workflow.
4. Prefer measurable before/after commands.
5. Do not break monorepo scripts or CI.

Known facts:
- Root `dev` runs Turbo.
- `dev:full` starts app + realtime.
- `dev:full:capped` exists.
- app `dev:capped` caps Node heap at 4096 MB.
- app is large: Next 16, React 19, React Flow, Monaco, mermaid, document parsing, execution sandbox, AWS clients, MCP, telemetry, workflow execution, connectors, background jobs.

Investigate:
- Which Turbo dev tasks/watchers start unnecessarily.
- Whether app-only dev should be the default for Kevin.
- Whether realtime, mothership, scheduled/background jobs can be opt-in.
- Large imports in app shell that should be lazy or route-scoped.
- Dev telemetry/analytics/background loops that should be disabled locally.
- Watcher breadth: generated files, caches, docs, logs, bundle artifacts.

Implement:
- `dev:lite`: app-only, low memory, no realtime/mothership/background services.
- `dev:cockpit`: app + only services needed for cockpit.
- Preserve `dev:full:capped`.
- Add docs/comments explaining which script Kevin should use daily.

Validation:
- cheapest targeted typecheck/lint for touched files
- app boot smoke if available
- no full monorepo test unless required

Final report:
1. What changed
2. Why CPU/RAM improves
3. How Kevin runs it
4. Remaining risks
```

## Second major task: build Daily Cockpit first slice

Prompt Pro:

```text
Read `.ai-bridge/pro-daily-cockpit-handoff.md` first.

Objective: implement the first shippable slice of Kevin's Daily Cockpit inside Sim.

Default route:
`apps/sim/app/workspace/[workspaceId]/cockpit/`

Build the spine, not a toy page:
- typed graph model
- React Flow visual surface
- editable inspector
- raw thought capture
- compiled execution/handoff plan preview
- GitHub/Plane-ready node types
- Mothership/Understand framing

Node kinds:
- goal
- open_loop
- question
- assumption
- decision
- task
- github_issue
- github_pr
- plane_issue
- repo
- workflow
- agent_worker
- mcp_tool
- knowledge_source
- scheduled_task
- risk
- test_gate
- review_gate
- artifact

Edge kinds:
- decomposes_into
- depends_on
- blocked_by
- implemented_by
- validated_by
- reviews
- syncs_from
- syncs_to
- uses_context
- runs_tool
- scheduled_by

Node fields:
- id
- kind
- title
- rawThought
- summary
- status
- priority
- confidence
- source
- externalRef
- evidenceRefs
- acceptanceCriteria
- nextAction
- owner
- dueAt
- updatedAt

First slice requirements:
1. Route loads.
2. User can add/edit/connect nodes.
3. User can capture raw thought and convert it into risk/question/task/review gate.
4. Compiled plan preview updates from graph.
5. User can copy/export compiled plan text.
6. No external API required for first slice.
7. Use local state first if persistence is too large, but design types to become DB-backed later.
8. Keep styling consistent with Sim.
9. Add navigation only if it fits existing workspace chrome cleanly; otherwise leave direct route and document nav follow-up.

Before patching inspect:
- workspace chrome/navigation
- mothership route/components
- understand route/components
- workflow editor React Flow usage
- shared UI components
- stores and local persistence patterns

Acceptance:
- route works
- graph edits work
- thought capture works
- compiled plan works
- targeted typecheck/lint passes for touched files
```

## GitHub integration intent

Interpret Kevin's “GitHub multica” as GitHub multi-call / multi-action support.

Use existing GitHub integration and triggers first. Build cockpit sync after first slice:

- import repos/issues/PRs/checks into cockpit graph
- link PRs/issues to tasks and review gates
- create GitHub issues from cockpit task nodes
- detect stale/blocked/failing work
- summarize what changed since last sync
- support batch sync across multiple repos

## Plane.so intent

Plane should be the task/project substrate, not a random connector.

Build as connector + cockpit sync:

- projects
- cycles
- modules
- issues
- labels/statuses
- comments/activity

Map Plane issues to cockpit task nodes. Push cockpit status/priority/next action back to Plane only after explicit user action or a safe sync policy.

## Understand intent

Upgrade Understand into a system comprehension layer.

Inputs:
- repo tree
- GitHub issues/PRs
- Plane issues
- files/docs/knowledge
- workflows
- logs
- Mothership transcripts

Outputs:
- system map
- stale/risky areas
- missing tests
- suggested cockpit nodes
- changed-since-last-review summaries

Understand should feed cockpit graph mutations, not just produce prose.

## Mothership intent

Mothership becomes the daily governor:

Morning output:
- what matters today
- what changed overnight
- what is blocked
- what agents can handle
- what requires Kevin's decision
- what needs scheduling
- what evidence proves completion

Mothership should propose graph changes, not only chat.

## Product direction

Kevin wants:
- high-density visual control
- direct manipulation
- typed graph/state-machine thinking
- evidence-first review
- low fluff
- ability to redesign if better

Do not build:
- generic dashboard cards
- a Plane clone
- a decorative React Flow map
- a chatbot-only Mothership
- duplicate manual task lists

Final product definition:

Kevin opens Sim each morning and can answer:

1. What matters today?
2. What changed overnight?
3. What is blocked?
4. What can agents do?
5. What requires my decision?
6. What evidence proves work is done?
7. What should be scheduled, delegated, or killed?

## Execution order for Pro

Do not start with the full cockpit. Execute in this order:

1. **Protect current branch state**
   - Inspect git history and dirty state.
   - Do not pull/rebase until Kevin's 14 local commits are understood.

2. **CPU/RAM first**
   - Add/repair low-resource dev scripts.
   - Identify watcher/process fanout.
   - Lazy-load obvious heavy modules if they are imported into broad shells.
   - Leave a short `docs/dev-profiles.md` or equivalent explaining daily commands.

3. **Cockpit first slice**
   - Add route and typed local graph.
   - Add React Flow surface.
   - Add inspector and thought capture.
   - Add compiled plan preview/copy.
   - No external GitHub/Plane API requirement in this slice.

4. **Integrations second slice**
   - GitHub sync/import.
   - Plane connector/sync.
   - Mothership graph mutation proposals.
   - Understand graph synthesis.

5. **Worker loop third slice**
   - Compile graph to agent/worker handoff.
   - Attach evidence/logs/test results back to graph nodes.
   - Add review gates and pass/fail loop.

## Short prompt Kevin can paste into Pro

```text
Read /Users/kyin/Projects/sim/.ai-bridge/pro-daily-cockpit-handoff.md.

My intent: make Sim my daily command cockpit, not a generic workflow editor. I am open to redesign and novelty if it is the best shape for me.

First, reduce local CPU/RAM usage with targeted repo-specific changes. Then implement the first shippable Daily Cockpit slice at /workspace/[workspaceId]/cockpit: typed React Flow graph, editable inspector, raw thought capture, compiled execution plan preview, GitHub/Plane-ready node model. Do not build a decorative graph or generic dashboard. Build the spine of the operating system.

Before coding, inspect current git state and do not overwrite my local commits.
```

## Non-negotiable design invariant

The cockpit graph must be operational, not decorative.

```text
thinking -> typed graph -> execution plan -> workers -> evidence -> review -> next action
```

If a feature does not improve that loop, defer it.
