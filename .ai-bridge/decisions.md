---
id: ai-bridge-global-decisions
type: decision-log
status: active
updated: 2026-06-28
links:
  - ai-bridge-index
---

# Global Decisions

## 2026-06-28 — Use `.ai-bridge` as project knowledge and execution bridge

Decision:
Use `.ai-bridge` as the canonical project coordination layer for plans, context, decisions, protocols, reviews, evidence, and worker handoffs.

Reason:
The project needs durable memory between ChatGPT, Pro, CodexPro, local workers, and future sessions.

Consequence:
Architecture/product decisions are not final unless captured in `.ai-bridge`.

Revisit if:
A better integrated project knowledge layer replaces `.ai-bridge`.

## 2026-06-28 — Working product name is Center

Decision:
Use `Center` as the working name for the daily operating surface.

Reason:
It is boring, clear, durable, and avoids distracting branded names.

Consequence:
Avoid `Cockpit` unless discussing prior wording. Do not invent names like personal OS branding.

Revisit if:
The product develops a clearer standard industry category.

## 2026-06-28 — Use standard terminology, not invented branding

Decision:
Use standard industry terms when they are genuinely standard. Avoid cute or invented naming.

Reason:
The project should be understandable by engineers, Pro, agents, and future maintainers without decoding private metaphors.

Consequence:
Terms like `North Star`, `Roadmap`, `ADR`, `Control Plane`, `Event Stream`, `Protocol`, `Evidence`, and `Acceptance Criteria` are allowed when contextually standard.

Revisit if:
A term causes confusion or becomes decorative.

## 2026-06-28 — Light theme default

Decision:
Center should default to a light, technical, editorial, information-dense design.

Reason:
It is a daily productivity and reading surface; dark/cyberpunk/AI-dashboard aesthetics are not the default preference.

Consequence:
Avoid dark-theme-first mockups unless explicitly requested.

Revisit if:
User requests a specific dark mode variant.

## 2026-06-28 — Workflow is a feature module; Center is the operating surface

Decision:
Keep workflow as a feature, but do not make the Center hot path depend on the heavy workflow editor/block registry.

Reason:
The Sim repo has documented CPU/RAM/cold compile issues from broad imports into workspace routes.

Consequence:
Center must show loops, agents, progress, evidence, and blockers without importing the full workflow editor unless the user opens workflow editing.

Revisit if:
The workflow registry is refactored enough to become cheap to import.

## 2026-06-28 — Review packets govern cross-model review

Decision:
Use versioned review packets for ChatGPT/Pro review instead of unstructured relay notes.

Reason:
Pro is self-contained unless the user relays context. Packets make the relay auditable, versioned, and reusable.

Consequence:
Architectural work should move through review packets before workers execute.

Revisit if:
A direct Pro integration or shared workspace review system becomes available.

## 2026-06-28 — Approve Center / Sim / MS2Scheduler architecture with required changes

Decision:
Approve the Center / Sim / MS2Scheduler architecture for implementation after encoding the execution authority model, ontology freeze, capability metadata contract, and Phase 0 CPU/RAM stabilization gate.

Reason:
The architecture has a stable local-first spine: Sim as host platform, Center as operating surface, Workflow as automation feature, MS2Scheduler as first mature producer, workers as execution producers, and `.ai-bridge` as project knowledge/governance.

Consequence:
Autonomous implementation may proceed, but Center UI work must not start until Phase 0 CPU/RAM stabilization is handled or explicitly waived.

Revisit if:
Implementation evidence shows the primitives or capability contract cause incompatible storage/adapter designs.

## 2026-06-28 — Codex is sole orchestrator; workers are producers

Decision:
Codex owns orchestration, sequencing, governance, and final acceptance. Grok, Claude, Codex CLI, Hermes, Sim workflows, and integrations are producers that emit evidence or execute bounded tasks.

Reason:
The user requires a single accountable orchestrator, not a swarm of independent decision-makers.

Consequence:
Worker output must be treated as evidence or proposal until the orchestrator reviews and accepts it.

Revisit if:
The user explicitly delegates orchestration authority to another system.

## 2026-06-28 — Freeze ontology v1 before Center implementation

Decision:
Freeze the v1 ontology in `.ai-bridge/ontology/freeze-v1.md`.

Reason:
Two implementers must be able to build compatible storage and adapter code before UI work begins.

Consequence:
Ontology changes require a new decision that supersedes v1; do not silently mutate the frozen primitives.

Revisit if:
Phase 3 implementation evidence proves a primitive is missing or incorrectly classified.

## 2026-06-28 — Capabilities are typed metadata contracts, not discovered executable authority

Decision:
Use `.ai-bridge/capabilities/metadata-contract.md` and `.ai-bridge/schemas/capability.schema.json` as the v1 capability contract.

Reason:
Center must integrate producers without bespoke architecture or unsafe auto-execution.

Consequence:
Capability discovery is read-only until a capability is explicitly connected under policy, profile scope, authority, truth impact, and evidence rules.

Revisit if:
MS2Scheduler, GitHub, Plane, worker lanes, or future producers cannot be described by the contract without bespoke exceptions.

## 2026-06-28 — Start Center local spine with browser-local storage adapter

Decision:
Use a browser-local storage adapter as the first Center local spine implementation, with a memory adapter for tests and future adapter replacement.

Reason:
Phase 3 needs profile isolation, event/evidence/loop/decision capture, export, and delete without adding DB migrations or server dependencies before the UI and producer lanes prove the shape.

Consequence:
The first spine is local-first and low-risk, but it is not the final multi-device or server-backed storage story.

Revisit if:
Center requires authenticated cross-device sync, shared workspace state, or DB-backed export/delete guarantees.
