# Repository Map

## Purpose

This document maps the major repository folders so a new engineer can orient without chat history.

Repository path: `docs/REPOSITORY_MAP.md`  
Owning project: Sim repository  
Owner: Sim maintainers  
Current status: Active orientation map, verified against the top-level directory tree on 2026-06-29.

## Applications

`apps/sim/`

Main Next.js application. It contains the UI, API routes, workflow editor, Center route, blocks, tools, stores, providers, and app-local docs.

Important paths:

- `apps/sim/app/`
- `apps/sim/app/center/[workspaceId]/`
- `apps/sim/app/api/`
- `apps/sim/components/`
- `apps/sim/lib/`
- `apps/sim/docs/`
- `apps/sim/AGENTS.md`

`apps/realtime/`

Bun Socket.IO realtime server for collaborative canvas behavior. It intentionally avoids importing the Next.js app, React, block/tool registry, providers, and workflow executor.

`apps/docs/`

Documentation app surface.

`apps/mothership/`

Mothership app surface. Mothership-specific planning docs currently live under `docs/superpowers/`.

## Packages

`packages/`

Shared packages consumed by applications. Package boundaries are app-to-package only; packages must not import from `apps/*`.

Important package folders:

- `packages/audit/`
- `packages/auth/`
- `packages/cli/`
- `packages/db/`
- `packages/logger/`
- `packages/mothership-client/`
- `packages/mothership-contracts/`
- `packages/platform-authz/`
- `packages/python-sdk/`
- `packages/realtime-protocol/`
- `packages/security/`
- `packages/testing/`
- `packages/ts-sdk/`
- `packages/tsconfig/`
- `packages/utils/`
- `packages/workflow-authz/`
- `packages/workflow-persistence/`
- `packages/workflow-types/`

Package overview:

```text
packages/README.md
```

## Project Documentation

`docs/`

Repository-level project documentation, documentation guide, repository map, and local project notes.

Important paths:

- `docs/DOCUMENTATION_GUIDE.md`
- `docs/REPOSITORY_MAP.md`
- `docs/README.md`
- `docs/understand-prism-integration.md`
- `docs/superpowers/`

`apps/sim/docs/`

Sim app-local documentation.

Important paths:

- `apps/sim/docs/DEV_COMPILE_PERF.md`
- `apps/sim/docs/LOCAL_DEV_PROFILES.md`
- `apps/sim/docs/LOCAL_DEV_PLAYGROUND.md`
- `apps/sim/docs/center/`

`apps/sim/docs/center/`

Canonical Center project documentation.

Start at:

```text
apps/sim/docs/center/README.md
```

## Governance And Evolution

`.ai-bridge/`

Agent coordination and governance layer. It is not source code and should not become a duplicate documentation site.

Important paths:

- `.ai-bridge/README.md`
- `.ai-bridge/current-plan.md`
- `.ai-bridge/decisions.md`
- `.ai-bridge/protocols/`
- `.ai-bridge/ontology/`
- `.ai-bridge/schemas/`
- `.ai-bridge/capabilities/`
- `.ai-bridge/projects/`
- `.ai-bridge/projects/center/`

## Agent And Editor Guidance

`AGENTS.md`

Root agent instructions for this repository.

`apps/sim/AGENTS.md`

Sim app-specific agent and coding instructions.

`.agents/`

Repo-local agent skills.

`.claude/`

Claude commands and rules.

`.cursor/`

Cursor commands, rules, and skills.

## Tooling And Deployment

`scripts/`

Repository scripts for checks, generated contracts, release support, and Center packaging.

Important Center script:

```text
scripts/check-center-import-boundary.ts
scripts/package-center-app.ts
```

`docker/`

Docker support files.

`helm/`

Helm deployment chart, including `helm/sim/`.

`.github/`

GitHub workflows and issue templates.

`.devcontainer/`

Dev container configuration.

## Build Artifacts And Generated Folders

Do not broadly inspect or document generated/vendor folders unless debugging a specific artifact:

- `node_modules`
- `.git`
- `dist`
- `build`
- `.next`
- `.cache`
- `.turbo/cache`
- coverage output

## Related Documents

- `docs/DOCUMENTATION_GUIDE.md`
- `apps/sim/docs/center/README.md`
- `packages/README.md`
- `.ai-bridge/README.md`
