---
id: center-decisions
type: decision-log
project: center
status: active
updated: 2026-06-29
links:
  - center-index
  - center-interfaces
  - RP-20260628-002
---

# Center Decisions

## 2026-06-28 — Center uses separated primitives, not one overloaded event model

Decision:
Center's core spine separates Profile, Actor, Producer/Capability, RawEvent, Observation, Evidence, Loop, Decision, FeatureProjection, PredictionSummary, Recommendation, ActionProposal, Outcome, and Policy.

Reason:
The previous event-only model blurred raw facts, semantic interpretations, proof, prediction inputs, human choices, actions, and outcomes. That would damage provenance, prediction quality, and trust.

Consequence:
Implementation must not treat observations, evidence, features, predictions, decisions, and outcomes as generic event payloads.

Revisit if:
The primitives prove too heavy after the first dogfood implementation, but do not collapse them before testing the contracts.

## 2026-06-28 — MS2Scheduler is first mature producer and reference pattern

Decision:
MS2Scheduler should feed Center as the first mature producer/module and serve as the trust-pattern reference for deterministic engines, receipts, recovery, and calibration.

Reason:
MS2Scheduler already implements deterministic planning, activity capture, calibration, recovery, receipts, QA, ADRs, and a Today/Recovery surface.

Consequence:
Do not rebuild scheduler logic inside Center. Build an adapter/interface boundary.

Revisit if:
The adapter boundary becomes more costly than direct integration, or if MS2Scheduler is replaced by a generalized scheduler module.

## 2026-06-28 — Center implementation is blocked by Sim CPU/RAM usability

Decision:
Phase 0 is Sim CPU/RAM stabilization and Center import-boundary protection.

Reason:
Sim has documented workspace route compile and memory issues from heavy workflow/block-registry imports. Center dogfooding fails if local dev remains unusable.

Consequence:
Center route must avoid workflow editor/block registry imports on the hot path.

Revisit if:
The performance issue is already fixed upstream or a lightweight separate app shell is chosen.

## 2026-06-28 — Producer interface before full adapter SDK

Decision:
Define a small producer interface now; defer a full SDK until multiple producers exist.

Reason:
We need consistency without overbuilding infrastructure.

Consequence:
First producers normalize into CenterRawEvent and CenterObservation contracts.

Revisit if:
Three or more producers require duplicated integration code.

## 2026-06-28 — Prediction starts as honest baseline summaries

Decision:
Initial prediction output must support insufficient-data states, confidence, drivers, feature refs, and outcome tracking.

Reason:
Early dogfood data is sparse. Fake precision would destroy trust.

Consequence:
Mahalanobis and richer models are deferred until enough baseline data exists.

Revisit if:
Sufficient data exists and evaluation metrics justify a richer model.

## 2026-06-29 — Review packets become Center-visible worker gates

Decision:
Center stores review packet status, approval state, round count, source evidence, and worker gate state.

Reason:
Workers need to distinguish approved execution packets from drafts without relying on hidden chat context or prose-only handoffs.

Consequence:
Review packet imports are explicit local actions. Imported packets preserve `.ai-bridge` source evidence and expose `workerGate`.

Revisit if:
Review packet state moves to a durable local server store and Center no longer needs browser-local imports.

## 2026-06-29 — Center system documentation belongs in repo-local project docs

Decision:
Stable Center system documentation lives under `apps/sim/docs/center/`. `.ai-bridge` remains the evolution ledger for decisions, reviews, audits, current plans, protocols, and cross-project coordination.

Reason:
Future engineers and agents should be able to understand Center from repository documentation without chat history. Keeping system docs inside `.ai-bridge` was creating a second documentation site and mixing stable implementation truth with governance history.

Rejected:
Do not keep `.ai-bridge/projects/center/interfaces.md`, `.ai-bridge/projects/center/local-spine.md`, `.ai-bridge/schemas/center-ontology-v1.md`, or `.ai-bridge/capabilities/metadata-contract.md` as competing explanatory sources. They now redirect to canonical project docs or machine-readable schemas.

Consequence:
New Center architecture, ontology, producer, capability, operation, and dogfood documentation must be added under `apps/sim/docs/center/`. `.ai-bridge` documents may link to those files but must not duplicate their system explanations.

Revisit if:
Center is extracted from `apps/sim` into another package or app; move the canonical docs with the owning project.

## 2026-06-29 — Producer imports fail closed on unknown capability ids

Decision:
Center producer import packets must declare capability ids. Local import routes read the registered capability ids from `.ai-bridge/capabilities/*.json`, reject packets with unknown declared ids, and return the registry to the browser-local importer. The local importer also checks packet-level and record-level capability ids before mutating profile data.

Reason:
Producer discovery is not execution authority. The first runtime boundary must prevent unregistered producer abilities from silently entering Center profile state.

Rejected:
Do not build the full authority/truth-impact/policy enforcement engine in this slice. The current boundary only proves that producer import capability ids are registered and visible.

Consequence:
Current producers must keep their declared capability ids synchronized with `.ai-bridge/capabilities/*.json`. Unknown ids block the import and appear in `CenterProducerImportSummary.blockedUnknownCapabilityIds`. Unresolved producer references are reported in the same summary instead of being silently dropped.

Revisit if:
Capabilities move from `.ai-bridge` files into a durable local-server registry, or when A2/A3/A4 action execution is connected.

## 2026-06-29 — Center workspace storage uses local JSON with browser fallback

Decision:
Use workspace-scoped local-server JSON storage under `.ai-bridge/artifacts/center-storage/<workspaceId>.json` as the first non-browser Center storage adapter. The Center UI uses the workspace storage route first and falls back to workspace-scoped browser-local storage if the route is unavailable.

Reason:
Center needs a conservative local-first storage path that survives browser storage loss without adding DB migrations, sync, auth policy, or remote telemetry scope.

Rejected:
Do not introduce cloud sync, database-backed Center storage, or multi-user shared state in this slice.

Consequence:
Profile data remains local. Workspace storage is contract-bound through `apps/sim/app/api/center/storage/[workspaceId]/route.ts`, and profile export/delete works against the active storage adapter.

Revisit if:
Center needs authenticated sync, multi-device access, team visibility, or stronger filesystem encryption guarantees.

## 2026-06-29 — Prediction outcome scoring is explicit and derived

Decision:
Score prediction outcomes only when an outcome payload provides an explicit actual value, score, observed value, occurrence flag, or loop-drift occurrence flag. Ambiguous outcomes remain `unscored`.

Reason:
Baseline prediction must stay honest. Scoring inferred from vague outcome text would create fake precision and undermine trust.

Rejected:
Do not infer success/failure from arbitrary strings, loop status, recommendation status, or action status in this slice.

Consequence:
`scoreCenterPredictionOutcomes()` returns absolute error and Brier score for explicit outcomes, and the Center UI surfaces scored/unscored outcome state in the Prediction Summary panel.

Revisit if:
Outcome records gain typed schemas per prediction type or enough dogfood data exists to calibrate richer prediction models.
