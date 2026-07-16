# Architecture Glossary

## Purpose

This glossary defines canonical terms for product, architecture, and migration work.

Repository path: `apps/sim/docs/architecture/glossary.md`
Owning project: Sim
Owner: Sim maintainers
Current status: Active terminology contract.

| Term | Canonical meaning |
| --- | --- |
| **Task** | Durable unit of intended user outcome. Owns coordination state and links conversation, resources, artifacts, decisions, and executions. |
| **Conversation** | Ordered interaction stream attached to a task. “Chat” is an acceptable UI label, not the durable work object. |
| **Artifact** | Durable typed asset created or modified through work, such as a workflow, file, table, knowledge base, schedule, or deployment. |
| **Draft** | Mutable proposed artifact state that has not replaced the committed version. |
| **Committed version** | Canonical immutable artifact revision or equivalent saved snapshot. |
| **Change set** | Structured description of proposed or committed artifact changes, including provenance. |
| **Resource reference** | Typed link to an artifact, execution, attachment, external record, or preview. A resource reference does not own the target. |
| **Execution** | Durable attempt to perform work against explicit inputs, policy, and an artifact version or authorized draft. “Run” may be used as a concise UI verb. |
| **Execution step** | Identified unit inside an execution, enabling progress, error attribution, and scoped retry. |
| **Activity event** | Append-only user-facing record of a material transition used for explanation and resumption. |
| **Provenance** | Traceable origin of a claim, change, artifact, decision, or result. |
| **Capability** | Typed description of an available action and its policy requirements. Metadata alone grants no execution authority. |
| **Autonomy policy** | Rule set classifying actions as immediate, execute-and-report, or checkpoint-required. |
| **Command Center** | Functional role of the daily control surface for starting, resuming, monitoring, and searching work. Center is the current product surface evolving toward this role. |
| **Task Workspace** | Primary surface for one task’s objective, conversation, artifacts, resources, progress, and commands. |
| **Artifact Studio** | Dedicated editing environment for a durable artifact type. |
| **Workflow Studio** | Artifact Studio for workflow editing, validation, debugging, and execution visualization; also a hard frontend compile domain. |
| **Operations Center** | Unified surface for execution status, history, cancellation, retry, schedules, results, and cost. |
| **Control plane** | Minimal persistent workspace layer providing identity, navigation, lightweight policy, notifications, and route composition. |
| **Bounded context** | Domain boundary with explicit ownership, model, and integration contracts. |
| **System of record** | Authoritative persistence owner for a class of state. |
| **Compile domain** | Frontend entry/build boundary whose dependency graph is isolated from other product surfaces. |
| **Architecture invariant** | Rule that must remain true across implementations; bounded exceptions require an accepted ADR under the invariant policy. |
| **Architecture fitness function** | Automated or measurable check proving an architecture characteristic continues to hold. |
| **ADR** | Architecture Decision Record documenting a consequential decision, alternatives, consequences, and revisit conditions. |
| **Vertical slice** | End-to-end increment delivering a user outcome across UI, domain, persistence, and runtime boundaries. |
| **Strangler fig migration** | Incremental replacement strategy in which new paths absorb behavior and retired legacy paths are removed. |

## Terminology Rules

- Use **Task** when referring to durable work; do not use chat as a synonym.
- Use **Execution** in architecture and contracts; use “run” primarily as a user-facing verb.
- Use **Resource Reference** for links and context; do not call every domain object a resource.
- Use **Center** for the current named operating surface and **Command Center** for its target architectural role.
- Treat `home`, `Mothership`, and `Copilot` as current route or implementation names, not canonical domain objects.
- A protocol or legacy name containing “task,” including A2A task, inbox task, or scheduled task, is not the canonical Task unless it satisfies the Task aggregate and ownership rules.
- Do not introduce new synonyms without updating this glossary and the affected ADR or domain document.
