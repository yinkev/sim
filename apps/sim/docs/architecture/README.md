# Sim Product Architecture Specification

## Purpose

This directory defines the approved product and architecture target for Sim.

Repository path: `apps/sim/docs/architecture/`
Owning project: Sim
Owner: Sim maintainers
Current status: Approved target. Conformance is established per completed slice; code outside accepted
slice evidence is not assumed to conform.

## Delivery Model

Sim uses **architecture-led, spec-driven evolutionary development**.

- **Architecture-led:** the product model, bounded contexts, dependency rules, and performance budgets constrain implementation.
- **Spec-driven:** every migration slice begins with explicit scope, invariants, acceptance criteria, and removal criteria.
- **Evolutionary:** working behavior is preserved while vertical slices replace legacy paths. This is not a big-bang rewrite.

The migration pattern is a **strangler fig** approach inside a **modular monolith**, with hard frontend compile boundaries where runtime isolation requires them.

## Authority Order

When documents conflict, use this order:

1. `north-star.md`
2. `domain-model.md` and `glossary.md`
3. `architecture-invariants.md`
4. Accepted ADRs under `adr/`
5. `migration-roadmap.md`
6. The active slice specification

Current sequencing and blockers are recorded in `migration-roadmap.md`; slice-specific acceptance and
evidence live in the applicable slice specification. Conversation history is never authoritative.

## Reading Order

1. [North star](north-star.md)
2. [Domain model](domain-model.md)
3. [Architecture invariants](architecture-invariants.md)
4. [Migration roadmap](migration-roadmap.md)
5. [Glossary](glossary.md)
6. [Task as the primary work object](adr/0001-task-primary-work-object.md)
7. [Workflow Studio compile boundary](adr/0002-workflow-studio-compile-boundary.md)
8. [Minimal workspace shell](adr/0003-minimal-workspace-shell.md)
9. [Development performance probe](performance-probe.md)
10. [Phase 1 closeout](phase-1-closeout.md)

## Slice Specification Contract

Every implementation slice must state:

- User outcome and reference workflow.
- Current behavior and target behavior.
- In scope and explicitly out of scope.
- Affected domain objects and system-of-record changes.
- Applicable architecture invariants.
- API, persistence, and compatibility impact.
- Performance budget.
- Observable acceptance criteria.
- Legacy path removed or retirement condition.
- Rollback or containment strategy.

Tests and audits should be proportional to risk. The required verification is the smallest set that proves the user outcome, data safety, critical execution behavior, architecture boundaries, and performance budget.

## Change Control

- Product-model changes require updates to the north star or domain model plus an ADR.
- New cross-domain dependencies require an ADR and an invariant review.
- Sequencing changes belong in the migration roadmap or active plan.
- Generated implementation evidence belongs under `var/center/evidence/` or the owning issue/PR; canonical documents record accepted system truth.

## Relationship To Center

Center is the current personal operating surface and proving ground. This specification defines the final product architecture around it. Center may evolve into the command/control surface, but it must remain independent of the workflow editor runtime and other heavyweight feature graphs.
