# @sim/mothership-contracts

Owned source contracts for the Sim Mothership/Copilot wire surface.

The JSON files under `contracts/` are the source of truth for generated Sim consumers in `apps/sim/lib/copilot/generated/`. Generator scripts in `scripts/` read this package by default and may accept explicit override paths for compatibility research only.

The `src/routes/` exports package-local Zod route contracts for the owned runtime, admin, and callback surfaces. `src/auth.ts` owns shared service-header names and secret-topology validation. These contracts intentionally do not import `apps/sim` helpers, so both `apps/sim` and `apps/mothership` can consume them across the app boundary.

The `fixtures/streams/` files are minimal SSE golden fixtures validated against the generated stream JSON Schema and the current Sim stream parser with `bun run mship-fixtures:check`. The checker validates stream legs: `complete`, `error`, and `run.checkpoint_pause` are terminal for one leg, and `run.resumed` starts the next leg after a checkpoint pause. The sibling `fixtures/streams-invalid/` fixtures are intentional negative cases that must be rejected by that checker. Broader stream compatibility fixtures belong in the later stream-writer workstream.
