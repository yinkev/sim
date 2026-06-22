# Mothership Agent Operating System

Date: 2026-06-22

Status: Active operating contract for carrying the owned Mothership replacement from current evidence to final-vision quality.

## Call

Use the Adjudicated Evidence OS.

Every feature is a controlled case. A main agent owns the case, scoped workers produce evidence, reviewers attack the diff, a grader applies hard pass/fail criteria, failed grades trigger iteration, and the coverage audit plus timestamped handoff become the court of record.

No orchestration, no review, no grade, no evidence ledger, no completion claim.

The final vision is an owned, auditable, restart-safe workspace command plane for Sim. Chat is one operator UI. `apps/mothership` is the execution kernel. The control panel is the operational command surface over typed contracts, durable stream events, strict capability secrets, explicit checkpoints, provider/tool/subagent loops, callbacks, deployment proof, and explicit non-claims.

## Long-Term Self-Governing Goal

Build a self-governing command plane that can keep moving without lowering proof quality.

The end state includes a real UI. The UI is the operator cockpit over the evidence ledger, not a decorative agent board. It must show cases, claims, non-claims, evidence, command output, diffs, reviewers, grades, blockers, next actions, subagent work, Oracle advice, Mothership run IDs, stream IDs, checkpoints, deployment gates, and E2E proof status.

Autonomy is allowed only inside the case system:

1. Every autonomous loop starts from a `FeatureCase`.
2. Every subagent has scoped ownership.
3. Every Oracle run is advisory evidence, never final truth.
4. Every feature closes through F0-F8.
5. Every closed or blocked feature updates the coverage audit and handoff.
6. Current repo state, command output, runtime behavior, and artifacts override memory or prior advice.

Long-term outcome: agents can work continuously because the case runner prevents fake completion, not because prompts say "keep going."

## Oracle And Subagents

Subagents and Oracle are allowed whenever they materially improve the case.

Use subagents for:

1. Bounded code changes with disjoint file ownership.
2. Independent codebase exploration.
3. Spec/code/evidence review.
4. Parallel verification where results can be checked.

Use Oracle for:

1. High-judgment architecture review.
2. Final-vision critique.
3. Risk review before large direction changes.
4. UI/product judgment when local evidence is insufficient.

Rules:

1. Main agent owns final truth.
2. Do not delegate final claims.
3. Do not let Oracle override repo evidence.
4. Document Oracle URL/session ID/transcript path, prompt intent, useful findings, and non-findings in handoff when used.
5. Document subagent task, result, changed files, review status, and integration decision.

## Non-Negotiable Rules

1. Orchestrate always.
2. Evaluate, review, grade, and iterate after every feature.
3. Treat docs, handoffs, and memory as maps. Current files, command output, runtime behavior, and artifacts are proof.
4. Do not claim completion from local green tests alone.
5. Unsupported provider, tool, or subagent branches must fail honestly through typed protocol behavior.
6. No hidden hosted fallback is allowed in the final owned runtime path.
7. Runtime, callback, and admin service secrets are separate capability families.
8. Every closed slice must update evidence and non-claims.

## Feature State Machine

```text
INTAKE
  -> REPO_STATE_VERIFIED
  -> CHARTERED
  -> ORCHESTRATED
  -> IMPLEMENTED
  -> VERIFIED
  -> REVIEWED
  -> GRADED
  -> ITERATE | BLOCKED | REJECTED | LEDGERED
  -> PROMOTED_OR_NONPROMOTED_CLOSED
  -> NEXT_SLICE_SELECTED
```

Illegal transitions:

```text
IMPLEMENTED -> DONE
VERIFIED -> DONE
REVIEWED -> DONE
GRADED_WITH_BLOCKERS -> PROMOTED
BLOCKED -> CLAIMED
HANDOFF_PROSE -> PROOF
LOCAL_UNIT_PASS -> BROWSER_E2E_CLAIM
HELM_RENDER -> LIVE_K8S_CLAIM
CLIPROXY_SIM_TOOL_RESUME -> CLIPROXY_WORKFLOW_SUBAGENT_CLAIM
```

## Feature Charter

Before edits, write or state:

```text
Feature ID:
Objective:
Non-objectives:
Why this next:
Files/packages likely touched:
Invariants:
Proof required:
Workers/reviewers/grader:
Stop rules:
Expected non-claims:
```

The slice must be the smallest coherent vertical change that advances the current coverage audit.

## Roles

### Main Agent

The main agent owns truth.

Required work:

1. Verify workspace, branch, HEAD, and worktree state.
2. Read the coverage audit, execution plan, architecture, secret-boundary doc, docs index, and latest temp handoff.
3. Pick one highest-value slice from current evidence.
4. Assign worker scopes and invariant scopes.
5. Integrate changes.
6. Review every changed file.
7. Run or verify required commands.
8. Resolve reviewer findings.
9. Apply grading.
10. Update coverage audit and handoff.
11. Report claims and non-claims.

The main agent cannot delegate final truth.

### Workers

Workers produce narrow evidence or narrow code changes.

Allowed:

1. Inspect broad context.
2. Edit only assigned files.
3. Run focused checks.
4. Report exact outputs, risks, and non-claims.

Forbidden:

1. Broad formatting.
2. Unassigned doc rewrites.
3. Coverage-audit updates unless assigned docs-only work.
4. Secret or auth-boundary weakening.
5. Completion claims.
6. Reverting unrelated work.

### Reviewers

Every feature needs separated review passes. If independent agents are unavailable, label the pass as self-review and cap the grade.

| Review | Question | Required focus |
| --- | --- | --- |
| Spec review | Does the slice satisfy architecture, execution plan, coverage audit, and secret-boundary constraints? | Contracts, streams, auth, callbacks, state, unsupported branches, deployment claims |
| Code review | Is the implementation maintainable and boundary-safe? | Package imports, route ownership, tests, migrations, async control flow, side effects, unrelated churn |
| Evidence review | Do the commands and artifacts prove the claims? | Test scope, skipped commands, E2E artifacts, deployment artifacts, non-claims |

### Grader

The grader decides, not the implementer.

| Decision | Meaning |
| --- | --- |
| `PROMOTE` | Exact claim proven; named gate advances. |
| `CLOSE_SAFE_PARTIAL` | Safe useful progress, but larger gate does not advance. |
| `ITERATE` | Fixable defects remain; re-enter implementation/review. |
| `BLOCKED` | External resource missing, such as secrets, Docker daemon, registry, cluster, or real provider topology. |
| `REJECT_OR_REVERT` | Slice violates a hard invariant or creates fake completion. |

## Grades

| Grade | Meaning |
| --- | --- |
| `A` | Acceptance met, hard gates pass, reviewers clean, focused verification passes, audit/handoff updated, non-claims explicit. |
| `B` | Safe useful progress, but evidence or handoff has minor gaps. Do not advance a major gate until fixed. |
| `C` | Partial progress only. Useful work landed, but acceptance is missing. Do not close the workstream. |
| `D` | Unsafe or ambiguous. Missing auth/protocol/durability evidence, unclear truth source, or unreviewed architecture drift. |
| `F` | Hard fail. Stop closure and iterate before more feature work. |

Grade caps:

1. No commands run: max `D`.
2. Only typecheck/lint for runtime behavior: max `C`.
3. No reviewer separation: max `C`.
4. Local-only tests for browser/provider claim: max `C`.
5. Helm render without image/cluster proof: max `B`.
6. Safe fail-closed partial with explicit non-claims: max `B`.
7. External proof unavailable: `BLOCKED`, not pass.
8. Any unresolved hard fail: `F`.

## Hard Fail Gates

Automatic `F` or `REJECT_OR_REVERT`:

1. Wrong repo or branch.
2. Repo state not verified.
3. Raw secret, bearer token, cookie, database password, provider key, admin key, or callback key leaked.
4. Owned service-to-service route accepts generic `x-api-key`.
5. Runtime, admin, callback, or public API secret domains are confused.
6. Auth runs after parsing where auth must happen first.
7. Hidden hosted fallback enters normal owned runtime path.
8. Unsupported branch returns success.
9. Stream can close without terminal event.
10. Duplicate stream terminal or child terminal leak.
11. Terminal status mutation can happen before durable terminal event append.
12. Entitlement or BYOK validation happens after durable mutation or billable provider work.
13. Billing can double-charge retries.
14. Billing source or BYOK credential source can change across resume.
15. Browser/provider/deployment completion is claimed from unit, fixture, render, or handoff evidence alone.
16. Coverage audit and handoff are skipped for a closed or blocked feature.

## Score Dimensions

Score each relevant dimension `0`, `1`, or `2`:

1. Slice quality.
2. Architecture fit.
3. Auth/security.
4. Stream/protocol.
5. Durability/state.
6. Failure honesty.
7. Testing evidence.
8. E2E/deployment evidence.
9. Observability/audit.
10. Maintainability.

The grade is capped by the weakest relevant evidence class.

## Promotion Gates

Feature-level gates:

| Gate | Name | Required evidence |
| --- | --- | --- |
| `F0` | Repo-state verified | `pwd`, repo root, branch, HEAD, `git status --short --branch` |
| `F1` | Slice chartered | Objective, non-objectives, scope, invariants, proof plan |
| `F2` | Orchestrated | Owner, workers/reviewers/grader or labeled role-separated self-review |
| `F3` | Implemented | Narrow diff, no unrelated churn |
| `F4` | Verified | Focused and relevant aggregate checks pass |
| `F5` | Reviewed | Spec, code-quality, and evidence review complete |
| `F6` | Graded | Decision and grade caps recorded |
| `F7` | Ledgered | Coverage audit and handoff updated |
| `F8` | Promoted | Only exact proven claim advances |

Project gates keep their existing meaning:

1. `G1` contracts.
2. `G2` auth.
3. `G3` streams.
4. `G4` runtime.
5. `G5` product/deployment.

Do not promote `G4` from local package checks. Do not promote `G5` without browser/provider E2E and deployment proof.

## Default Slice Selection

Default next work comes from `docs/superpowers/plans/mothership-replacement-coverage-audit.md`.

Preference order:

1. Strict browser/provider E2E against owned Mothership, if secrets/topology exist.
2. Docker image build/push proof, if Docker/registry path exists.
3. Live Kubernetes smoke, if cluster path exists.
4. F0-F8 case runner -> hash-chained case ledger -> control-panel backend -> YES UI over ledger, if external proof is blocked.
5. CliProxyAPI workflow subagent callback decision and fail-closed regression if external proof is blocked.
6. Provider pricing or billing-only work only when explicitly reprioritized.

Do not hide in more local unit work unless it protects a newly exposed branch or fixes a failing gate.

## Mandatory Invariants

Architecture:

1. `apps/mothership` is a real service boundary.
2. `apps/mothership` must not import from `apps/sim`.
3. Shared wire contracts live in packages.
4. Do not depend on `/Users/kyin/Projects/copilot`.

Auth and secrets:

1. Sim to Mothership runtime uses `X-Mothership-Runtime-Key` / `SIM_TO_MOTHERSHIP_API_KEY`.
2. Mothership to Sim callbacks use `X-Sim-Callback-Key` / `MOTHERSHIP_TO_SIM_CALLBACK_KEY`.
3. Sim admin or ops to Mothership admin uses `X-Mothership-Admin-Key` / `MOTHERSHIP_ADMIN_API_KEY`.
4. Generic `x-api-key` must not authenticate owned service-to-service routes.
5. `INTERNAL_API_SECRET` must not silently alias to `MOTHERSHIP_TO_SIM_CALLBACK_KEY`.
6. Runtime, admin, and callback secrets must be distinct.
7. Missing production secrets fail startup.
8. Auth must run before parsing protected route bodies.
9. Wrong-family valid keys must not grant access.
10. Logs and handoffs must never print raw secrets.

Stream/runtime:

1. Every stream event must be contract-valid.
2. Sequence numbers must be monotonic per stream.
3. Every stream leg must end with exactly one `complete`, `error`, or `run.checkpoint_pause`.
4. Unsupported providers, tools, and subagents fail explicitly.
5. Terminal event is appended durably before terminal status mutation.
6. Durable replay reads stored events.
7. Provider errors are sanitized before streaming.

Checkpoint/resume:

1. Checkpoints store enough provider envelope to resume honestly.
2. Resume uses durable run workspace for entitlement.
3. Resume rejects caller workspace conflicts.
4. Resume validates stored provider request shape before tool-result mutation.
5. Tool-result recording rechecks workspace transactionally.
6. Billing source and BYOK credential source persist across checkpoint/resume.
7. Mixed Sim plus subagent provider batches remain fail-closed unless explicitly implemented and tested.

Callbacks:

1. API-key entitlement callbacks are synchronous fail-closed before initial run claim/provider work and before resume mutation.
2. BYOK validation callbacks are Sim-authoritative.
3. Billing callbacks are cumulative and idempotent.
4. Billing outbox never contains raw provider keys or callback secrets.

Hosted fallback:

1. Do not add normal runtime fallback to `copilot.sim.ai` or `www.copilot.sim.ai`.
2. Hosted legacy compatibility may remain only where current docs explicitly permit it.
3. Do not claim hosted fallback removed globally until strict owned cutover is proven globally.

CliProxyAPI:

1. Accepted current path: explicit `cliproxyapi` or `cliproxy`, default `gpt-5.5`, chat-completions text streaming, Sim-tool checkpoint/resume, provider-specific billing idempotency, sanitized errors, strict preflight, and public stream fixtures.
2. Not accepted current path: workflow subagent callback continuation.
3. Keep CliProxyAPI workflow subagent calls fail-closed until real provider/browser E2E proves a separate Chat Completions subagent continuation path is necessary and safe.

Subagents:

1. Workflow is the first owned subagent.
2. Unsupported subagents remain fail-closed.
3. Workflow subagent preserves parent run/stream/chat/workspace/user/model/provider/parent-tool identity.
4. Child events are scoped and non-terminal relative to parent stream.
5. Child terminal events must not leak and terminate parent stream.
6. Production parity requires browser/provider E2E, not only callback/unit fixtures.

## Verification Commands

Run narrow focused checks first, then aggregate checks appropriate to the slice.

Common commands:

```bash
bun run --cwd apps/mothership test src/http.test.ts src/env.test.ts src/smoke/strict-e2e-preflight.test.ts
bun run --cwd apps/mothership type-check
bun run --cwd apps/mothership lint:check
bun run mship-service:check
bun run mship:check
bun run mship-fixtures:check
bun run mship-contracts:check
bun run mship-client:check
bun run check:api-validation:strict
bun run check:boundaries
bun run type-check
bun run check:migrations
git diff --check
```

Before real strict E2E:

```bash
bun run --cwd apps/mothership smoke:strict-e2e-preflight
```

If preflight reports blocked, do not fake E2E. Record blockers and pick a safe no-secret slice only if it is higher-value and within scope.

Final replacement completion requires the global gate in `docs/superpowers/plans/mothership-backend-replacement-execution-plan.md`.

## Coverage Audit Update

After each closed or blocked feature, update `docs/superpowers/plans/mothership-replacement-coverage-audit.md` with:

1. Feature ID and slice.
2. What changed.
3. Files changed.
4. Exact commands run.
5. Exact observed results.
6. Review findings and fixes.
7. Grade decision.
8. Claims advanced.
9. Explicit non-claims.
10. Next required action impact.

Update other docs only when their ownership changes:

1. Execution plan: task graph, acceptance criteria, or gates changed.
2. Architecture: approved architecture changed.
3. Secret boundaries: auth boundary rules or migration rules changed.
4. Docs README: docs inventory changed.

## Handoff Contract

Create a timestamped handoff after every closed or blocked feature:

```text
$TMPDIR/sim-mothership-owned-replacement-handoff-YYYYMMDDTHHMMSSZ.md
```

Required fields:

1. Timestamp.
2. Workspace.
3. Branch.
4. HEAD.
5. Git status summary.
6. Objective.
7. Changed files.
8. Evidence commands/results.
9. Established facts.
10. Non-claims.
11. Review/grade result.
12. Next required action.
13. Risks/blockers.
14. Redaction audit.

## Long-Loop Agent Prompt

```text
You are operating in the Sim monorepo at /Users/kyin/Projects/sim.

Objective:
Carry the owned Sim Mothership/Copilot backend replacement to final-vision quality. Use the Adjudicated Evidence OS: orchestrate always; evaluate, review, grade, and iterate after every feature.

Start every loop by verifying:
- pwd
- git rev-parse --show-toplevel
- git branch --show-current
- git rev-parse HEAD
- git status --short --branch

Stop if you are not in /Users/kyin/Projects/sim. If branch differs from the expected branch, stop unless instructed otherwise. If dirty files overlap your intended slice, stop and report the conflict.

Read current source-of-truth files before choosing work:
- docs/superpowers/plans/mothership-replacement-coverage-audit.md
- docs/superpowers/plans/mothership-backend-replacement-execution-plan.md
- docs/superpowers/plans/mothership-backend-replacement-architecture.md
- docs/superpowers/plans/mothership-secret-boundaries.md
- docs/superpowers/plans/mothership-agent-operating-system.md
- docs/README.md
- latest $TMPDIR/sim-mothership-owned-replacement-handoff-*.md if present

Do not rely on memory. Use current files and current command output.

Create a feature charter before edits:
Feature ID:
Objective:
Non-objectives:
Why this next:
Likely files/packages touched:
Invariants:
Proof required:
Workers/reviewers/grader:
Stop rules:
Expected non-claims:

Pick the highest-value slice from the coverage audit's Next Required Action.

Default priority:
1. Strict browser/provider E2E against owned Mothership if secrets/topology are available.
2. Docker image build/push proof if Docker/registry are available.
3. Live Kubernetes smoke if cluster path is available.
4. F0-F8 case runner -> hash-chained case ledger -> control-panel backend -> YES UI over ledger if external proof is blocked.
5. CliProxyAPI workflow subagent callback decision and typed fail-closed regression.
6. Provider pricing or billing-only work only when explicitly reprioritized.

Implementation rules:
- Make the smallest coherent change.
- Preserve apps/mothership as a real process boundary.
- Do not import apps/sim from apps/mothership.
- Keep shared wire contracts in packages.
- Auth before parse on protected routes.
- Do not accept generic x-api-key on owned service-to-service routes.
- Do not add hidden hosted fallback.
- Unsupported branches fail explicitly and observably.
- Stream only contract-valid events.
- Preserve terminal-event and durable-status ordering.
- Preserve entitlement-before-mutation and billing-source/BYOK-source invariants.
- Never leak raw secrets or full .env contents.

After implementation, run focused checks first, then relevant aggregate gates.

Review every feature with:
1. Spec review.
2. Code-quality review.
3. Evidence review.

Grade every feature:
- PROMOTE
- CLOSE_SAFE_PARTIAL
- ITERATE
- BLOCKED
- REJECT_OR_REVERT

Apply grade caps:
- no commands run: max D
- only typecheck/lint for runtime behavior: max C
- no reviewer separation: max C
- local-only tests for browser/provider claim: max C
- Helm render without image/cluster proof: max B
- safe fail-closed partial with explicit non-claims: max B
- external proof unavailable: BLOCKED, not pass
- unresolved hard fail: F

Update coverage audit and create a timestamped handoff after every closed or blocked feature.

Final response format:
1. Closed slice
2. Established evidence
3. Reviews
4. Grade
5. Changed files
6. Non-claims
7. Next highest-value action

Forbidden claims unless directly proven in the current loop:
- replacement complete
- production ready
- hosted fallback removed globally
- browser E2E proven
- real provider E2E proven
- Docker build/push proven
- Kubernetes smoke proven
- CliProxyAPI workflow subagent callbacks supported
- billing final
- provider pricing/billing final
- full repo tests pass
- Phase 3 product control plane complete
```
