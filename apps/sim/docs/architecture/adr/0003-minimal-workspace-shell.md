# ADR 0003: Keep The Workspace Shell Minimal

- Status: Accepted
- Date: 2026-07-16
- Decision owners: Sim maintainers

## Context

A persistent workspace layout is valuable for identity, navigation, visual continuity, and route composition. It becomes a performance and ownership failure when it also initializes provider models, settings, resource families, search indexes, workflow registries, hidden dialogs, and route-specific stores.

A global provider that performs feature-specific I/O is a feature loader, not infrastructure.

## Decision

Limit the persistent workspace shell to:

- Session and workspace identity.
- Theme and branding.
- Minimal authorization or policy snapshot.
- Navigation frame and bounded recent lists.
- Notifications and route outlet.

Feature data, stores, providers, search indexes, management tools, and dialogs are route-scoped or interaction-loaded.

## Consequences

- The sidebar becomes a bounded navigation core rather than an application controller.
- Provider-model discovery and settings loading move to consuming routes.
- Universal search loads its metadata index when invoked.
- Closed features do not contribute to initial compile or runtime cost.
- Route ownership becomes explicit and easier to measure.

## Alternatives Considered

- **Eager cache warming:** improves selected later interactions at the cost of every workspace entry and creates hidden coupling.
- **One global application provider tree:** locally convenient but makes route cost scale with total product scope.
- **No persistent shell:** loses useful continuity and duplicates genuine infrastructure.

## Revisit When

Revisit individual loaders only when measured frequency and latency prove that eager placement improves the reference workflow without violating shell and performance budgets.

## Related

- `apps/sim/docs/architecture/architecture-invariants.md`
- `INV-DEP-001`, `INV-DEP-004`, `INV-DEP-005`, `INV-PERF-004`
