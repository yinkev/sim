---
id: center-interfaces
type: governance-pointer
project: center
status: redirected
updated: 2026-06-29
links:
  - center-documentation-governor-20260629
  - center-documentation-index
  - center-ontology-local-spine
  - center-producer-model
  - center-capability-system
---

# Center Interfaces

## Canonical Location

The canonical Center interface documentation now lives in repository project docs:

```text
apps/sim/docs/center/ontology-and-local-spine.md
apps/sim/docs/center/producer-model.md
apps/sim/docs/center/capability-system.md
```

Exact runtime field names live in code:

```text
apps/sim/lib/center/types.ts
apps/sim/lib/center/local-spine.ts
apps/sim/lib/center/producer-import.ts
apps/sim/lib/api/contracts/center.ts
```

## Why This File Remains

This file remains as a governance pointer because older review packets and phase records reference `.ai-bridge/projects/center/interfaces.md`.

Do not add new system interface truth here. `.ai-bridge` records evolution, decisions, audits, and review packets. Project documentation belongs with the project it describes.

## Related Governance

```text
.ai-bridge/ontology/freeze-v1.md
.ai-bridge/protocols/execution-authority.md
.ai-bridge/projects/center/decisions.md
.ai-bridge/projects/center/audits/repository-documentation-governor-20260629.md
```
