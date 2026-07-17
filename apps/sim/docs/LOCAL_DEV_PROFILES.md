# Local Dev Profiles

## Purpose

Use a low-resource Sim command by default while Center is being developed.

Phase 0 rule: do not start Center UI implementation until local CPU/RAM behavior is handled or explicitly waived.

Canonical Center operations documentation:

```text
apps/sim/docs/center/operations-and-dogfood.md
```

## Commands

| Command | Processes | Use when | Notes |
| --- | --- | --- | --- |
| `bun run dev:lite` | `apps/sim` only | daily app work, Center planning, docs, API work not requiring realtime | capped app heap, no realtime server, no mothership app |
| `bun run dev:center` | `apps/sim` only | Center route/spine work after Phase 0 | same capped app process plus `CENTER_DEV=1` marker |
| `bun run dev:full:capped` | `apps/sim` + `apps/realtime` | workflow/collaboration work needing sockets | capped app heap, realtime still runs |
| `bun run dev:full` | `apps/sim` + `apps/realtime` | full existing behavior check | highest local footprint |
| `bun run dev:mothership` | `apps/mothership` only | mothership service work | separate app process |

## Existing performance evidence

`apps/sim/docs/DEV_COMPILE_PERF.md` records dated measurement snapshots:

- The June 18 snapshot improved `/workspace` cold compile from 85s to 15s after dev OTel/package-import/transpile changes; it recorded a then-current 24s `/workspace/[workspaceId]/home` residual.
- The July 16-17 follow-up addressed page-specific navigation lag with intent prefetch, removal of blocking SSR loopback prefetch, and narrower route import graphs.
- Latest isolated empty-cache `GET /api/table` improved from 23.3s to 1.72s after table read/create route separation.
- First-ever cold-cache compile still varies with which shared graphs were primed. Warm navigation is expected to be subsecond after intent prefetch compiles the target.

Historical June hot path:

```text
workspace shell/layout
  -> workflow stores
  -> getBlock
  -> blocks barrel
  -> registry
  -> hundreds of block modules
```

Center route boundary:

```text
/workspace/[workspaceId]/center
  -> proxy rewrite to /center/[workspaceId]
  -> apps/sim/app/center/**
  -> apps/sim/lib/center/**
```

Validation:

```text
bun run check:center-boundary
```

Current clean smoke:

- `GET /workspace/local-test/center` returned `HTTP/1.1 200 OK`.
- Next compiled `/center/[workspaceId]` in `6.5s` total / `5.9s` Next compile.
- Browser smoke created a profile, loop, and event using system Chrome at `/workspace/local-test/center`.
- Browser smoke created a profile and imported MS2Scheduler records through the explicit `Import MS2` action.
- Browser smoke created a profile, saved three manual captures, and verified the prediction section moved from insufficient data to baseline.
- Browser smoke created a profile, imported the source-controlled review-packet fixtures, and rendered an `approved-for-execution` worker gate.
- `GET /api/center/ms2scheduler/import` returned `v001`, 6 evidence receipts, 1 raw event, 1 loop, 5 recommendations, and 5 action proposals from `/Users/kyin/Projects/MS2Scheduler/app/data`.
- `GET /api/center/review-packets/import` returned `center-capability-review`, `converged`, `approved-with-required-changes`, `approved-for-execution`, round `1/5`.
- Center browser smoke did not request or compile `/api/auth/get-session`; Center auth stayed in `proxy.ts`.
- Center dev memory snapshots held at `rssMB: 2433` after one and two minutes.
- Center dev with the MS2 import route loaded held at `rssMB: 1207` after one minute during smoke.
- Center dev with baseline prediction UI held at `rssMB: 1127` after one minute during smoke.
- Center dev with review packet import held at `rssMB: 1192` after one minute during smoke.
- Center dev fresh runtime sample on 2026-07-01 loaded `/center/import-failure-ui` twice with raw Chrome CDP, peaked at `1478 MB` total listener-tree RSS during load, then held at `1340 MB` RSS and `0%` CPU through the 15s, 30s, 45s, and 60s steady-state samples.
- Parsed Center server route bundle had no tools, blocks, stores, triggers, workflow, auth, billing, or webhook chunks.
- Parsed Center page client entry had no tools, blocks, stores, workflows, auth, Monaco, or mermaid chunks.
- Targeted Center page/API artifacts after MS2 import had no workflow, block, store, auth, provider, Monaco, or mermaid imports.

Additional hot path found during Phase 0 inspection and reduced in this phase:

```text
apps/sim/app/workspace/layout.tsx
  -> apps/sim/app/workspace/providers/socket-provider.tsx
  -> @/stores/workflows/registry/store
  -> @/stores/workflows/utils
  -> @/blocks
  -> @/blocks/registry
```

Patch applied:

- `SocketProvider` now lazy-loads `@/stores/workflows/registry/store` for hydration phase subscription.
- `WorkspaceScopeSync` now lazy-loads `@/stores/workflows/registry/store` inside its effect.
- Existing workflow behavior is preserved by still syncing workspace scope and hydration state after mount.
- `apps/sim/next.config.ts` sets `turbopack.root` to the repo root so Next does not infer `/Users/kyin` because of home-level lockfiles.
- Workspace-level settings/permission queries import narrow contract files instead of the full API contract barrel.
- `proxy.ts` rewrites `/workspace/[workspaceId]/center` to the standalone `/center/[workspaceId]` route before the workspace layout can load.
- Center auth is enforced in `proxy.ts` with the Better Auth session cookie so the Center server route does not import the full auth/billing/webhook/workflow graph.
- Root PostHog/session telemetry hooks skip the standalone Center path.

## Center import boundary

Default Center route must not top-level import:

- workflow editor stores
- block registry
- connector registry
- Monaco
- mermaid
- document parsers
- execution sandbox
- provider SDK registries

Allowed Center defaults:

- local Center contracts/types
- small UI primitives
- profile/evidence/loop/query hooks that do not pull workflow editor graph
- lazy imports behind explicit user action
- local-development producer import routes that remain contract-bound and do not execute discovered producer code

## Phase 0 decision and current guidance

Script/doc changes are safe now because they do not change product behavior.

Do not attempt the registry decoupling as a quick fix. `DEV_COMPILE_PERF.md` documents that the June dependency-injection attempt exposed a latent blocks/triggers circular dependency and had to be reverted. The July navigation work avoided that cycle by removing executable registries from read-only route graphs instead of changing registry initialization order.

Preserve these import boundaries:

1. Keep workflow editor route imports under `/workspace/[workspaceId]/w/**`.
2. Make Center route use Center-owned providers instead of workspace-global workflow providers.
3. Keep navigation-target metadata in pure catalogs; do not reintroduce block/tool registry barrels.
4. Keep Files list and detail graphs separate, with detail capabilities loaded only when needed.
5. Keep `GET /api/table` on read-only leaf modules and creation under `POST /api/table/create`.
6. Break the blocks/triggers module-eval cycle before changing `getBlock` initialization order in stores.
