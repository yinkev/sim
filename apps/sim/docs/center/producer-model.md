# Center Producer Model

## Purpose

This document explains how external state enters Center.

Repository path: `apps/sim/docs/center/producer-model.md`  
Owning project: Center  
Owner: Sim maintainers  
Current status: Local import producer adapters exist for MS2Scheduler, GitHub, Plane, Learn/Understand, Review Packets, and Worker Lane. GitHub and Plane also have read-only live import paths behind explicit environment configuration.

## Model

A producer is an implementation source that emits events, evidence, observations, loops, recommendations, or action proposals into Center.

Current producers do not write directly into the UI. They create typed import packets, and Center applies those packets to a selected profile.

```text
producer source
  -> producer-specific normalizer
  -> CenterProducerImportPacket
  -> applyCenterProducerImport
  -> profile-scoped CenterDataset
```

Review packets use a separate import record because they are governance files rather than ordinary event producers:

```text
.ai-bridge/projects/center/reviews/*.md
  -> CenterReviewPacketImportRecord[]
  -> applyCenterReviewPacketImport
  -> profile-scoped CenterDataset
```

## Canonical Code Paths

Shared packet type and applier:

```text
apps/sim/lib/center/producer-import.ts
```

Route contracts:

```text
apps/sim/lib/api/contracts/center.ts
```

Local import routes:

```text
apps/sim/app/api/center/ms2scheduler/import/route.ts
apps/sim/app/api/center/github/import/route.ts
apps/sim/app/api/center/plane/import/route.ts
apps/sim/app/api/center/learn-understand/import/route.ts
apps/sim/app/api/center/review-packets/import/route.ts
apps/sim/app/api/center/workers/import/route.ts
```

UI import actions:

```text
apps/sim/app/center/[workspaceId]/center-surface.tsx
```

## Import Packet Contract

`CenterProducerImportPacket` contains:

- `producerId`
- `producerDisplayName`
- `actor`
- `evidence`
- `rawEvents`
- `observations`
- `loops`
- `recommendations`
- `actionProposals`

The applier is idempotent by `sourceRef` for evidence, raw events, observations, loops, recommendations, and action proposals. Duplicate source refs increment `skippedExisting`.

Observation source refs are resolved through raw event source refs. Evidence refs are resolved through evidence source refs. Recommendation refs are resolved before action proposals are attached.

## Current Producers

| Producer | Source | Mapper | Route | Center output |
| --- | --- | --- | --- | --- |
| MS2Scheduler | `/Users/kyin/Projects/MS2Scheduler/app/data` or `MS2SCHEDULER_DATA_DIR` | `apps/sim/lib/center/producers/ms2scheduler.ts` | `apps/sim/app/api/center/ms2scheduler/import/route.ts` | plan evidence, study events, observations, study loop, recovery recommendations, action proposals |
| GitHub | `.ai-bridge/projects/github-producer/sample-events.json`, `CENTER_GITHUB_PRODUCER_FILE`, or live `CENTER_GITHUB_LIVE_REPOS` | `apps/sim/lib/center/producers/github.ts`, `apps/sim/lib/center/producers/github-files.ts`, `apps/sim/lib/center/producers/github-live.ts` | `apps/sim/app/api/center/github/import/route.ts` | commits, issues, pull requests, reviews, CI runs, repo loops |
| Plane | `.ai-bridge/projects/plane-producer/sample-events.json`, `CENTER_PLANE_PRODUCER_FILE`, or live `CENTER_PLANE_WORKSPACE_SLUG` + `CENTER_PLANE_PROJECT_ID(S)` | `apps/sim/lib/center/producers/plane.ts`, `apps/sim/lib/center/producers/plane-files.ts`, `apps/sim/lib/center/producers/plane-live.ts` | `apps/sim/app/api/center/plane/import/route.ts` | projects, cycles, modules, issues/work-items, comments/statuses from sample files, project loops |
| Learn/Understand | `.ai-bridge/projects/learn-understand-producers/sample-events.json` or `CENTER_LEARN_UNDERSTAND_PRODUCER_FILE` | `apps/sim/lib/center/producers/learn-understand.ts` | `apps/sim/app/api/center/learn-understand/import/route.ts` | learning gaps, practice tasks, review evidence, system maps, dependency observations, risk evidence |
| Worker Lane | `.ai-bridge/projects/worker-lane/sample-events.json` or `CENTER_WORKER_LANE_PRODUCER_FILE` | `apps/sim/lib/center/producers/worker-lane.ts` | `apps/sim/app/api/center/workers/import/route.ts` | run starts/completions, failures, diffs, test results, artifacts, review-needed proposals |
| Review Packets | `.ai-bridge/projects/center/reviews/*.md` or `CENTER_REVIEW_PACKET_DIR` | `apps/sim/lib/center/review-packet-files.ts` | `apps/sim/app/api/center/review-packets/import/route.ts` | review packet records and source evidence |

## Local Development Gate

Import routes are local-development routes. They are enabled when:

```text
CENTER_DEV=1
```

or when:

```text
NODE_ENV !== production
```

Production behavior should not rely on these routes until a reviewed storage, auth, capability, and policy model exists.

## Live Source Modes

GitHub live imports are enabled only when `CENTER_GITHUB_LIVE_REPOS` contains one or more `owner/repo` entries. Optional variables:

```text
CENTER_GITHUB_TOKEN=/redacted/token
GITHUB_TOKEN=/redacted/token
CENTER_GITHUB_API_BASE_URL=https://api.github.com
```

The GitHub live reader calls the official REST endpoints for repository commits, issues, pull requests, pull-request reviews, and workflow runs. The route response reports:

```text
source.mode=live-github
```

Plane live imports are enabled only when workspace, project, and token variables are all present:

```text
CENTER_PLANE_WORKSPACE_SLUG=my-workspace
CENTER_PLANE_PROJECT_ID=project-uuid
CENTER_PLANE_PROJECT_IDS=project-uuid,other-project-uuid
CENTER_PLANE_API_KEY=/redacted/token
PLANE_API_KEY=/redacted/token
PLANE_OAUTH_TOKEN=/redacted/token
CENTER_PLANE_BASE_URL=https://api.plane.so
CENTER_PLANE_APP_BASE_URL=https://app.plane.so
```

The Plane live reader uses the official Plane REST paths for project detail, cycles, modules, and work items:

```text
/api/v1/workspaces/{workspace_slug}/projects/{project_id}/
/api/v1/workspaces/{workspace_slug}/projects/{project_id}/cycles/
/api/v1/workspaces/{workspace_slug}/projects/{project_id}/modules/
/api/v1/workspaces/{workspace_slug}/projects/{project_id}/work-items/
```

The route response reports:

```text
source.mode=live-plane
```

Neither live reader writes to the external system. Neither stores credentials in Center data.

## Capability Relationship

Producer import implementation and capability metadata are separate:

- Import code maps records into Center.
- Capability metadata declares what the producer can do and the authority/truth impact of that ability.

Current capability files live under:

```text
.ai-bridge/capabilities/*.json
```

The capability system is documented in:

```text
apps/sim/docs/center/capability-system.md
```

Capability metadata is enforced at the first runtime boundary: import packets declare capability ids, local routes reject unknown declared ids, and `applyCenterProducerImport` blocks unknown packet-level or record-level capability ids before mutating the profile dataset.

## Adding A Producer

1. Define the source record shape in `apps/sim/lib/center/producers/<producer>.ts`.
2. Normalize file or external input in `apps/sim/lib/center/producers/<producer>-files.ts` if local input is file-backed.
3. Normalize live external input in `apps/sim/lib/center/producers/<producer>-live.ts` only when credentials/source ids can be read from explicit environment variables.
4. Map records into `CenterProducerImportPacket`.
5. Add a route contract in `apps/sim/lib/api/contracts/center.ts`.
6. Add a local import route under `apps/sim/app/api/center/<producer>/import/route.ts`.
7. Add capability metadata under `.ai-bridge/capabilities/`.
8. Add targeted tests beside the mapper and live reader.
9. Add UI projection only after the packet and spine behavior exist.

Do not import live SDKs or heavy provider registries into the Center route.

## Related Documents

- `apps/sim/docs/center/architecture.md`
- `apps/sim/docs/center/ontology-and-local-spine.md`
- `apps/sim/docs/center/capability-system.md`
- `.ai-bridge/projects/center/phase-5-implementation.md`
- `.ai-bridge/projects/center/phase-8-implementation.md`
- `.ai-bridge/projects/center/phase-9-implementation.md`
- `.ai-bridge/projects/center/phase-10-implementation.md`
- `.ai-bridge/projects/center/phase-11-implementation.md`
