# Phase 1 Architecture Closeout

## Status

Phase 1 is complete and verified on 2026-07-16.

Phase 2 was not started.

This closeout records implementation history and evidence. The north star, domain model, invariants,
and ADRs remain the normative architecture sources.

## Original Problem

Main workspace routes and Workflow Studio shared a broad frontend and development-route dependency
graph. Workspace layouts eagerly mounted workflow collaboration, workflow permission state, settings
warming, provider-model discovery, and a sidebar coupled to workflow stores and executable registries.
Home loaded the full chat/resource runtime before the user needed it. Studio then compiled broad API
orchestration and persistence barrels when the hydrated page requested folders and workflow detail.

The resulting cost scaled with product scope instead of the active route. The first complete Main probe
failed the five-second cold budget at `8878.227 ms`. Studio remained interactive but exceeded its six-GiB
process-tree budget, including the authoritative v4 failure at `7.606 GiB` peak and `7.444 GiB` idle.

## Chosen Direction

Phase 1 retained the proven Workflow Studio product and deliberately preserved editing, collaboration,
presence, execution, cancellation, URLs, contracts, and durable data. It replaced the problematic
dependency architecture through an evolutionary strangler migration inside the modular monolith:

- Main web is a thin bounded shell.
- Home promotes into a route-owned full chat runtime on interaction.
- Workflow Studio owns its collaboration, editor, execution, navigation, and provider-discovery runtime.
- Generated or pure metadata crosses presentation boundaries; executable registries do not.
- Static and literal-dynamic import closures are enforced as architecture fitness functions.
- Server API routes use focused read and mutation modules instead of broad lifecycle barrels.

This implements ADR 0002 and ADR 0003 without a greenfield product rewrite or premature service split.

## Implementation Completed

### Main shell and Home

- Removed global `SocketProvider`, workflow operation state, `SettingsLoader`, and global
  `ProviderModelsLoader` placement.
- Added a bounded Main-web navigation surface; the full Workflow Studio sidebar mounts only under the
  workflow route.
- Kept shared workspace providers dependency-light and deferred query-backed branding and permissions
  until an owning route needs them.
- Replaced the eager Home runtime with a small landing composer that promotes to `/chat/new`.
- Preserved prompt, attachment, context, OAuth-return, template-import, stream-abort, draft, credits,
  suggestions, voice, chat-resume, and resource handoffs.
- Split heavyweight presentation metadata into generated or focused catalogs and kept executable block,
  tool, trigger, provider, and icon registries out of the Home entry graph.

### Workflow Studio

- Moved workflow scope, socket presence, connection-aware permissions, workflow navigation, editor state,
  execution visualization, and provider discovery behind Workflow Studio route or interaction boundaries.
- Split client tool metadata so initial consumers use generated summaries while full parameter data loads
  only for the owning workflow interaction.
- Replaced broad Studio imports with focused modules and lazy owning controls where compatibility allowed.
- Fixed the Toast provider hydration reconciliation loop and made native-presence updates idempotent so
  the accepted Studio browser journey runs without runtime errors.

### Studio server-route graph

- Extracted normalized workflow loading and migrations into a focused read module.
- Extracted folder creation and workflow update/delete into focused mutation modules.
- Prevented initial Studio routes from importing broad persistence, default-workflow, lifecycle, block,
  and trigger graphs.
- Added separate static and static-plus-literal-dynamic API closure budgets with forbidden-path checks.

## Root Causes And Evidence

### Performance before and after

All RSS figures are recursive listener-process-tree GiB. Studio cold TTFB is diagnostic; the accepted
Studio navigation budget is the warm/browser measurement.

| Surface and evidence | Status | Cold TTFB | Warm TTFB | Peak RSS | Idle peak RSS | Idle CPU |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Main initial — `var/center/evidence/architecture/performance/20260716-main-home.json` | Fail | `8878.227 ms` | `47.130 ms` | `3.384 GiB` | `3.133 GiB` | `0%` |
| Main authoritative — `var/center/evidence/architecture/performance/20260716-main-home-authoritative.json` | Pass | `4771.583 ms` | `33.465 ms` | `1.495 GiB` | `1.378 GiB` | `0%` |
| Studio initial authoritative — `var/center/evidence/architecture/performance/20260716-workflow-studio-authoritative.json` | Fail | `23260.640 ms` | `118.448 ms` | `19.772 GiB` | `18.439 GiB` | `0%` |
| Studio v2 — `var/center/evidence/architecture/performance/20260716-workflow-studio-authoritative-v2.json` | Fail | `12411.030 ms` | `99.637 ms` | `11.109 GiB` | `10.626 GiB` | `0%` |
| Studio v4 — `var/center/evidence/architecture/performance/20260716-workflow-studio-authoritative-v4.json` | Fail | `20385.435 ms` | `143.794 ms` | `7.606 GiB` | `7.444 GiB` | `0%` |
| Studio v5 — `var/center/evidence/architecture/performance/20260716-workflow-studio-authoritative-v5.json` | Pass | `18049.193 ms` | `139.459 ms` | `5.384 GiB` | `5.246 GiB` | `0%` |

Main browser evidence at
`var/center/evidence/architecture/performance/20260716-main-home-authoritative.browser.json`
records `3 ms` input readiness, `58.6 ms` warm navigation, full-composer readback, and probe-draft cleanup.
Studio v4 browser evidence passed interaction and a `493.7 ms` reload even though process memory failed,
proving that browser success alone was insufficient. Studio v5 browser evidence at
`var/center/evidence/architecture/performance/20260716-workflow-studio-authoritative-v5.browser.json`
records the same non-mutating editor interaction, zero browser errors, and a `527.7 ms` reload.

### Import closure and route compilation

The decisive Studio memory cause was late server-route compilation, not the visible editor interaction.
The v4 server log records first folder and workflow-detail requests dominated by Next compilation:

| Route | v4 first request | v5 first request | Enforced final import closure |
| --- | ---: | ---: | ---: |
| `/api/folders` | `8.9 s` | `3.3 s` | `32` static / `36` static + dynamic |
| `/api/workflows/[id]` | `13.2 s` | `2.1 s` | `54` static / `286` static + dynamic |

Raw request evidence is in
`var/center/evidence/architecture/performance/20260716-workflow-studio-authoritative-v4.server.log`
and `var/center/evidence/architecture/performance/20260716-workflow-studio-authoritative-v5.server.log`.
The current closure counts are enforced by `bun run check:studio-boundary`; unresolved imports fail the
check rather than being hidden by an allowlist. Pre-cut diagnostic traces identified broad lifecycle,
defaults, persistence, block, and trigger reachability. Their raw numeric closure snapshot was not
retained, so this closeout does not present those intermediate counts as canonical evidence.

The Main boundary now reports focused Home and chat entry graphs while proving the block, tool, trigger,
integration, and broad icon registries unreachable. This is enforced by `bun run check:home-boundary`,
not inferred from component placement.

## What Worked

- Route ownership removed idle workflow work from Main and kept Main cost independent of Studio growth.
- The landing-to-`/chat/new` handoff preserved the full composer without loading it on empty Home.
- Generated/pure metadata and direct import seams made dependency ownership measurable and enforceable.
- Client catalog splitting, provider deferral, and focused Studio imports reduced v2 memory substantially.
- Focused folder and workflow API modules removed the remaining large compiler fan-out and moved v5 under
  the Studio RSS budget.
- The interactive probe prevented HTTP-only or stale evidence from being reported as acceptance proof.

## What Failed Or Was Insufficient

- Keeping the broad graph unchanged could not meet cold compile or memory budgets.
- Dynamic imports alone were insufficient: hydrated Studio interactions still requested routes whose
  literal-dynamic closures reached broad orchestration and executable registries.
- Provider-model deferral, client catalog splitting, direct imports, and parameter deferral helped but
  did not individually close the full-browser RSS gate. The v4 run remained `1.444 GiB` above the idle
  limit after those frontend cuts.
- A four-GiB V8 heap cap did not bound recursive process-tree RSS; the diagnostic at
  `var/center/evidence/architecture/performance/20260716-workflow-studio-memory-limit-4g.json`
  remained above eight GiB.
- The webpack diagnostic log at
  `var/center/evidence/architecture/performance/20260716-workflow-studio-webpack-http.server.log`
  records a `node:async_hooks` client import failure and a four-GiB heap exhaustion. Changing bundlers
  was not a substitute for fixing dependency ownership.
- HTTP-only partial probes were useful diagnostics but were not treated as browser/runtime acceptance.

The rejected architecture alternatives and durable reasoning are recorded in ADR 0002: leaving the
broad graph unchanged, relying on dynamic imports alone, a greenfield Studio rewrite, a full
microfrontend platform, and premature backend or service extraction.

## Compatibility Deliberately Preserved

- Existing workspace, Home, chat, resource, workflow, and OAuth-return URLs.
- Existing HTTP contracts, database schema, migrations, chat transport, transcripts, and durable data.
- Home prompt, attachments, contexts, skills, voice, credits, suggestions, templates, resume, resources,
  and cancellation handoffs.
- Workflow editing, collaboration, presence, connection-aware permissions, execution, cancellation,
  deployment controls, and provider-model selection.
- Existing Workflow Studio product behavior; the migration changed dependency ownership underneath it.

## Verification Checkpoint

The final Phase 1 verification set is intentionally bounded:

- Focused Vitest suites for workspace/Home boundaries, chat handoff compatibility, Toast runtime,
  Studio route and persistence behavior, and API import boundaries passed: `25` files and `227` tests.
- Targeted Biome checks passed for `330` changed Phase 1 source and guard files; generator-owned JSON
  artifacts remained under their freshness checks instead of formatter ownership.
- `bun run type-check` from `apps/sim`.
- `bun run check:home-boundary`.
- `bun run check:studio-boundary`.
- `bun run check:center-boundary`.
- `bun run check:boundaries`.
- `bun run check:api-validation:strict`.
- `bun run check:react-query`.
- `git diff --check`.
- Authoritative Main and Studio browser/runtime evidence linked above.

Every command above exited successfully on the Phase 1 checkpoint.

The authoritative probes were not rerun after documentation and guard-only edits because no relevant
production entry or runtime graph changed. Final boundary checks confirm the measured entry closures
remain intact.

## Remaining Limitations, Risks, And Technical Debt

- Clean Studio compile remains expensive (`18.049 s` diagnostic cold TTFB in v5), although warm opening,
  interaction, idle CPU, and RSS meet the accepted Phase 1 budgets.
- Main cold TTFB has `228.417 ms` headroom under its five-second budget.
- Studio peak RSS has about `0.616 GiB` headroom. The API closure ratchets are intentionally tight; new
  broad imports must be split instead of raising budgets without evidence.
- Legacy persisted tool payloads are wider than the historical shared `SubBlockState.value` type. The
  focused loader preserves runtime compatibility with one explicit boundary cast; the domain type debt
  remains.
## Phase 2 Prerequisites

Phase 2 remains pending. Before any Task persistence implementation:

1. Author and accept a Phase 2 slice with user outcome, compatibility, persistence, migration, rollback,
   authorization, and performance gates.
2. Preserve current `chatId` URLs, transcripts, streams, resources, and permissions during Task identity
   mapping; do not broaden access.
3. Resolve the decisions tracked by `ARCH-004`, including Task status, visibility/ownership, deletion
   semantics, and rolling-deploy repair policy, before state migration beyond identity mapping.
4. Keep Task, Artifact/Version, and Execution-domain work out of Main and Studio initial graphs.
5. Start only from this clean, verified Phase 1 checkpoint or a deliberately reconciled descendant.

Phase 2 was not started.
