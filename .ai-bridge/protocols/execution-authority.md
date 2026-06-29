---
id: execution-authority-v1
type: protocol
status: frozen
updated: 2026-06-28
links:
  - ai-bridge-global-decisions
  - current-plan
---

# Execution Authority v1

## Authority model

Codex is the sole orchestrator.

Workers, integrations, schedulers, workflows, and models are producers. They may inspect, emit events, produce evidence, propose actions, or execute bounded tasks. They do not own architecture, sequencing, acceptance, or project truth.

## Authority levels

| Level | Meaning | Examples |
| --- | --- | --- |
| A0 | Automatic, no report | formatting generated scratch output, reading local docs |
| A1 | Automatic, report | adding docs, running targeted checks, project-local cleanup for current task |
| A2 | Propose/review first | changing interfaces, adding schemas, adding dev commands |
| A3 | Kevin approval required | renaming product concepts, changing architecture direction, modifying approval policy |
| A4 | Forbidden unless explicitly unlocked | telemetry, credential mutation, destructive system-level changes, identity-level changes |

## Truth impact

| Level | Meaning | Examples |
| --- | --- | --- |
| T0 | Cosmetic | typo, formatting |
| T1 | Organizational | moving docs, indexing evidence |
| T2 | Interpretive | observations, summaries, local classification |
| T3 | Doctrinal | ontology, product meaning, interface contracts |
| T4 | Irreversible or identity-level | telemetry, profile deletion semantics, auth/identity policy |

Safe autonomy requires both authority and truth impact to be safe.

## Default gates

- A0/T0 and A1/T1 may proceed autonomously with evidence.
- A2/T2 or A2/T3 may proceed only when the user has already approved the relevant governing spec.
- A3 requires explicit Kevin approval unless the exact change is already approved in a frozen decision.
- A4 is blocked unless explicitly unlocked in the current turn.

## Capability execution gate

Before executing a capability, verify:

1. Capability is registered and connected.
2. Profile scope is known.
3. Policy permits the operation.
4. Authority level is allowed.
5. Truth impact is acceptable.
6. Evidence requirement is satisfied.

Discovery alone never grants execution authority.

## Definition of done

Architecture Done:
reviewed, documented, decision logged, interfaces updated, risks recorded, implementation boundary clear.

Implementation Done:
files changed, diff reviewed, targeted checks run, evidence captured, rollback known.

Feature Done:
implemented, usable, tested, dogfood path exists, no critical/high defects.

Operationally Done:
dogfooded, measured, stable, trusted, failure modes known.

## Stopping rule

Stop reasoning when the next uncertainty requires implementation evidence.

Continue reasoning only if:

- core primitives are unstable
- interfaces are ambiguous
- privacy/provenance is unclear
- two implementers would diverge
- implementation would bake in a dangerous assumption

## Review loop

Self-review:

```text
counter = 0
evaluate
review
grade
iterate
counter += 1
stop at 10 or convergence
```

Cross-governor:

```text
default 8 rounds
soft limit 12
hard limit 20
then approve / reject / deadlock / supersede
```
