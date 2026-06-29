# Local Dev Profiles

## Purpose

Use a low-resource Sim command by default while Center is being developed.

Phase 0 rule: do not start Center UI implementation until local CPU/RAM behavior is handled or explicitly waived.

## Commands

| Command | Processes | Use when | Notes |
| --- | --- | --- | --- |
| `bun run dev:lite` | `apps/sim` only | daily app work, Center planning, docs, API work not requiring realtime | capped app heap, no realtime server, no mothership app |
| `bun run dev:center` | `apps/sim` only | Center route/spine work after Phase 0 | same capped app process plus `CENTER_DEV=1` marker |
| `bun run dev:full:capped` | `apps/sim` + `apps/realtime` | workflow/collaboration work needing sockets | capped app heap, realtime still runs |
| `bun run dev:full` | `apps/sim` + `apps/realtime` | full existing behavior check | highest local footprint |
| `bun run dev:mothership` | `apps/mothership` only | mothership service work | separate app process |

## Existing performance evidence

`apps/sim/docs/DEV_COMPILE_PERF.md` records the measured problem:

- `/workspace` cold compile improved from 85s to 15s after dev OTel/package-import/transpile changes.
- `/workspace/[workspaceId]/home` still has a 24s cold compile.
- Remaining hot path pulls the workflow/block registry through workspace route state.

Current documented chain:

```text
workspace shell/layout
  -> workflow stores
  -> getBlock
  -> blocks barrel
  -> registry
  -> hundreds of block modules
```

Additional current hot path found during Phase 0 inspection:

```text
apps/sim/app/workspace/layout.tsx
  -> apps/sim/app/workspace/providers/socket-provider.tsx
  -> @/stores/workflows/registry/store
  -> @/stores/workflows/utils
  -> @/blocks
  -> @/blocks/registry
```

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

## Phase 0 decision

Script/doc changes are safe now because they do not change product behavior.

Do not attempt the registry decoupling as a quick fix. `DEV_COMPILE_PERF.md` documents that the previous dependency-injection attempt exposed a latent blocks/triggers circular dependency and had to be reverted.

Next code-level fix should be a deliberate import-boundary refactor:

1. Move socket/workflow registry wiring out of the root workspace layout hot path where possible.
2. Keep workflow editor route imports under `/workspace/[workspaceId]/w/**`.
3. Make Center route use Center-owned providers instead of workspace-global workflow providers.
4. Break blocks/triggers module-eval cycle before changing `getBlock` access in stores.
