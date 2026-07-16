# ADR 0001: Task Is The Primary Work Object

- Status: Accepted
- Date: 2026-07-16
- Decision owners: Sim maintainers

## Context

The current product exposes chat, workflow, execution, file, table, resource, and operating-surface concepts as competing centers of gravity. None except a durable outcome-oriented object spans intent, planning, artifact creation, execution, result, and resumption.

## Decision

Adopt **Task** as the primary durable user-facing work object.

A task owns objective, definition of done, coordination status, conversation linkage, resource references, decisions, and links to artifacts and executions. Conversation remains an interaction stream; workflow remains an artifact; execution remains an operational attempt.

Task is not a generic to-do item and does not absorb artifact contents or execution internals.

Acceptance of this ADR approves the target model only. The migration roadmap controls sequencing; this
decision does not claim that Task, Artifact Version, or Execution-domain persistence exists yet.

## Consequences

- New intent-to-result journeys are task-scoped.
- Existing chats require compatibility mapping during migration.
- Task restoration cannot depend on transcript replay alone.
- Artifacts and executions retain independent identity and systems of record.
- Navigation, search, activity, and AI context assembly can use stable task identity.

## Alternatives Considered

- **Chat-centric:** simple initially, but conversation becomes an unreliable database for durable state.
- **Workflow-centric:** excludes non-workflow work and confuses artifact with objective.
- **Execution-centric:** represents attempts, not the broader intended outcome.
- **Project-centric:** too broad for the primary daily unit of action.

## Revisit When

Revisit only if sustained user evidence shows that another stable object better spans the complete intent-to-result lifecycle without conflating artifacts or executions.

## Related

- `apps/sim/docs/architecture/north-star.md`
- `apps/sim/docs/architecture/domain-model.md`
- `apps/sim/docs/architecture/migration-roadmap.md`
- `INV-DOM-001` through `INV-DOM-006`
