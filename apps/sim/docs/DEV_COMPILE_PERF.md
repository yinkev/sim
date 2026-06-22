# Dev compile performance

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
quick-win. The 24s `/home` cold compile remains as documented residual cost.

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
