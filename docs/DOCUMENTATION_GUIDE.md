# Repository Documentation Guide

## Purpose

This guide defines where project knowledge belongs in this repository.

Repository path: `docs/DOCUMENTATION_GUIDE.md`  
Owning project: Sim repository  
Owner: Sim maintainers  
Current status: Active documentation placement rule.

## Core Rule

Repository docs own stable truth about the system.

`.ai-bridge` owns truth about the evolution of the system.

Use this split:

```text
repository docs = what the system is, how it works, how to extend it, how to operate it
.ai-bridge = why decisions were made, what was approved or rejected, what evidence was captured, what is currently planned
```

## Project Documentation Goes With The Project

Use project-local docs for:

- Architecture.
- API.
- Interfaces.
- Contracts.
- Runtime schemas.
- Design rationale that remains true after implementation.
- Developer guide.
- Operator guide.
- Extension guide.
- Troubleshooting.
- Diagrams.
- Producer documentation.

Examples:

```text
apps/sim/docs/
apps/sim/docs/center/
docs/
packages/*/docs/
packages/*/README.md
```

## Governance Goes In `.ai-bridge`

Use `.ai-bridge` for:

- Current plan.
- Decisions.
- Review packets.
- Audits.
- Protocols.
- Ontology freeze records.
- Capability registry metadata.
- Session history and worker handoffs.
- Cross-project coordination.

Examples:

```text
.ai-bridge/current-plan.md
.ai-bridge/decisions.md
.ai-bridge/projects/center/decisions.md
.ai-bridge/projects/center/reviews/
.ai-bridge/projects/center/audits/
.ai-bridge/protocols/execution-authority.md
```

## Canonical Truth Rule

Every important topic should have one canonical explanatory document.

Other documents should link to that canonical document instead of restating it.

When duplicate truth exists:

1. Pick the owner and canonical path.
2. Merge useful content into the canonical document.
3. Replace stale copies with pointers.
4. Record a decision in `.ai-bridge` if project truth changed.

## Reference Style

Use explicit repository paths.

Good:

```text
apps/sim/docs/center/producer-model.md
.ai-bridge/projects/center/reviews/RP-20260629-004-pre-dogfood-overnight-hardening.md
```

Avoid:

```text
Vague references to the coordination folder.
References to prior conversations.
Unqualified references to docs.
```

## Required Content For Major Docs

Major documents should answer the following where relevant:

- What is this?
- Why does it exist?
- Which repository path owns it?
- Which project owns it?
- What is its current status?
- What code is canonical?
- What depends on it?
- What does it depend on?
- What are its assumptions and limitations?
- How should it be extended?
- What should be read next?

## Center Example

Canonical Center system docs:

```text
apps/sim/docs/center/README.md
apps/sim/docs/center/architecture.md
apps/sim/docs/center/ontology-and-local-spine.md
apps/sim/docs/center/producer-model.md
apps/sim/docs/center/capability-system.md
apps/sim/docs/center/operations-and-dogfood.md
```

Center governance/evolution docs:

```text
.ai-bridge/projects/center/roadmap.md
.ai-bridge/projects/center/decisions.md
.ai-bridge/projects/center/reviews/
.ai-bridge/projects/center/audits/
```

## Maintenance Checks

Before finishing documentation work:

- Check that explicit local paths exist.
- Check that stale `.ai-bridge` docs do not duplicate project docs.
- Check that docs do not reference chat history.
- Run `git diff --check`.
- Run targeted project checks if documentation claims runtime behavior.

## Related Documents

- `docs/REPOSITORY_MAP.md`
- `apps/sim/docs/center/README.md`
- `.ai-bridge/README.md`
- `.ai-bridge/protocols/execution-authority.md`
