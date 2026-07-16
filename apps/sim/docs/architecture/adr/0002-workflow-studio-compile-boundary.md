# ADR 0002: Workflow Studio Is A Separate Compile Domain

- Status: Accepted
- Date: 2026-07-16
- Decision owners: Sim maintainers

## Context

The workflow editor includes ReactFlow, executable block definitions, editor stores, validation, execution visualization, terminal state, collaboration, and deployment controls. Static reachability from shared workspace routes causes unrelated pages to inherit editor-scale compilation and native memory cost.

Dynamic imports inside one broad graph are useful but do not provide a sufficiently hard architectural boundary.

## Decision

Establish **Workflow Studio** as a separate frontend compile domain within the monorepo.

The main web application and Workflow Studio may share authentication, API contracts, domain packages, design tokens, generated metadata, and event schemas. Main web routes must not eagerly import Studio runtime, executable block registries, editor stores, or execution visualization code.

This decision does not require separate backend services, repositories, origins, or independent product teams.

Retain the proven Workflow Studio product and its editing, collaboration, presence, execution, and
cancellation behavior, URLs, contracts, and durable data while replacing the dependency architecture
underneath it. Delivery uses an evolutionary strangler migration inside the modular monolith: main web
becomes a thin bounded shell, and Studio owns its runtime and compile graph behind enforced route
boundaries.

## Consequences

- Main web compilation becomes independent of workflow block and editor growth.
- Workflow metadata must be available through pure generated manifests or narrow contracts.
- Navigation into Studio crosses an explicit application entry boundary.
- Shared packages must remain application-neutral and cannot import Studio code.
- Studio can retain specialized state and performance characteristics without contaminating the control plane.

## Alternatives Considered

- **Keep the broad frontend dependency graph unchanged:** preserves local convenience but leaves main
  web cost coupled to workflow, integration, and editor growth; controlled route and memory evidence
  showed that this missed the approved budgets.
- **Single application with dynamic imports only:** insufficient protection against accidental static reachability and broad shared barrels.
- **Full microfrontend platform:** unnecessary organizational and runtime complexity.
- **Greenfield editor rewrite:** discards proven editor and execution behavior without solving dependency governance by itself.
- **Premature backend or service extraction:** does not address the measured frontend and development
  route-compilation graph, while adding deployment and operational boundaries without an observed need.

## Revisit When

Revisit only if build tooling provides enforceable equivalent isolation and measured route graphs prove that editor growth has no effect on main web compilation or memory.

## Related

- `apps/sim/docs/architecture/north-star.md`
- `INV-DEP-002`, `INV-DEP-003`, `INV-PERF-002`, `INV-PERF-003`
