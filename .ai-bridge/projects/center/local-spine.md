---
id: center-local-spine-v1
type: implementation-note
project: center
status: implemented-initial
updated: 2026-06-28
links:
  - center-governing-spec-v1
  - center-ontology-freeze-v1
  - center-ontology-schema-v1
---

# Center Local Spine v1

## Implemented files

```text
apps/sim/lib/center/types.ts
apps/sim/lib/center/local-spine.ts
apps/sim/lib/center/index.ts
apps/sim/lib/center/local-spine.test.ts
```

## Scope

This is the first local substrate, not UI.

Implemented:

- profile creation
- actor creation
- raw event append
- observation derivation from source events
- evidence attachment
- loop creation
- decision recording
- profile export
- profile delete
- memory storage adapter for tests
- browser-local storage adapter for first local use

Not implemented yet:

- Center route
- server-backed storage
- producer registry execution
- prediction scoring
- review packet UI

## Safety properties

- Every profile-scoped write verifies the profile exists.
- Actor, evidence, and raw-event references must belong to the same profile.
- Profile export returns only the selected profile's records.
- Profile delete removes all profile-scoped records and preserves other profiles.

## Validation

```text
bun --cwd apps/sim test lib/center/local-spine.test.ts
bun --cwd apps/sim type-check
```
