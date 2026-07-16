# Phase 1A: Main-Web Shell Diet

## Status

Current status: Complete
Owner: Sim maintainers
Started: 2026-07-15
Completed: 2026-07-16

## User Outcome And Reference Workflow

Kevin can open `/workspace/[workspaceId]/home`, start or resume work, and leave the app idle without
paying Workflow Studio collaboration, editor-store, executable-registry, or provider-discovery cost.
Opening `/workspace/[workspaceId]/w/[workflowId]` still provides existing workflow editing, presence,
execution, and stop behavior.

Reference workflow:

1. Open a workspace home route.
2. Focus the task input and use the existing full composer capabilities.
3. Start a task, resume an existing chat, and open a referenced resource.
4. Navigate to an existing workflow and confirm editing, collaboration, execution, and cancellation.
5. Return to home and confirm inactive workflow runtime performs no sustained work.

## Completed Behavior

- Persistent shell owns identity, branding/theme, lightweight authorization, navigation frame, notifications, and route outlet only.
- Workflow collaboration, workflow scope, provider-model discovery, editor state, and execution visualization load only for an owning route or interaction.
- Presentation metadata comes from generated or pure modules that do not import executable blocks, tools, providers, triggers, or workflow runtime.
- Existing user capabilities remain reachable; deferral must not silently delete attachments, contexts, voice, credits, suggestions, workflow editing, presence, or stop behavior.
- Home promotes to `/chat/new` before loading the complete composer and preserves prompt, attachment, context, OAuth-return, template-import, and abort handoffs.
- Main-web navigation no longer imports the Workflow Studio sidebar. Workflow navigation mounts only under the workflow route.

## Scope

In scope:

- Workspace ancestor layouts and provider placement.
- Home landing/runtime boundary and capability-preserving handoff.
- Workflow route runtime boundary.
- Sidebar and search metadata seams required to remove Studio reachability from main-web entry paths.
- Static import-closure and generated-metadata freshness checks.
- Repeatable cold/warm compile, input readiness, RSS, and idle-CPU probe.

Out of scope:

- Task, Artifact, or Execution persistence changes.
- New Center product features or production-sync work.
- Workflow editor redesign or registry-wide rewrite.
- Service extraction, new origins, or a microfrontend framework.
- Center ontology migration decisions.

## Domain, API, Persistence, And Compatibility Impact

- Domain systems of record: unchanged.
- HTTP contracts: unchanged.
- Database and migrations: unchanged.
- Existing workspace, home, chat, and workflow URLs: preserved.
- Existing chat transport, attachments, context selection, OAuth return, workflow import, editing, presence, execution, and cancellation: preserved.
- Existing UI and analytics names containing “task” remain compatibility language over chat-backed work;
  Phase 1 does not add canonical Task identity or persistence.

## Applicable Decisions And Invariants

- ADR 0002: Workflow Studio is a separate compile domain.
- ADR 0003: keep the workspace shell minimal.
- `INV-DEP-001` through `INV-DEP-008`.
- `INV-STATE-001`, `INV-STATE-002`.
- `INV-PERF-001` through `INV-PERF-006`.

## Performance Budget

On the reference development environment:

| Metric | Budget |
| --- | ---: |
| Main daily-control route clean compile | under 5 seconds |
| Input usable after route response | under 500 ms |
| Warm navigation | under 500 ms |
| Idle CPU after settling | effectively 0% |
| Main-web development RSS | under 4 GB |
| Warm Workflow Studio open | under 3 seconds |
| Workflow Studio development RSS | under 6 GB |

Structural scaling budget: adding an integration or workflow block has zero material effect on the home
or Command Center entry graph.

## Implementation Checkpoints

1. [Complete] Route-scope collaboration and eager loaders.
   - Remove global `SocketProvider`, settings warming, and provider-model discovery.
   - Preserve workflow presence and connection-aware permissions inside the workflow runtime boundary.
   - Load provider models only when the workflow or chat runtime needs them.
2. [Complete] Remove remaining shell-to-Studio static reachability.
   - Replace executable integration barrels with presentation-only metadata.
   - Separate workflow actions/list UI from the bounded main-web navigation shell.
3. [Complete] Isolate chat resource and composer Studio dependencies behind interaction boundaries.
4. [Complete] Add repeatable import-closure, metadata freshness, cold/warm, RSS, CPU, and input-readiness evidence
   using the [development performance probe](../performance-probe.md).

## Observable Acceptance Criteria

- Workspace root and shared layouts do not statically import or unconditionally mount workflow collaboration, workflow stores, executable registries, settings warming, or provider-model discovery.
- Home and Command Center static import closure excludes Studio routes, block/tool/trigger/provider registries, editor stores, execution visualization, Monaco, and Mermaid.
- Workflow runtime still supplies socket presence, connection-aware edit permissions, editor state, execution, and cancellation.
- Empty home remains immediately usable and promotes to the full composer on user interaction; attachment-only and context-assisted starts remain possible.
- Existing chat resume and OAuth return paths load the required runtime without losing handoff state.
- Generated presentation metadata is reproducible and freshness-checked without importing executable registries at client runtime.
- Targeted boundary and compatibility tests pass.
- `bun run check:center-boundary`, `bun run check:boundaries`, `bun run check:api-validation:strict`, `bun run type-check`, applicable lint, and `git diff --check` pass.
- Current-tree performance evidence passes every budget above before the slice is marked complete.

## Legacy Removal Criteria

Remove, rather than retain as fallback:

- Global workspace `SocketProvider` placement.
- `SettingsLoader` eager warming.
- Global `ProviderModelsLoader` placement.
- Main-web imports from executable integration/block registries used only for presentation.
- Any heavy home fallback that remains eagerly reachable after the deferred runtime is accepted.

Current Sidebar workflow behavior may remain behind a route boundary until its bounded navigation
replacement reaches parity; it may not remain in the main-web initial graph.

## Acceptance Evidence

- Main: `var/center/evidence/architecture/performance/20260716-main-home-authoritative.json` and its attached browser evidence pass. Cold TTFB is `4771.583 ms`, warm TTFB is `33.465 ms`, peak listener-tree RSS is `1.495 GiB`, idle peak RSS is `1.378 GiB`, and idle CPU is `0%`.
- Workflow Studio: `var/center/evidence/architecture/performance/20260716-workflow-studio-authoritative-v5.json` and its attached browser evidence pass. Warm TTFB is `139.459 ms`, browser reload is `527.7 ms`, peak listener-tree RSS is `5.384 GiB`, idle peak RSS is `5.246 GiB`, and idle CPU is `0%`.
- `bun run check:home-boundary`, `bun run check:studio-boundary`, `bun run check:center-boundary`, `bun run check:boundaries`, `bun run check:api-validation:strict`, `bun run check:react-query`, `bun run type-check`, targeted Biome checks, and `git diff --check` pass.
- Workspace route, Home initial-bundle, new-chat handoff, Studio route, persistence, and API import-boundary tests pass.
- `SettingsLoader` is removed. Workflow realtime, permissions, navigation, scope, provider discovery, editing, execution, and cancellation remain owned by Workflow Studio routes.

## Rollback And Containment

Provider and import-boundary changes are independently reversible. No data rollback is required. If a
deferred runtime loses a capability, restore that capability inside the owning runtime boundary rather
than restoring the global eager import. If workflow collaboration or edit safety regresses, revert the
workflow runtime checkpoint before proceeding to the Sidebar split.
