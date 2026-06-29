---
id: center-decisions
type: decision-log
project: center
status: active
updated: 2026-06-28
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
