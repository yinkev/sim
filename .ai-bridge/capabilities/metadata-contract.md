---
id: capability-metadata-contract-v1
type: contract
status: frozen
updated: 2026-06-28
links:
  - capability.schema.json
  - execution-authority-v1
  - center-ontology-freeze-v1
---

# Capability Metadata Contract v1

## Definition

A capability is a typed, versioned contract describing something a producer can do.

Capabilities prevent bespoke integrations by making producer abilities discoverable, reviewable, and governable.

## Type shape

```ts
type Capability = {
  id: string
  version: string
  producerId: string
  kind: 'emit' | 'read' | 'write' | 'run' | 'predict' | 'summarize' | 'review'
  inputs: SchemaRef[]
  outputs: SchemaRef[]
  authorityRequired: 'A0' | 'A1' | 'A2' | 'A3' | 'A4'
  truthImpact: 'T0' | 'T1' | 'T2' | 'T3' | 'T4'
  policyRequirements: string[]
  evidenceProduced: string[]
  failureModes: string[]
  requires?: string[]
  lifecycle: 'draft' | 'registered' | 'available' | 'connected' | 'disabled' | 'deprecated' | 'removed'
}
```

## Lifecycle

```text
draft -> registered -> available -> connected -> disabled -> deprecated -> removed
```

`removed` is terminal. Historical evidence should keep the capability id/version for provenance.

## Dependency model

Capabilities may depend on other capabilities, but every dependency must be declared.

Examples:

```text
emit.ms2.study_activity
  requires read.ms2.activity_log

predict.loop_drift
  requires emit.observation
  requires feature.loop_history
```

## Permission gate

Capability execution is gated by:

- authority level
- truth impact
- policy
- profile scope
- evidence requirement

Discovery is read-only until explicitly connected.

## Discovery sources

Center may discover capability metadata from:

- `.ai-bridge/capabilities/`
- `.agents/`
- `.hermes/`
- `.codex/`
- `.claude/`
- Sim integrations
- manual registry

Do not execute capability code merely because it is discovered.

## Initial capability examples

```text
emit.ms2.study_activity
emit.ms2.recovery_proposal
read.ms2.activity_log
emit.github_commit
emit.github_pr_review
write.plane_issue
run.worker_task
predict.loop_drift
summarize.evidence
review.action_proposal
```
