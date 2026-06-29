---
id: cpu-ram-stabilization-import-boundary-plan
type: implementation-boundary-plan
project: cpu-ram-stabilization
status: active
updated: 2026-06-28
links:
  - cpu-ram-stabilization-phase-0-plan
  - center-governing-spec-v1
---

# Import Boundary Plan

## Current evidence

`apps/sim/docs/DEV_COMPILE_PERF.md` records the original hot path:

```text
[workspaceId]/layout.tsx
  -> WorkspacePermissionsProvider
  -> @/stores/workflows/registry/store
  -> @/stores/workflows/utils
  -> @/blocks
  -> @/blocks/registry
```

Phase 0 inspection found another workspace-wide path:

```text
apps/sim/app/workspace/layout.tsx
  -> SocketProvider
  -> @/stores/workflows/registry/store
  -> @/stores/workflows/utils
  -> @/blocks
  -> @/blocks/registry
```

`apps/sim/blocks/registry.ts` imports hundreds of block modules at top level. This is the module graph Center must avoid.

## Boundary for Center route

Route:

```text
apps/sim/app/workspace/[workspaceId]/center
```

Forbidden top-level imports in this route and its default providers:

- `@/stores/workflows`
- `@/stores/workflows/registry/store`
- `@/stores/workflows/workflow/store`
- `@/stores/workflows/subblock/store`
- `@/blocks`
- `@/blocks/registry`
- connector registry
- `reactflow`
- Monaco / `@monaco-editor/react`
- `mermaid`
- document parsers
- execution sandbox
- provider SDK registries

## Safe default strategy

1. Keep Center contracts and storage under Center-owned modules.
2. Add Center route under the workspace shell only after checking shell providers.
3. Do not import workflow state just to show loops/evidence/actions.
4. Treat workflow as a producer, not a parent dependency.
5. Lazy-load workflow editor or block details only when the user opens workflow-specific actions.

## Required code-level work before Center UI

1. Decide whether Center can bypass `SocketProvider` or whether `SocketProvider` can lazy-load workflow registry sync.
2. Decide whether `WorkspacePermissionsProvider` needs workflow registry access for every route.
3. Break blocks/triggers module-eval cycle before store-level `getBlock` decoupling.
4. Add an import-boundary check once the Center route exists.

## Rollback

If a boundary refactor regresses workspace behavior, revert the code patch and keep these docs/scripts. The existing `dev:full` and `dev:full:capped` commands remain unchanged.
