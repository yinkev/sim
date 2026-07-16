# Development Performance Probe

## Purpose

This probe captures repeatable current-tree evidence for Phase 0 and Phase 1A without adding a browser
test dependency. It measures cold and warm HTTP timing plus the recursive macOS listener-process tree on
port `6888`. Browser input readiness and real warm navigation remain explicit `agent-browser` evidence.

Generated evidence belongs under `var/center/evidence/`, which is ignored by Git.

## Command

Run each surface from a separate clean server lifecycle. Use an existing, read-authorized workspace and
workflow. The probe never creates data.

```bash
bun run probe:dev-performance \
  --surface=main \
  --route=/workspace/local-test/home \
  --output=var/center/evidence/architecture/performance/20260716-main-home.json \
  --browser-evidence=var/center/evidence/architecture/performance/20260716-main-home.browser.json
```

Workflow Studio uses the same command with `--surface=studio` and an existing
`/workspace/[workspaceId]/w/[workflowId]` route. Do not run main web and Studio in one lifecycle because
the first route primes the second route's compile graph.

The output, browser-evidence, and sibling server-log paths must be distinct. The probe:

1. Refuses to run when port `6888` already has a listener.
2. Refuses to delete `apps/sim/.next/dev` while another process holds its Next development lock, then
   deletes only that directory.
3. Starts `bun run dev:capped --hostname 127.0.0.1` in a detached process group.
4. Waits for the owned listener instead of sleeping for a fixed duration.
5. Samples the listener and recursive descendants every `250 ms` with macOS `ps`.
6. Records one cold and three warm `curl` requests.
7. Keeps the server and sampler alive at an interactive browser checkpoint.
8. Samples a `15 s` settle period and a `15 s` idle window.
9. Stops only the spawned process group with `SIGTERM`, then `SIGKILL` after a bounded timeout. `SIGINT`
   and `SIGTERM` run the same idempotent cleanup before the probe exits.

Use `--skip-browser-wait` only for script development or automated tests. That mode always produces
partial evidence.

## Browser Checkpoint

At the prompt, record the printed probe run ID and use a fresh `agent-browser` session. The canonical
main-web cold target is `/workspace/[workspaceId]/home`: open the printed URL, measure the visible
landing textarea's post-response readiness, then focus it and verify the promoted `/chat/new` composer
accepts and returns typed text. Record that first focus-to-promotion duration as a cold interaction
diagnostic. After both routes have compiled, return to Home and repeat the transition to record warm
navigation. For Studio, verify the canvas and an existing editor interaction instead. Leave the page
open before pressing Enter in the probe terminal so browser-triggered client chunks and API routes are
included in peak and settled listener-tree RSS.

The immediate browser evaluation should record:

```json
{
  "schemaVersion": 1,
  "status": "pass",
  "runId": "printed-probe-run-id",
  "capturedAt": "2026-07-16T12:00:01.000Z",
  "targetUrl": "http://127.0.0.1:6888/workspace/local-test/home",
  "checks": {
    "inputReadiness": { "status": "pass", "upperBoundMs": 250 },
    "interaction": { "status": "pass" },
    "warmNavigation": { "status": "pass", "upperBoundMs": 400 }
  }
}
```

Input-readiness `upperBoundMs` is `performance.now()` minus the navigation entry's `responseEnd`.
Agent-browser command latency is included, so a result under `500 ms` proves the budget; a larger result
is inconclusive rather than an automatic failure. `interaction` passes only after the visible input can
be focused, filled, and read back. Warm navigation is measured only after both the source and destination
routes have compiled once; first-time destination compilation is recorded separately as a cold diagnostic.
The owning surface budget is under `500 ms` for main web and under `3,000 ms` for Studio. Studio evidence
may omit `inputReadiness`, but still requires passing `interaction` and `warmNavigation` checks. Write this
JSON during the checkpoint at the exact `--browser-evidence` path.

The probe parses the attachment; file modification time alone cannot make a run pass. It requires
`schemaVersion: 1`, top-level `status: "pass"`, the printed run ID, an exact target URL, a parseable
`capturedAt` no earlier than the probe start and no more than five seconds in the future, and every
surface-required check within budget. Malformed, stale, wrong-run, wrong-target, future-dated, or failed
evidence remains partial.

HTTP timing cannot replace this evidence. `curl` does not execute client chunks, hydrate React, compile
idle API routes, or prove that the input accepts text. Warm HTTP is therefore a necessary supporting
check, not proof of warm browser navigation.

## Metric Definitions

- **Cold route TTFB:** request-header wait after the owned listener is ready and `.next/dev` is absent.
  It is the user-wait proxy for clean compile and includes route runtime; it is not labeled pure compiler
  time.
- **Warm HTTP:** median TTFB and total time from three requests after the cold response. Every cold and
  warm sample must return `200` at the exact requested URL without a redirect.
- **Peak listener-tree RSS:** maximum summed RSS for the listener and recursive descendants across the
  complete HTTP, browser, settle, and idle run.
- **Settled listener-tree RSS:** median summed RSS over the final five seconds. Idle-window maximum is
  also recorded and gated.
- **Idle CPU:** positive per-process deltas from cumulative `ps TIME`, divided by the sampled idle-window
  wall time. The listener tree must remain stable throughout this window; process churn makes CPU
  evidence inconclusive instead of silently dropping exited-process time. Smoothed `ps %CPU` is
  diagnostic only.

The probe operationalizes "effectively 0%" idle CPU as at most `1.0%` aggregate core-percent over the
`15 s` idle window. RSS limits use bytes: main web is below `4 * 1024^3`; Studio is below `6 * 1024^3`.

## Evidence And Exit Codes

The selected JSON output is cleared before the run, so an interrupted run cannot leave a prior passing
report at that path. A completed JSON file contains environment and Git state, target URL, listener
identity, raw HTTP samples, raw process samples, aggregates, checks, browser evidence reference, and
final status. The sibling `.server.log` retains raw Next output.

- Exit `0`: automated budgets pass and current-run browser evidence is attached.
- Exit `1`: one or more automated budgets fail. JSON and server log are still written.
- Exit `2`: invalid setup, runtime failure, cleanup failure, unstable idle process tree, or incomplete
  browser evidence.

An auth redirect, changed final URL, non-`200` response, listener ownership mismatch, listener restart,
cleanup failure, or missing browser evidence cannot be reported as a passing result. A Studio probe must
use a real existing workflow ID; the probe does not seed or mutate state.
