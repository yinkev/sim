---
id: ai-bridge-projects-readme
type: standard
status: active
updated: 2026-06-28
links:
  - ai-bridge-projects-index
  - ai-bridge-index
---

# Project Folder Standard

## Purpose

Project folders are not note dumps.

They are modular knowledge packages for agents, Pro, ChatGPT, and workers.

Each project folder must separate:

- durable context
- decisions
- protocols
- research
- plans
- reviews
- interfaces
- artifacts
- archive

## Standard project structure

```text
projects/<project>/
├── index.md              # project entrypoint
├── brief.md              # durable context packet
├── roadmap.md            # phased direction
├── decisions.md          # project-specific decision log
├── open-questions.md     # blockers and unresolved choices
├── interfaces.md         # contracts exposed to other projects/modules
├── protocols/            # process rules for this project
├── research/             # investigation notes and evidence
├── plans/                # inactive/future plans
├── reviews/              # review packets and Pro/ChatGPT rounds
├── artifacts/            # outputs, patches, screenshots, exports
└── archive/              # superseded material
```

## Modularity rule

A project must expose what other projects may depend on through `interfaces.md`.

Other projects should not depend on random internal notes.

Example:

```text
ms2scheduler-integration/interfaces.md
  -> emits observations
  -> emits recovery proposals
  -> emits evidence receipts
```

Center may depend on those interfaces.

Center should not depend on MS2Scheduler's internal implementation details unless explicitly approved.

## Best-practice rules

1. **One project, one concern.**
   Do not mix performance work, product vision, scheduler integration, and review workflow in one folder.

2. **Stable entrypoint.**
   Every project needs `index.md`.

3. **Decisions are promoted.**
   Accepted decisions go in `decisions.md`, not buried in chat summaries.

4. **Open questions are explicit.**
   If a choice blocks implementation, put it in `open-questions.md` with a default.

5. **Interfaces beat prose.**
   If another module must use it, define a contract.

6. **Research is not execution.**
   Research informs plans; it is not a worker instruction.

7. **Reviews are versioned.**
   Cross-model review uses `reviews/RP-...-vN.md` packets.

8. **Current execution lives at root.**
   `.ai-bridge/current-plan.md` is still the only active executable plan.

9. **Archive instead of deleting important context.**
   Superseded docs move to `archive/` unless they are pure duplicates.

10. **No cute naming.**
    Use standard names unless an industry term is genuinely standard.

## Current project split

```text
center/                    # product surface and operating graph
cpu-ram-stabilization/     # performance/dev usability blocker
ms2scheduler-integration/  # scheduler as first mature producer/module
pro-review-workflow/       # review packets + governor process
daily-cockpit/             # legacy staging folder until migration is complete
```

## Migration rule

`daily-cockpit/` remains readable source material, but new durable docs should go into the more specific project folders above.
