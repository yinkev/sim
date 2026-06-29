---
id: center-phase-0-12-integration-audit-20260629
type: audit
project: center
status: complete
created: 2026-06-29
scope: phase-0-through-phase-12
verdict: safe-to-dogfood-with-required-followups
links:
  - center-governing-spec-v1
  - center-roadmap-v1
  - execution-authority-v1
  - center-ontology-freeze-v1
  - capability-metadata-contract-v1
  - current-plan
---

# Center Phase 0-12 Integration Audit — 2026-06-29

## Supersession Note

The knowledge-system followup in this audit was superseded by:

```text
.ai-bridge/projects/center/audits/repository-documentation-governor-20260629.md
docs/DOCUMENTATION_GUIDE.md
apps/sim/docs/center/README.md
```

Current rule: repository docs own stable system truth; `.ai-bridge` owns governance and evolution truth. Do not create a second documentation site inside `.ai-bridge`.

## Verdict

SAFE TO DOGFOOD WITH REQUIRED FOLLOWUPS.

Do not call the system operationally complete yet. The implementation is architecture-conformant enough to dogfood, but live integrations, runtime capability enforcement, and repeated-import/session-level coherency still need hardening before the next major autonomous expansion.

## Audit method

Used a bounded self-review loop for each section:

```text
Evaluate -> Review -> Grade -> Iterate
```

Inspected actual code where available. Separated direct verification from documented worker evidence.

## Directly inspected files

Governance / knowledge:

```text
.ai-bridge/current-plan.md
.ai-bridge/projects/center/governing-spec.md
.ai-bridge/projects/center/roadmap.md
.ai-bridge/protocols/execution-authority.md
.ai-bridge/ontology/freeze-v1.md
.ai-bridge/capabilities/metadata-contract.md
.ai-bridge/projects/cpu-ram-stabilization/phase-0-plan.md
apps/sim/docs/LOCAL_DEV_PROFILES.md
```

Runtime contracts / storage / spine:

```text
apps/sim/lib/center/types.ts
apps/sim/lib/center/local-spine.ts
apps/sim/lib/center/local-spine.test.ts
apps/sim/lib/center/producer-import.ts
apps/sim/lib/api/contracts/center.ts
```

Predictions / governance import:

```text
apps/sim/lib/center/baseline-prediction.ts
apps/sim/lib/center/review-packets.ts
apps/sim/lib/center/review-packet-files.ts
```

Producer adapters:

```text
apps/sim/lib/center/producers/ms2scheduler.ts
apps/sim/lib/center/producers/github.ts
apps/sim/lib/center/producers/github-files.ts
apps/sim/lib/center/producers/plane.ts
apps/sim/lib/center/producers/plane-files.ts
apps/sim/lib/center/producers/learn-understand.ts
apps/sim/lib/center/producers/worker-lane.ts
apps/sim/lib/center/producers/worker-lane.test.ts
apps/sim/app/api/center/workers/import/route.ts
```

Packaging:

```text
scripts/package-center-app.ts
.ai-bridge/projects/center/phase-12-implementation.md
package.json
```

## Checks run during this audit

```text
bun run check:center-boundary
bun run check:api-validation
git diff --check
git status --short --branch
```

Results:

```text
Center import boundary OK
API validation audit passed: 867/867 routes Zod-backed, center family 6/6
Git diff whitespace check passed
Working tree clean after worker commits; branch ahead 27, behind 97
```

Targeted Bun test command was blocked by CodexPro safe bash mode during this audit. Earlier worker evidence claims targeted tests and typecheck passed; this audit does not independently re-run those tests.

## Knowledge system / llm-wiki / OKF status

The repo does not show a separate `llm-wiki` or explicit `OKF` implementation directory.

What exists is `.ai-bridge`, and it now functions as a lightweight project knowledge system:

```text
.ai-bridge/
  ontology/freeze-v1.md
  schemas/capability.schema.json
  schemas/center-ontology-v1.md
  capabilities/*.json
  capabilities/metadata-contract.md
  protocols/execution-authority.md
  projects/*/index.md
  projects/center/governing-spec.md
  projects/center/roadmap.md
  projects/center/phase-*.md
  current-plan.md
  decisions.md
```

Assessment:

```text
OKF-like structure: partial / good enough for this stage
llm-wiki style: partial / project docs are structured, not a full generated code wiki
```

Superseded followup:

The repository now uses `docs/DOCUMENTATION_GUIDE.md` and project-local docs instead of a new documentation site inside `.ai-bridge`. Useful OKF/llm-wiki ideas are adapted as source-of-truth rules, explicit ownership, and backlinks.

## Architecture graph

```text
Sim app shell
  -> standalone Center route /center/[workspaceId]
  -> Center local spine
  -> Center producer import contracts
      -> MS2Scheduler adapter
      -> GitHub sample adapter
      -> Plane sample adapter
      -> Learn adapter
      -> Understand adapter
      -> Worker Lane adapter
  -> Center surface projections
  -> Center.app launcher wrapper
```

Forbidden hot path remains blocked by checks:

```text
Center route must not top-level import:
  workflow editor stores
  block registry
  connector registry
  provider SDK registry
  execution sandbox
  Monaco
  mermaid
  document parsers
```

## Data / ontology graph

```text
Profile
  -> Actor
  -> Evidence
  -> RawEvent
       -> Observation
            -> FeatureProjection
                 -> PredictionSummary
  -> Loop
  -> Recommendation
       -> ActionProposal
  -> Decision
  -> Outcome
  -> ReviewPacket
```

The implementation matches the frozen ontology:

- `types.ts` encodes the major primitives.
- `local-spine.ts` enforces profile ownership on refs.
- `producer-import.ts` maps external source refs to profile-local ids.
- `baseline-prediction.ts` keeps predictions as transparent baseline projections.

## Producer graph

```text
MS2Scheduler
  reads /Users/kyin/Projects/MS2Scheduler/app/data
  emits study plan/current, activity, completion, calibration evidence, recovery proposals

GitHub
  reads .ai-bridge/projects/github-producer/sample-events.json or override env
  emits commit, issue, PR, review, CI observations

Plane
  reads .ai-bridge/projects/plane-producer/sample-events.json or override env
  emits project/cycle/module/issue/comment/status observations

Learn / Understand
  reads .ai-bridge/projects/learn-understand-producers/sample-events.json or override env
  emits learning and system-comprehension observations

Worker Lane
  reads .ai-bridge/projects/worker-lane/sample-events.json or override env
  emits run/diff/test/artifact/failure/review-needed observations
```

## Phase grades

| Phase | Status | Grade | Notes |
| --- | --- | ---: | --- |
| 0 CPU/RAM | handled | A- | Good route isolation and documented evidence. Current audit re-ran center boundary successfully. |
| 1 Ontology/schema freeze | handled | A- | Frozen ontology is coherent. Runtime `types.ts` mostly matches. |
| 2 Capability contract | handled | B+ | Metadata exists and validates conceptually; runtime enforcement is still shallow. |
| 3 Local spine | handled | A- | Strong profile-scoped storage and refs. Needs import edge-case tests for broken source refs. |
| 4 Center surface | handled | B+ | Audit did not fully read UI due tooling friction; evidence and boundary checks are positive. |
| 5 MS2Scheduler | handled | A- | Correct adapter pattern and reviewable recovery. Hardcoded Kevin path is dogfood-only. |
| 6 Baseline prediction | handled | A- | Honest insufficient-data/baseline model. Good anti-fake-precision behavior. |
| 7 Review packets | handled | B+ | Useful, but approval inference from prose should eventually become explicit metadata. |
| 8 GitHub | handled | B+ | Clean sample adapter. Not live GitHub. |
| 9 Plane | handled | B+ | Clean sample adapter. Not live Plane. |
| 10 Learn/Understand | handled | B+ | Clean split between learning and system comprehension. Sample-based. |
| 11 Worker Lane | handled | A- | Good evidence lane; does not execute workers. |
| 12 Center.app | handled | B+ | Minimal launcher. Good because it avoids architecture lock-in. Not distributable app yet. |

Overall grade:

```text
Architecture conformance: A-
Runtime implementation maturity: B+
Dogfood readiness: A-
Operational readiness: B
```

## Material findings

### Finding 1 — Capability metadata is not yet a runtime gate

Severity: medium-high before live integrations.

Evidence:

- Capability JSON includes `authorityRequired`, `truthImpact`, `policyRequirements`, `evidenceProduced`, and `failureModes`.
- Runtime import packets do not carry a first-class capability id per record.
- Import routes do not appear to enforce capability policy beyond local-dev gating and contract validation.

Assessment:

Acceptable for local/sample imports. Not sufficient for live sync, live worker execution, or write capabilities.

Required followup before live producers:

```text
Capability id must attach to import records or packet sections.
Runtime import should verify registered capability metadata.
A2/A3/A4 gates must be enforceable, not only documented.
```

### Finding 2 — Review packet worker-gate inference is too prose-dependent

Severity: medium.

Evidence:

`review-packet-files.ts` extracts verdict prose and sets `workerGate` to `approved-for-execution` for `approved-with-required-changes`.

Assessment:

Correct for current packets but risky long-term. Prose parsing can accidentally grant execution status.

Required followup:

Add explicit frontmatter fields:

```yaml
approval_state: approved-with-required-changes
worker_gate: approved-for-execution
```

Then use prose only as fallback.

### Finding 3 — Producer import silently drops observations with unresolved event refs

Severity: medium.

Evidence:

`producer-import.ts` resolves source event refs and skips an observation if no refs resolve.

Assessment:

Defensive and safe, but can hide producer bugs.

Required followup:

Import summary should include:

```text
observationsSkippedMissingEvents
unresolvedEvidenceRefs
unresolvedRecommendationRefs
```

This preserves truth and makes drift visible.

### Finding 4 — Producer adapters are sample/local, not live integrations

Severity: medium if overstated.

Evidence:

GitHub, Plane, Learn/Understand, and Worker Lane read local sample files by default. MS2 reads a real local path.

Assessment:

Correct for architecture proving. Do not claim live integrations are complete.

Language rule:

```text
Say: initial producer adapter implemented.
Do not say: full GitHub/Plane/worker integration complete.
```

### Finding 5 — Center.app is a local launcher, not an app product

Severity: low-medium.

Evidence:

`package-center-app.ts` generates a repo-local `.app` that starts `bun run dev:center`, opens localhost, and stores artifact under `.ai-bridge/artifacts/center-app`.

Assessment:

This is the right first packaging move because it does not constrain architecture. It is not a signed/notarized distributable app.

Language rule:

```text
Say: repo-local macOS launcher bundle.
Do not say: distributable packaged application.
```

### Finding 6 — Branch divergence is now significant

Severity: medium.

Evidence:

```text
main...upstream/main [ahead 27, behind 97]
```

Assessment:

Not a blocker for dogfooding. It is a future integration risk.

Rule:

Do not pull/rebase/reset casually. Create a deliberate upstream-integration packet before touching upstream history.

## Non-findings / things that look correct

- Center route import boundary check passes.
- API route contract validation passes.
- Ontology split is implemented in `types.ts` and `local-spine.ts`.
- Profile isolation exists and is tested.
- Export/delete profile exists.
- MS2Scheduler recovery remains reviewable; no silent plan mutation.
- Baseline prediction is not fake-calibrated.
- Worker Lane imports execution evidence but does not execute workers.
- Center.app wrapper does not add telemetry, cloud sync, Electron/Tauri, native storage, or database lock-in.

## Required followups before next autonomous expansion

1. Add runtime capability gating for producer imports.
2. Add explicit review packet approval/worker-gate frontmatter.
3. Add unresolved-ref accounting to producer import summaries.
4. Run a full Center spine smoke in one profile importing all producers sequentially.
5. Decide whether `.ai-bridge` remains the only knowledge system or whether to add explicit OKF/llm-wiki project docs.
6. Create an upstream integration/rebase strategy before touching `upstream/main`.

## Recommended next task

Create a new review packet:

```text
RP-20260629-003 — Center Dogfood Readiness / Capability Enforcement
```

Scope:

```text
- full all-producer import smoke
- repeated import idempotency
- unresolved-ref reporting
- explicit worker-gate metadata
- runtime capability-gate design
```

Do not start new feature phases until this packet is resolved.

## Final call

The work is on track and substantially better than a normal prototype. The architecture survived contact with implementation surprisingly well.

But the project should now switch from building more surfaces to hardening truth preservation:

```text
capability enforcement
explicit approval gates
import integrity accounting
full dogfood smoke
```

That is the path from good architecture to trustworthy daily system.
