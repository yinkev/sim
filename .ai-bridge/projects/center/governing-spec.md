---
id: center-governing-spec-v1
type: governing-spec
project: center
status: approved-with-required-changes-encoded
updated: 2026-06-28
links:
  - execution-authority-v1
  - center-ontology-freeze-v1
  - capability-metadata-contract-v1
  - center-roadmap-v1
  - cpu-ram-stabilization-phase-0-plan
---

# Center Governing Spec v1

## Verdict

Approved with required changes encoded.

Required changes:

1. Save the execution authority model.
2. Save the ontology freeze.
3. Save the capability metadata contract.
4. Keep Phase 0 as Sim CPU/RAM stabilization.
5. Do not start Center UI until Phase 0 is handled or explicitly waived.

## Product definition

Center is the local-first operating surface for personal execution.

Center answers:

- What is happening?
- What changed?
- What matters?
- What is blocked?
- What evidence exists?
- What should happen next?
- What decision is needed?
- What did we learn?

Center is not a dashboard, chatbot, workflow editor, scheduler, or generic task manager.

## Ownership

```text
Sim owns app shell, workspace, auth context, existing integrations, workflow engine.
Center owns operating surface, ontology contracts, profile isolation, observations, loops, evidence, predictions, recommendations, actions, outcomes.
MS2Scheduler owns deterministic study planning, recovery, calibration, receipts.
Workflow owns automation graph editing/execution.
Hermes / Codex / workers own agent execution attempts and artifacts.
.ai-bridge owns project knowledge, governance, decisions, protocols, review packets.
```

## Dependency direction

Allowed:

- Producer -> Center contracts
- Center -> producer interfaces
- Center -> Sim shell
- Workflow -> Center only through producer interface
- MS2Scheduler -> Center only through adapter
- Workers -> Center through events/evidence/actions

Forbidden for Center route top-level imports:

- workflow editor stores
- block registry
- connector registry
- Monaco
- mermaid
- document parsers
- execution sandbox
- provider SDK registries

Heavy modules must lazy-load behind explicit user action.

## Non-negotiable gate

Phase 0 CPU/RAM stabilization is active. Center UI work is blocked until Phase 0 is handled or explicitly waived.
