# Upstream v0.7.14 Home Cold-Compile Investigation

## Decision

The focused fix is accepted.

The upstream integration introduced one obvious Home route-graph expansion: the new Home error boundary
imported the broad workspace-component barrel. That barrel made `skill-tile` and the monolithic icon
module reachable while compiling Home. Replacing the barrel import with the existing focused error
component entry reduced the error-boundary closure from `415` to `130` local modules and reduced the
authoritative cold Home TTFB from `22313.539 ms` to `12033.201 ms`.

`12033.201 ms` is in the supplied `10–15s` acceptable band. The pre-Phase 2 upstream integration is
therefore accepted without a personal-use waiver. The historical probe still reports a failure against
its older `5000 ms` cold limit; that stricter target remains useful future headroom, but it is not a
blocker under this investigation's explicit acceptance rubric.

Phase 2 remains pending and was not started.

## Scope And Repository Identity

The bounded investigation ran on 2026-07-16 in
`/Users/kyin/Projects/sim-upstream-v0.7.14-integration` on
`codex/upstream-v0.7.14-integration`.

The exact commit inspected before the focused fix was the completed integration merge
`67de437de46c311f1d63c58a4763d2f7f73f285c`, with parents:

- local integration parent `5a5df1fc111996a31517748a99f1645a51352f83`;
- exact upstream `v0.7.14` parent `11168f915b044445d464345b3df7492764c59a07`.

The preserved Phase 1 checkpoint branch still resolved to
`734f3b787ad27eae684f8226c16599f21b0416f4`. At investigation start, `main` was
`f034c2138996cdb1ef107d5a93ba38de30780721`, was an ancestor of the integration branch, and
`git rev-list --left-right --count main...HEAD` returned `0 103`.

## Evidence Reused

The investigation reused the completed integration postflight and did not repeat its targeted tests,
architecture/API/React Query checks, production build, Studio probe, or full browser journey. After the
one-line import fix, only the affected boundary check, one typecheck, and one authoritative Main
measurement were run. The relevant performance evidence was:

- Phase 1 Main baseline:
  `/Users/kyin/Projects/sim/var/center/evidence/architecture/performance/20260716-main-home-authoritative.json`,
  its `.browser.json`, and its `.server.log`;
- upstream integration before the fix:
  `var/center/evidence/architecture/performance/20260716-upstream-v0714-main.json`, its
  `.browser.json`, and its `.server.log`;
- the single post-fix authoritative measurement:
  `var/center/evidence/architecture/performance/20260716-upstream-v0714-main-home-boundary-fix.json`,
  its `.browser.json`, `.server.log`, and `.png` screenshot.

| Metric | Phase 1 baseline | Integrated before fix | Integrated after fix | Supplied acceptance |
| --- | ---: | ---: | ---: | --- |
| Listener ready | `590.717 ms` | `1523.309 ms` | `1256.638 ms` | preferred `<5s`, ceiling `10s` |
| Next ready log | `203 ms` | `760 ms` | `641 ms` | supporting evidence |
| First Home TTFB | `4771.583 ms` | `22313.539 ms` | `12033.201 ms` | `10–15s` acceptable; `25s` ceiling |
| First request `next.js` time | `4.1s` | `17.8s` | `9.4s` | supporting decomposition |
| First request proxy time | `73 ms` | `362 ms` | `178 ms` | supporting decomposition |
| First request application time | `147 ms` | `1614 ms` | `249 ms` | supporting decomposition |
| Warm Home median TTFB | `33.465 ms` | `121.403 ms` | `76.929 ms` | preferred `<500 ms` |
| Input readiness upper bound | `3 ms` | `472 ms` | `579.7 ms` | preferred `<1s` |
| Warm navigation upper bound | `58.6 ms` | `196 ms` | `83.9 ms` | preferred `<500 ms` |
| Peak listener-tree RSS | `1604796416 B` | `2047098880 B` | `1867759616 B` | existing `4 GiB` Main ceiling |
| Idle peak listener-tree RSS | `1479835648 B` | `1899462656 B` | `1836810240 B` | existing `4 GiB` Main ceiling |
| Idle CPU | `0%` | `0.068%` | `0%` | existing `1%` ceiling |

The cold regression was compile-dominated: the server's `next.js` component accounted for about
`13.7s` of the approximately `17.5s` baseline-to-integration increase. Warm responses, interaction,
navigation, memory, and idle CPU remained healthy. No authoritative controlled-edit HMR measurement was
already available, so incidental Fast Refresh console timings were not promoted to evidence.

## Compile Graph And Configuration Findings

The Home success-page implementation and `home.tsx` were byte-identical between the Phase 1 reference
and the integration merge. A success-route closure walk after the fix found `244` local modules at the
reference and `245` at the integration, with no forbidden workflow registry reachable. This rejected a
broad expansion of the ordinary Home page, root layout, or workspace layout as the primary cause.

The new special route was different:

```text
app/workspace/[workspaceId]/home/error.tsx
  -> app/workspace/[workspaceId]/components/index.ts
  -> app/workspace/[workspaceId]/components/skill-tile/index.ts
  -> app/workspace/[workspaceId]/components/skill-tile/skill-tile.tsx
  -> components/icons.tsx
```

Before the fix, `home/error.tsx` reached `415` local modules. The same boundary walk after the direct
import reached `130`, a reduction of `285`. A combined Home-boundary comparison moved from `419` local
modules at the Phase 1 reference to `599` before the fix and `428` after it. This graph change was both
large enough to explain the compile work and specific to a file added by the upstream merge.

The compiler/configuration review found no independent obvious cause:

- Next remained `16.2.6`; the SWC platform package and React versions were unchanged.
- The development command and Turbopack configuration were unchanged.
- The relevant Next config changes externalized `@earendil-works/pi-coding-agent` and removed deleted
  `better-auth-harmony` transpilation; both reduce rather than expand compile work.
- App/component source-file scan growth was about `5%`, not commensurate with the `4.7x` cold increase.
- Dependency-lock growth alone was not accepted as a cause because packages matter only when reachable,
  and the route closure isolated a concrete reachable expansion.
- PII and hosted services were absent from the compile path. `PII_URL` was not configured, and there was
  no external-service wait in the server timing decomposition.

One external dependency review independently confirmed that the compiler toolchain did not change. One
other worker report searched a nonexistent `src` layout and claimed the baseline commit was unavailable;
that output was invalid and was discarded rather than retried.

## Hypotheses And Decisions

| Hypothesis | Decision | Evidence |
| --- | --- | --- |
| The new Home error boundary eagerly imported a broad barrel. | Accepted. | `415`-module closure, path to `skill-tile` and `icons.tsx`, red boundary check, and `285`-module reduction after the direct import. |
| The normal Home page or workspace layout broadly regained workflow runtime. | Rejected. | Home files were unchanged; post-fix success-route closure was `245` versus `244`; forbidden registries remained unreachable. |
| A Next, SWC, React, Turbopack, or dev-command change caused the regression. | Rejected. | Versions and relevant configuration were unchanged. |
| General dependency or Tailwind scan growth was the primary cause. | Rejected as the actionable cause. | Growth was modest, the compiler was unchanged, and a route-specific eager closure was found and fixed. |
| PII or a newly required external service delayed startup or Home. | Rejected. | PII remained unconfigured/disabled, no service was required, and the regression was dominated by `next.js` compile time. |
| Warm runtime behavior, not compilation, was unhealthy. | Rejected. | Post-fix warm Home was `76.929 ms`, input readiness `579.7 ms`, navigation `83.9 ms`, and idle CPU `0%`. |

## Focused Fix And Files Changed

Only one runtime import was changed:

1. `apps/sim/app/workspace/[workspaceId]/home/error.tsx` now imports `ErrorState` and
   `ErrorBoundaryProps` from `components/error` instead of the broad `components` barrel.
2. `scripts/check-home-import-boundary.ts` now treats `home/error.tsx` as an enforced Main entrypoint so
   this special-route regression cannot silently return.
3. This document records the decision and evidence trail.
4. `README.md` links this accepted investigation from the architecture reading order.
5. `migration-roadmap.md` records that the integration performance blocker is resolved while Phase 2
   remains pending.
6. `upstream-v0.7.14-integration-checkpoint.md` replaces the obsolete `22.313s` blocker with the accepted
   `12.033s` result and links here.

No dependency, configuration, API, persistence, database, URL, provider, loader, execution, PII, or
external-service behavior changed.

## Commands And Exact Results

The material investigation and verification commands were:

```text
bun run check:home-boundary
```

Before the fix: exit `1`; `home/error.tsx: 415 local modules`; the check printed the path through the
workspace component barrel and `skill-tile` to forbidden `components/icons.tsx`.

After the fix: exit `0`; `home/error.tsx: 130 local modules`; existing entry results were
`home-runtime.tsx: 373`, `chat/new/new-chat-runtime.tsx: 494`,
`user-input/new-user-input-runtime.tsx: 302`, and `mothership/chat/mothership-chat-runtime.tsx: 506`;
forbidden workflow registries remained unreachable.

```text
bun --env-file=/Users/kyin/Projects/sim/apps/sim/.env run probe:dev-performance \
  --surface=main \
  --route=/workspace/e16205a1-7107-4ab0-9eb1-dfb46028bc14/home \
  --output=var/center/evidence/architecture/performance/20260716-upstream-v0714-main-home-boundary-fix.json \
  --browser-evidence=var/center/evidence/architecture/performance/20260716-upstream-v0714-main-home-boundary-fix.browser.json
```

One run only, run ID `862CRemSqu9Ljz0UjFnIQ`: HTTP `200`; listener ready `1256.638 ms`; cold TTFB
`12033.201 ms`; warm median TTFB `76.929 ms`; peak RSS `1867759616 B`; idle peak RSS
`1836810240 B`; idle CPU `0%`. The Home input accepted the exact text
`home boundary fix verification`, and warm Home-to-chat navigation measured `83.9 ms`.

The probe JSON has overall status `fail` because the script still encodes the historical `5000 ms`
cold limit and a `500 ms` browser-evidence attachment threshold. Its separate browser JSON is `pass`:
input readiness `579.7 ms`, interaction pass, navigation `83.9 ms`. Under the rubric governing this
investigation, the cold result is acceptable and both browser timings meet their preferred targets. The
probe thresholds were not changed because that would be a second, unrelated policy change.

```text
bun --cwd apps/sim type-check
git diff --check
```

Both exited `0`. The integration's existing authoritative postflight remained valid and was not rerun.

## Preserved Decisions, Risks, And Tradeoffs

The fix preserves the thin Main control plane, the hard Workflow Studio compile boundary, route-scoped
loaders and providers, metadata/runtime separation, durable data and URLs, and current Home, chat,
Studio, execution, and local-service behavior. It does not restore the Python PII fallback. All PII
validation and masking infrastructure remains disabled and optional, with no startup, build, Home,
chat, Studio, or execution dependency.

The remaining tradeoff is that `12.033s` is slower than both the `4.772s` Phase 1 reference and the
preferred `<10s` target. It is nevertheless inside the explicit acceptable band, while warm and runtime
behavior remain healthy. Further dependency dieting or compiler profiling was rejected because the
bounded investigation found and fixed the obvious architecture regression; continuing would be a broad
performance refactor outside this task.

## Final State

- Regression fixed: yes, from `22313.539 ms` to `12033.201 ms` (`10280.338 ms`, about `46.1%`).
- Recommendation: **fix accepted and new cold time `12.033s`**.
- Personal-use waiver: not required.
- Pre-Phase 2 integration acceptance: accepted for merge to `main`.
- Phase 2 acceptance: pending; Phase 2 was not started.
- Phase 1 checkpoint: unchanged at `734f3b787ad27eae684f8226c16599f21b0416f4`.
- Stashes: untouched. At closeout they remained
  `1979db89621c9557777a17ac466ab76495a08c93`,
  `71fcf4634ac0a30bbc11a931ac6d0db2c6177ebd`, and
  `3c9df4d2e55413f993139e379215e37f462b1518`.
- Pushes: none.
