# Local dev playground

## Quick start

1. Migrate: `cd packages/db && bun run db:migrate`
2. Seed: `bun run db:seed:demo` (sign up once first)
3. Run: `bun run dev:full` — UI http://localhost:6888, realtime :6887

## Env alignment (sim + realtime)

- NEXT_PUBLIC_APP_URL and BETTER_AUTH_URL: http://localhost:6888
- Same BETTER_AUTH_SECRET, INTERNAL_API_SECRET, DATABASE_URL in both apps

## Connectors

OAuth keys: see apps/sim/lib/core/config/env.ts. Demo workflows use API/Agent/Function without OAuth.

## Animations

Editor uses React Flow + CSS. macOS Reduce motion disables transitions globally.

## Smoke test

Demo Playground workspace, open 3 workflows, drag blocks, optional second browser for cursors.
