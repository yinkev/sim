---
id: center-documentation-governor-20260629
type: audit
project: center
status: complete
created: 2026-06-29
scope: repository-documentation-and-knowledge-architecture
verdict: repository-is-primary-source-with-known-weak-areas
links:
  - center-documentation-index
  - repository-documentation-guide
  - repository-map
  - center-roadmap-v1
  - RP-20260629-003
  - RP-20260629-004
---

# Repository Documentation Governor Audit - 2026-06-29

## Verdict

The repository is now the primary source of truth for Center system understanding.

The boundary is:

```text
apps/sim/docs/center/ = stable Center system documentation
docs/ = repository-level documentation and navigation
.ai-bridge/ = governance, evolution, decisions, audits, reviews, protocols, current plan
```

This is sufficient for a new senior engineer to understand the implemented Center system, its current boundaries, how to run it, how producer imports work, how to run the first dogfood session, and which decisions/gates still govern dogfooding.

It is not yet complete for production operations because runtime capability enforcement, production storage, live producer connectors, prediction scoring, and profile export/delete UI remain implementation gaps.

## Audit Method

Review loop:

```text
Evaluate -> Review -> Grade -> Iterate
```

Stopped at convergence after repository map, Center docs, governance pointers, stale duplicate redirection, link checks, and targeted Center runtime checks produced no material remaining documentation-placement defect for the current implementation.

Inspected implementation before writing system docs:

```text
apps/sim/app/center/[workspaceId]/center-surface.tsx
apps/sim/app/center/[workspaceId]/page.tsx
apps/sim/app/api/center/*/import/route.ts
apps/sim/lib/api/contracts/center.ts
apps/sim/lib/center/types.ts
apps/sim/lib/center/local-spine.ts
apps/sim/lib/center/producer-import.ts
apps/sim/lib/center/baseline-prediction.ts
apps/sim/lib/center/review-packets.ts
apps/sim/lib/center/review-packet-files.ts
apps/sim/lib/center/producers/*.ts
scripts/check-center-import-boundary.ts
scripts/package-center-app.ts
package.json
apps/sim/package.json
```

Inspected documentation/governance before editing:

```text
README.md
docs/README.md
apps/sim/docs/LOCAL_DEV_PROFILES.md
apps/sim/docs/DEV_COMPILE_PERF.md
.ai-bridge/README.md
.ai-bridge/current-plan.md
.ai-bridge/ontology/freeze-v1.md
.ai-bridge/protocols/execution-authority.md
.ai-bridge/projects/center/index.md
.ai-bridge/projects/center/interfaces.md
.ai-bridge/projects/center/local-spine.md
.ai-bridge/projects/center/roadmap.md
.ai-bridge/projects/center/decisions.md
.ai-bridge/projects/center/reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md
.ai-bridge/projects/center/reviews/RP-20260629-004-pre-dogfood-overnight-hardening.md
.ai-bridge/schemas/center-ontology-v1.md
.ai-bridge/capabilities/metadata-contract.md
```

## Repository Documentation Audit

### Documentation Added

Added canonical Center system docs:

```text
apps/sim/docs/center/README.md
apps/sim/docs/center/architecture.md
apps/sim/docs/center/ontology-and-local-spine.md
apps/sim/docs/center/producer-model.md
apps/sim/docs/center/capability-system.md
apps/sim/docs/center/operations-and-dogfood.md
apps/sim/docs/center/morning-dogfood-runbook.md
```

Added repository-level navigation and placement docs:

```text
docs/DOCUMENTATION_GUIDE.md
docs/REPOSITORY_MAP.md
```

Updated navigation entry points:

```text
README.md
docs/README.md
apps/sim/docs/LOCAL_DEV_PROFILES.md
.ai-bridge/README.md
.ai-bridge/projects/center/index.md
```

### Documentation Moved

No file was moved with `git mv`.

System explanations were moved logically by making these repo-local files canonical:

```text
apps/sim/docs/center/ontology-and-local-spine.md
apps/sim/docs/center/producer-model.md
apps/sim/docs/center/capability-system.md
```

The older `.ai-bridge` files were converted to governance pointers:

```text
.ai-bridge/projects/center/interfaces.md
.ai-bridge/projects/center/local-spine.md
.ai-bridge/schemas/center-ontology-v1.md
.ai-bridge/capabilities/metadata-contract.md
```

### Documentation Merged

Merged stable explanatory content from `.ai-bridge` into:

```text
apps/sim/docs/center/architecture.md
apps/sim/docs/center/ontology-and-local-spine.md
apps/sim/docs/center/producer-model.md
apps/sim/docs/center/capability-system.md
apps/sim/docs/center/operations-and-dogfood.md
apps/sim/docs/center/morning-dogfood-runbook.md
```

Governance rationale and historical evidence remain in `.ai-bridge`.

### Documentation Removed

No documentation files were deleted.

Competing system explanations were removed from these files and replaced with canonical pointers:

```text
.ai-bridge/projects/center/interfaces.md
.ai-bridge/projects/center/local-spine.md
.ai-bridge/schemas/center-ontology-v1.md
.ai-bridge/capabilities/metadata-contract.md
```

### Documentation Reorganized

Center now has one project-local documentation root:

```text
apps/sim/docs/center/
```

The root README now links to repository documentation:

```text
docs/REPOSITORY_MAP.md
docs/DOCUMENTATION_GUIDE.md
apps/sim/docs/center/README.md
```

The `.ai-bridge` operating model now explicitly says it is not a duplicate documentation site.

### Broken Links Fixed

Added explicit repository paths to new docs and navigation files.

Verified relative Markdown links across:

```text
README.md
docs/
apps/sim/docs/center/
apps/sim/docs/LOCAL_DEV_PROFILES.md
.ai-bridge/README.md
.ai-bridge/projects/center/
.ai-bridge/schemas/center-ontology-v1.md
.ai-bridge/capabilities/metadata-contract.md
.ai-bridge/ontology/freeze-v1.md
```

Result:

```text
Markdown relative links OK (42 files)
Explicit canonical paths OK
```

### Stale Documents Archived

No files were archived.

Reason: the stale risk was duplicate explanatory truth, not obsolete standalone files. Compatibility pointers preserve older review and phase links while stopping the duplicate truth.

### Duplicate Truth Eliminated

Eliminated duplicate system-truth ownership by redirecting:

```text
.ai-bridge/projects/center/interfaces.md
.ai-bridge/projects/center/local-spine.md
.ai-bridge/schemas/center-ontology-v1.md
.ai-bridge/capabilities/metadata-contract.md
```

These files now point to:

```text
apps/sim/docs/center/ontology-and-local-spine.md
apps/sim/docs/center/producer-model.md
apps/sim/docs/center/capability-system.md
apps/sim/lib/center/types.ts
apps/sim/lib/center/local-spine.ts
apps/sim/lib/center/producer-import.ts
apps/sim/lib/api/contracts/center.ts
.ai-bridge/schemas/capability.schema.json
```

Added supersession notes to older governance records whose knowledge-system or dogfood-runbook guidance was superseded:

```text
.ai-bridge/projects/center/reviews/RP-20260629-003-dogfood-readiness-capability-enforcement.md
.ai-bridge/projects/center/reviews/RP-20260629-004-pre-dogfood-overnight-hardening.md
.ai-bridge/projects/center/audits/phase-0-12-integration-audit-20260629.md
```

### Documentation Coverage

| Area | Canonical coverage | Status |
| --- | --- | --- |
| Center product boundary | `apps/sim/docs/center/architecture.md` | Covered |
| Sim host and route boundary | `apps/sim/docs/center/architecture.md`, `apps/sim/docs/LOCAL_DEV_PROFILES.md` | Covered |
| CPU/RAM stabilization | `apps/sim/docs/LOCAL_DEV_PROFILES.md`, `apps/sim/docs/DEV_COMPILE_PERF.md` | Covered |
| Local spine | `apps/sim/docs/center/ontology-and-local-spine.md` | Covered |
| Ontology | `apps/sim/docs/center/ontology-and-local-spine.md`, `.ai-bridge/ontology/freeze-v1.md` | Covered |
| Capability system | `apps/sim/docs/center/capability-system.md` | Covered with runtime gap documented |
| Producer import model | `apps/sim/docs/center/producer-model.md` | Covered |
| MS2Scheduler integration | `apps/sim/docs/center/producer-model.md`, `apps/sim/docs/center/operations-and-dogfood.md` | Covered |
| GitHub producer | `apps/sim/docs/center/producer-model.md` | Covered |
| Plane producer | `apps/sim/docs/center/producer-model.md` | Covered |
| Learn/Understand producers | `apps/sim/docs/center/producer-model.md` | Covered |
| Worker Lane producer | `apps/sim/docs/center/producer-model.md` | Covered |
| Prediction | `apps/sim/docs/center/ontology-and-local-spine.md`, `apps/sim/docs/center/architecture.md` | Covered with scoring gap documented |
| Review packets | `apps/sim/docs/center/ontology-and-local-spine.md`, `apps/sim/docs/center/producer-model.md` | Covered |
| Packaging | `apps/sim/docs/center/operations-and-dogfood.md` | Covered |
| Dogfood operation | `apps/sim/docs/center/operations-and-dogfood.md`, `apps/sim/docs/center/morning-dogfood-runbook.md` | Covered with gates documented |

### Remaining Weak Areas

These are implementation/product gaps, not documentation-placement gaps:

- Runtime capability enforcement is not implemented.
- Production storage and sync are not implemented.
- Live GitHub, Plane, Learn/Understand, and worker connectors are not implemented.
- Profile export/delete UI is not implemented.
- Prediction outcome scoring is not implemented.

These are documentation weak areas outside current Center scope:

- Some unrelated public docs still contain future-migration notes, for example `docs/superpowers/plans/mothership-backend-replacement-architecture.md`.
- The root public `README.md` is still primarily marketing and setup oriented. It now links to repo documentation but is not a full engineering handbook.

## Repository Organization Audit

### Folder Improvements

Added:

```text
apps/sim/docs/center/
```

This places Center documentation with the Sim app code it describes.

Added:

```text
docs/DOCUMENTATION_GUIDE.md
docs/REPOSITORY_MAP.md
```

This gives repository-level orientation without turning `.ai-bridge` into a docs site.

### Naming Improvements

Used boring names:

```text
README.md
architecture.md
ontology-and-local-spine.md
producer-model.md
capability-system.md
operations-and-dogfood.md
DOCUMENTATION_GUIDE.md
REPOSITORY_MAP.md
```

No clever taxonomy or generated wiki structure was introduced.

### Project Organization Improvements

Center system truth now has one root:

```text
apps/sim/docs/center/
```

Center governance truth remains in:

```text
.ai-bridge/projects/center/
```

Capability registry metadata remains in:

```text
.ai-bridge/capabilities/
```

Machine-readable capability schema remains in:

```text
.ai-bridge/schemas/capability.schema.json
```

### Remaining Structural Issues

- `.ai-bridge` still contains historical phase docs with system details. They are acceptable as evidence records, but future edits should avoid refreshing them into canonical docs.
- `.ai-bridge/projects/daily-cockpit/` remains as legacy source material and is referenced by older review packets.
- `docs/` mixes current repository docs with older Mothership planning docs. This was not reorganized because it is outside the Center documentation-governor scope and may require separate ownership decisions.

## Knowledge Architecture Audit

| Dimension | Grade | Evidence |
| --- | --- | --- |
| Discoverability | A- | Root README links `docs/REPOSITORY_MAP.md`, `docs/DOCUMENTATION_GUIDE.md`, and `apps/sim/docs/center/README.md`. Center docs have a read order. |
| Navigation | A- | New docs use explicit repository paths. Relative Markdown link check passed across 39 docs. Older unrelated docs still contain some future-migration notes. |
| Ownership | A | Center docs declare repository path, owning project, owner, and status. `.ai-bridge` documents now state governance/evolution ownership. |
| Source-of-truth correctness | A- | System truth is in `apps/sim/docs/center/`; `.ai-bridge` duplicate system docs are now pointers. Historical phase files still contain evidence details by design. |
| Project boundaries | A- | Center, Sim, producer, capability, and governance boundaries are documented. Production connector and storage boundaries remain future implementation gaps. |
| Governance boundaries | A | `.ai-bridge/README.md`, `.ai-bridge/projects/center/index.md`, and decision log now state repository-docs vs `.ai-bridge` split. |
| Documentation quality | A- | Major docs include purpose, path, owner, status, code sources, dependencies, dependents, limitations, extension points, and related docs. |

## Verification

Commands run:

```text
bun -e '<Markdown relative link checker>'
```

Result:

```text
Markdown relative links OK (42 files)
```

```text
test -e <canonical paths>
```

Result:

```text
Explicit canonical paths OK
```

```text
git diff --check
```

Result: passed.

```text
bun run check:center-boundary
```

Result:

```text
Center import boundary OK
```

```text
bun run check:api-validation
```

Result:

```text
API validation audit passed.
center total=6 zod=6 nonZod=0
```

```text
bun --cwd apps/sim test lib/center/local-spine.test.ts lib/center/producer-import.test.ts lib/center/baseline-prediction.test.ts lib/center/review-packets.test.ts lib/center/producers/ms2scheduler.test.ts lib/center/producers/github.test.ts lib/center/producers/plane.test.ts lib/center/producers/learn-understand.test.ts lib/center/producers/worker-lane.test.ts
```

Result:

```text
Test Files  9 passed (9)
Tests  15 passed (15)
```

## Final Question

If every chat log disappeared tomorrow, could a brand-new senior engineer clone this repository and understand what Center is, why it exists, how it works, why decisions were made, how to extend it, how to operate it, and how to debug it using only the repository?

Answer: Yes for the implemented local Center system.

Not yes for production-ready Center because several implementation capabilities do not exist yet. Those missing areas are now explicitly documented in `apps/sim/docs/center/README.md`, `apps/sim/docs/center/capability-system.md`, and `apps/sim/docs/center/operations-and-dogfood.md`.
