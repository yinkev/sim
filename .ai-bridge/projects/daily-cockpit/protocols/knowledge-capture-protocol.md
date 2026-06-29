---
id: daily-cockpit-knowledge-capture-protocol
type: protocol
project: daily-cockpit
status: active
updated: 2026-06-28
links:
  - ai-bridge-index
  - daily-cockpit-dogfoodable-alpha-spec
  - governor-protocol
---

# Knowledge Capture Protocol

## Purpose

Important decisions must be captured automatically during the project workflow.

The project should not depend on manual reminders to preserve architectural, product, process, or design decisions.

## Trigger

A decision is capture-worthy if it changes any of:

- architecture
- product direction
- naming
- data model
- privacy model
- workflow/protocol
- implementation order
- design standard
- acceptance criteria
- what Pro/workers should do next

## Required behavior

When a capture-worthy decision is made:

1. State the decision in one sentence.
2. Write it to the relevant project `decisions.md` or protocol file.
3. Update `current-plan.md` if execution changes.
4. Update the project index, brief, or roadmap if the decision affects direction.
5. Add an `error-book.md` entry if the decision prevents a repeated mistake.
6. Report exactly what was updated.

Do not wait for a manual save request.

## Standard loop

```text
Research / discussion
  -> decision detected
  -> update .ai-bridge
  -> update active plan if needed
  -> Pro critique if architectural
  -> synthesize
  -> workers execute
  -> evidence captured
  -> update .ai-bridge from what was learned
```

## Naming and design decisions already accepted

- Working product name: `Center`.
- Prefer light theme by default.
- Prefer technical, editorial, information-dense design.
- Use standard industry terminology when it is genuinely standard.
- Keep terms like `North Star` if they are standard in context.
- Avoid invented branding and cute names.
- Avoid dark/cyberpunk/AI-slop aesthetics unless explicitly requested.

## Project invariant

If a decision is not in `.ai-bridge`, it is not finalized.

If implementation changes architecture but `.ai-bridge` is not updated, the implementation is incomplete.
