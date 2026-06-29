---
id: daily-cockpit-review-packet-protocol
type: protocol
project: daily-cockpit
status: active
updated: 2026-06-28
links:
  - daily-cockpit-governor-protocol
  - daily-cockpit-knowledge-capture-protocol
---

# Review Packet Protocol

## Purpose

Use versioned review packets to coordinate ChatGPT, Pro, and Kevin without relying on fragile free-form chat relay.

A review packet is the artifact passed between governors before implementation begins.

## Core rule

Do not stop after two turns by default.

Stop when the packet converges, reaches a hard review limit, or Kevin decides.

## Default limits

- Default target: 8 rounds or fewer.
- Soft limit: 12 rounds.
- Hard limit: 20 rounds.

At round 20 the packet must become one of:

- `approved`
- `rejected`
- `deadlocked`
- `superseded`

No indefinite debate.

## Status values

```text
draft
needs-review
under-review
converging
converged
approved
rejected
deadlocked
superseded
implemented
```

## Convergence criteria

A packet is converged when:

1. No fatal flaws remain unresolved.
2. Remaining disagreements are explicitly recorded.
3. Both governors either approve or accept the remaining tradeoff.
4. Acceptance criteria and stop conditions are clear enough for workers.
5. Kevin has enough information to approve, reject, or choose between remaining options.

## Deadlock criteria

A packet is deadlocked when:

1. Governors disagree on a material decision.
2. The disagreement persists after multiple rounds.
3. More review is unlikely to produce new information without external evidence, prototype, benchmark, or Kevin decision.

Deadlock output must include:

- unresolved disagreements
- each governor's position
- evidence needed to resolve
- recommended default
- confidence

## Versioning

Use stable IDs and explicit versions:

```text
RP-YYYYMMDD-001-v1.md
RP-YYYYMMDD-001-v2.md
RP-YYYYMMDD-001-v3.md
```

Never overwrite a prior review packet version.

Use a `latest.md` pointer only if helpful.

## Folder

Project review packets live here:

```text
.ai-bridge/projects/<project>/reviews/
```

## Required packet fields

Every packet must include:

- id
- version
- project
- status
- round
- max_rounds
- created
- updated
- topic
- objective
- decision stage
- context files
- assumptions
- constraints
- proposal
- alternatives considered
- open questions
- acceptance criteria
- Governor A position
- Governor B request
- Governor B response area
- convergence checklist

## Relay behavior

When Kevin manually relays to Pro:

1. ChatGPT writes a timestamped review packet.
2. Kevin sends the packet or file contents to Pro.
3. Pro responds using the same packet ID and version lineage.
4. Kevin relays Pro's response back to ChatGPT.
5. ChatGPT writes the next packet version or merged decision.

## Worker gate

Workers may execute only an approved packet or a `current-plan.md` that references an approved/converged packet.

If there is no approved/converged packet for architectural work, implementation is premature.
