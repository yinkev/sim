---
id: ai-bridge-index
type: index
status: active
updated: 2026-06-28
links:
  - current-plan
  - ai-bridge-readme
  - daily-cockpit-index
  - error-book
---

# AI Bridge Index

## Purpose

`.ai-bridge/` is the local coordination layer for ChatGPT, Pro, CodexPro, Codex, and local workers.

It stores executable plans, durable project context, decisions, open questions, protocols, evidence, logs, and archived work.

## Active execution

Read first:

```text
.ai-bridge/current-plan.md
```

Current active mission:

```text
Daily Cockpit / CPU-RAM stabilization first
```

## Active projects

```text
.ai-bridge/projects/daily-cockpit/
```

## Canonical structure

```text
.ai-bridge/
├── README.md
├── index.md
├── current-plan.md
├── decisions.md
├── open-questions.md
├── error-book.md
├── execution-log.jsonl
├── projects/
│   └── daily-cockpit/
│       ├── index.md
│       ├── brief.md
│       ├── roadmap.md
│       ├── decisions.md
│       ├── open-questions.md
│       ├── protocols/
│       ├── research/
│       ├── plans/
│       ├── artifacts/
│       └── archive/
└── archive/
```

## Rules

- `current-plan.md` is the only active executable plan.
- `projects/<project>/` is durable project memory.
- `decisions.md` stores durable commitments.
- `open-questions.md` stores unresolved blockers.
- `error-book.md` stores repeated mistakes and corrections.
- `execution-log.jsonl` is append-only evidence.

## Style

Use boring names. No branding, mythology, or cute project names.

Use markdown with frontmatter. Prefer stable IDs and explicit links.
