# Repository Documentation Guide

## Purpose

This guide defines where durable project knowledge belongs.

Repository path: `docs/DOCUMENTATION_GUIDE.md`  
Owning project: Sim repository  
Owner: Sim maintainers  
Current status: Active documentation placement rule.

## Core Rule

The repository owns all durable system and project truth. Do not create a separate hidden coordination or governance documentation tree.

Use these canonical locations:

```text
apps/sim/docs/architecture/  product model, target architecture, invariants, roadmap, ADRs
apps/sim/docs/<feature>/      stable feature architecture, operation, and extension docs
docs/                         repository-wide orientation and cross-project notes
packages/*/README.md          package contracts and usage
```

## Decision Records

Consequential product and architecture decisions belong in Architecture Decision Records:

```text
apps/sim/docs/architecture/adr/
```

An ADR should state the context, decision, alternatives, consequences, and revisit conditions. Update the north star, domain model, glossary, or invariants when the accepted decision changes canonical system truth.

## Active Work

The architecture migration sequence and current blockers live in:

```text
apps/sim/docs/architecture/migration-roadmap.md
```

A substantial implementation slice should have a bounded slice specification linked from the roadmap or owning issue/PR. Temporary command output, logs, and generated evidence are not canonical documentation.

## Generated Local State

Mutable local runtime data and generated evidence belong under:

```text
var/center/
```

`var/` is ignored by Git. Do not store specifications, decisions, source configuration, or required fixtures there.

## Canonical Truth Rule

Every important topic has one canonical explanatory document. Other documents link to it instead of restating it.

When duplicate truth exists:

1. Select the canonical owner and path.
2. Merge still-valid content into that document.
3. Remove or replace stale copies with links.
4. Add or supersede an ADR when the underlying decision changed.

## Required Content For Major Docs

Major documents should answer, where relevant:

- What is this and why does it exist?
- Which path and project own it?
- What is its current status?
- What code is canonical?
- What depends on it and what does it depend on?
- What assumptions, invariants, and limitations apply?
- How should it be operated or extended?
- What should be read next?

## Maintenance Checks

Before finishing documentation work:

- Confirm referenced repository paths exist.
- Confirm the document does not rely on conversation history.
- Confirm one canonical source remains for each claim.
- Run `git diff --check`.
- Run targeted project checks only when documentation asserts changed runtime behavior.

## Related Documents

- `docs/README.md`
- `docs/REPOSITORY_MAP.md`
- `apps/sim/docs/architecture/README.md`
- `apps/sim/docs/center/README.md`
