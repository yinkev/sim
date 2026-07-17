# Dev compile performance

This document preserves dated measurement snapshots. The June 18 residual-cost
claims are historical; the July 16-17 navigation-lag work below is the current
follow-up.

Measured 2026-06-18 on `feat/demo-workspace-local-dev`. Symptom: first page load took
>60s. Root cause: Turbopack cold-compile of the workspace route graph, compounded by
OTel boot tax and unoptimized barrel imports.

## Baseline (Iteration 0)

Cold `.next` cache, `bun dev` (sim only, port 6888), `DISABLE_AUTH=1`:

| Route                     | Cold total | Compile (`next.js`) | Warm   |
|---------------------------|------------|---------------------|--------|
| `/workspace` (entry)      | **85s**    | 79s                 | 152ms  |
| `/workspace/[id]/home`    | ~26s\*     | 24s                 | —      |
| `/workspace/[id]/w/[wid]` | ~9s\*\*    | 8.6s                | —      |

\* Measured after `/workspace` had already primed the shared-layout graph.
\*\* Incremental — layout chrome already compiled by `/home`.

Decision: unambiguously a **cold-compile** problem (warm = 152ms). The 30 GB
`.next/dev` cache (normal: a few hundred MB) was a symptom of repeated cold
recompiles, not the root cause.

## Fixes applied (Iteration 1 — config/env only, zero-risk)

1. **Disabled OTel in dev** — `NEXT_TELEMETRY_DISABLED=1` in `apps/sim/.env`.
   `instrumentation-node.ts:register()` previously booted the full OpenTelemetry
   SDK + exported traces to `telemetry.simstudio.ai` on every dev start. Supported
   guard already existed at `instrumentation-node.ts:137`. Server Ready: 1013ms → 215ms.

2. **Extended `experimental.optimizePackageImports`** in `apps/sim/next.config.ts`
   with `lucide-react` (used in 157 client files), `date-fns` (15), `es-toolkit` (10),
   `@tanstack/react-query` (35). Transform-only imported symbols instead of
   evaluating the full barrel on compile.

3. **Pruned `transpilePackages`** — removed `prettier`, `@react-email/components`,
   `@react-email/render`. Forced Turbopack to compile their source needlessly; they
   ship consumable dist.

## Result after Iteration 1

| Route                     | Cold total | Compile (`next.js`) | Delta      |
|---------------------------|------------|---------------------|------------|
| `/workspace` (entry)      | **15s**    | 13.3s               | **−70s**   |
| `/workspace/[id]/home`    | 26s        | 24s                 | unchanged  |
| Full cold journey (`/` → home) | ~41s  | —                   | **−~50s**  |

Warm unchanged at 49–152ms. Entry-route cold compile reduced **82%** (85s → 15s).

## Bottleneck #3 — attempted (Iteration 2), blocked by a circular dependency

The remaining 24s cold compile of `/workspace/[id]/home` is the `[workspaceId]/layout.tsx`
graph pulling the **full 280-module block registry** through the Zustand store layer:

```
[workspaceId]/layout.tsx
  → WorkspacePermissionsProvider
    → @/stores/workflows/registry/store
      → @/stores/workflows/utils.ts:9   import { getBlock } from '@/blocks'
      → @/stores/workflows/subblock/store.ts:5  import { getBlock } from '@/blocks'
        → @/blocks (barrel) → @/blocks/registry (280 block modules)
```

### Attempted fix: dependency-injection accessor

A `block-accessor.ts` module exposed a mutable resolver (`setBlockResolver` /
`resolveBlock`) using a **type-only** import of `getBlock` (erased by Turbopack at
compile time → no runtime edge). The two stores called `resolveBlock` instead of
`getBlock`; the editor/settings/academy routes — which already import `@/blocks` —
wired the real `getBlock` at module top-level.

### Result: regression — HTTP 500, reverted

The change exposed a **pre-existing latent circular dependency** in the
block/trigger registry. Trace:

```
hooks/use-trigger-config-aggregation.ts
  → triggers/index.ts (getTrigger reads TRIGGER_REGISTRY)
    → lib/workflows/triggers/trigger-utils.ts
      → lib/workflows/triggers/triggers.ts:1   import { getBlock } from '@/blocks'
        → blocks/index.ts → blocks/registry.ts
          → blocks/blocks/airtable.ts:240   ...getTrigger('airtable_webhook').subBlocks
            → triggers/index.ts:71   TRIGGER_REGISTRY still undefined → throws
```

Root cause: `blocks/blocks/airtable.ts:240` calls `getTrigger(...)` **at module-eval
time** (spreads `.subBlocks` into the block config). The registry only works today
because of a fragile module-eval order — whoever imports `@/blocks` first in the
current graph happens to do so after `TRIGGER_REGISTRY` is populated. The DI change
shifted that order and the latent cycle broke, producing `TypeError: Cannot read
properties of undefined (reading 'TRIGGER_REGISTRY')` on every workspace route.

**All Iteration 2 changes were reverted.** Working tree restored to Iteration 1
state; HTTP 200 confirmed on `/workspace` and `/home` after revert.

### What a real fix would require (out of scope for the perf loop)

Breaking this needs registry-architecture changes across all 280 blocks, not a
store-level decoupling:

1. Make `airtable.ts:240`'s `getTrigger()` call **lazy** — defer the
   `...getTrigger('airtable_webhook').subBlocks` spread into a function evaluated at
   runtime, not module-eval. Audit every other block that calls `getTrigger` /
   `getBlock` at module top-level (airtable is one; there may be more).
2. Remove `lib/workflows/triggers/triggers.ts:1`'s static `import { getBlock } from '@/blocks'`
   — break the `triggers ↔ blocks` cycle at its source.

Either is a deliberate refactor with its own design + test coverage, not a perf
quick-win. At this June 18 snapshot, the 24s `/home` cold compile remained as the
documented residual cost.

## Navigation-lag follow-up (2026-07-16 through 2026-07-17)

This investigation measured cold navigation into individual workspace screens,
then cut each target route's compile graph. These numbers are separate from the
June 18 entry-route measurements above.

### Before

| Screen | Observed cold navigation |
| --- | ---: |
| Knowledge | 13.0s |
| Integrations | 2.4s |
| Integration detail | 17.3s |
| Files | 5.1s before the API reached a DB-schema-related HTTP 500 |
| Tables | 30.3s |
| Studio | 19.5s |

A later true-cold Files diagnostic, with the relevant caches empty, took 53s.
The 5.1s and 53s observations are both retained because they measured different
cache states; neither should be presented as a universal first-load time.

### Root causes

1. Main workspace links were raw anchors with normal clicks intercepted for
   App Router `push`, but they had no intent prefetch. A user click still paid
   the full route discovery and cold compile cost.
2. Files, Knowledge, and Tables pages awaited server-side loopback prefetches,
   blocking page delivery while their own API routes compiled and ran.
3. Broad executable registries and barrels pulled block, tool, permission, and
   integration implementation graphs into read-only navigation targets.
4. Files list and detail shared the full `FileViewer` graph, so list navigation
   compiled detail-only preview and editor capabilities.
5. `GET /api/table` and table creation cohabited one route module. Turbopack
   eagerly compiled POST-side dynamic imports while serving GET, producing
   333 MiB and 824 server chunk/source-map files that included blocks and tools.

### Fixes

1. Main workspace navigation now uses App Router `push` plus hover/focus intent
   prefetch, while preserving normal modified-click anchor behavior.
2. Blocking SSR loopback prefetches were removed from the affected page routes;
   client queries load behind route-level skeletons instead.
3. Integration list/detail metadata now comes from pure generated catalogs, and
   permission-group-only consumers use a thin config hook rather than executable
   integration filtering.
4. Broad barrels were replaced with leaf imports on the measured paths. Files
   list and detail are split, and `FileViewer` loads only capabilities required
   by the selected file.
5. Table reads use read-only leaf modules. Creation moved to
   `POST /api/table/create`; legacy `POST /api/table` redirects there without
   importing creation dependencies into the GET graph.

### After

Earlier post-cut page-route observations:

| Screen | Observed cold navigation |
| --- | ---: |
| Files | 9.05s in one run; 15.45s with all relevant caches empty |
| Knowledge | 1.95s |
| Tables | 1.44s |
| Integrations | 2.27s |
| Skills | 1.23s |
| Integration detail | 1.41s |

The latest isolated empty-cache `GET /api/table` comparison improved from 23.3s
to 1.72s after the read/create route split. This API-route diagnostic is not the
same measurement as the Tables page row above.

First-ever cold-cache compile time still varies with which shared graphs were
primed. Report cold measurements with their cache conditions. After intent
prefetch has compiled a target, warm workspace navigation is expected to be
subsecond.

DB verification used the disposable `simstudio_phase2_task_preview` clone after
migrating it for this branch. The source `simstudio` DB was not migrated or
modified.

## Reproducing the measurement

```bash
pkill -f 'next dev --port 6888'
rm -rf apps/sim/.next          # true cold
cd apps/sim && bun run dev &
sleep 8
# Cold entry compile:
curl -s -o /dev/null -w 'total %{time_total}s\n' http://localhost:6888/workspace
# Check the compile breakdown:
grep 'GET /workspace' /tmp/sim-dev.log
```
