# Phase 2: Task Compatibility Spine

## Status

Current status: Complete
Owner: Sim maintainers
Started: 2026-07-16
Completed: 2026-07-16

The user accepted the narrow ARCH-004 decision on 2026-07-16. This slice implements identity-only Tasks;
status, independent ownership/visibility, richer lifecycle, UI, transport, and Phase 3 remain deferred.

## User Outcome And Reference Workflow

Every existing and new Workspace Mothership conversation has one stable, durable Task identity while
Kevin continues using the same Home and chat experience.

Reference workflow:

1. Open an existing `/workspace/[workspaceId]/chat/[chatId]` URL.
2. Resume its transcript, resources, attachments, and any active stream without a URL or behavior change.
3. Confirm the conversation has one durable `taskId` that remains stable across reloads and resumption.
4. Start an empty, first-turn, inbox-created, or forked Mothership conversation and confirm its Task
   identity is created atomically with the conversation.
5. Exercise the accepted repair and deletion behavior without changing current authorization or losing
   personal-use data.

## Current Behavior And Target Behavior

Current behavior:

- `copilot_chats.id` is the stable conversation and URL identity exposed as `chatId`.
- `copilot_chats.conversation_id` is a mutable active-stream marker. It is set and cleared during a run
  and is not a durable Conversation identity.
- Mothership creation has three persistence seams: direct empty-chat creation, shared
  `resolveOrCreateChat` creation used by first-turn and inbox work, and fork creation.
- Visibility is owner-private inside an accessible workspace: reads select the current
  `copilot_chats.user_id` and then enforce existing workspace access.
- Current delete paths hard-delete `copilot_chats`; dependent transcripts and attachments follow their
  existing foreign-key behavior.
- No canonical Task table, Task ID, Task status, Task ACL, or Task API exists.

Target behavior for this slice:

- A Task receives an independent UUID and maps to exactly one Workspace Mothership conversation through
  stable `copilot_chats.id`.
- A unique database constraint enforces at most one Task per conversation.
- Database creation, backfill, lookup, and repair are atomic and idempotent under retries and races.
- Old and new application versions remain usable against the expanded schema during rolling deployment.
- Current chat URLs, wire contracts, transcripts, streams, resources, attachments, visibility, and
  permissions remain unchanged.
- Task status, independent ownership/visibility, objective, definition of done, and richer lifecycle
  state remain explicitly deferred.

## Scope

In scope:

- Canonical Task identity persistence for `copilot_chats.type = 'mothership'` rows with a non-null
  `workspace_id`.
- One-to-one Task-to-conversation mapping using stable `copilot_chats.id`.
- Atomic creation across empty-chat, first-turn, inbox, and fork paths.
- Idempotent migration, mixed-version creation, lookup, repair, and verification.
- Existing chat authorization as the compatibility authorization boundary.
- An additive, containment-first rollback procedure.
- Targeted tests and one personal-use Home/chat compatibility journey.

Explicitly out of scope:

- New Task Workspace, Center, Home, or chat UI.
- Client state or URL changes merely to expose `taskId`.
- Task status, independent ownership, visibility, sharing, ACL, objective, or definition-of-done semantics.
- Workflow Artifact, Draft, Version, Change Set, or provenance migration.
- Execution-domain redesign or workflow-persistence changes.
- Chat transport, stream, transcript, resource, attachment, or broad UI redesign.
- Phase 3, 4, or 5 work.
- PII validation or masking restoration, the Python PII fallback, or any new required external service.

## Domain Objects And Systems Of Record

This slice adds a minimal canonical Task identity record:

| Field | Implemented rule |
| --- | --- |
| `id` | Independent UUID primary key; canonical `taskId`. |
| `chat_id` | Required unique reference to stable `copilot_chats.id`; never use the mutable `conversation_id`. |
| `created_at`, `updated_at` | Mapping provenance only; not Task lifecycle status. |

The Task row is the system of record only for Task identity in Phase 2. `copilot_chats` remains the
system of record for the Conversation, current title, transcript linkage, streams, resources, current
owner-private visibility, workspace relationship, and compatibility behavior. No chat field is copied
into Task lifecycle or ownership state. Direct Task workspace ownership remains deferred with ARCH-004;
the compatibility row is reachable only through its authorized workspace-scoped chat.

## Applicable Decisions And Invariants

- ADR 0001: Task is the primary work object.
- ADR 0002: Workflow Studio remains a separate compile domain.
- ADR 0003: the workspace shell remains minimal.
- `INV-DOM-001`, `INV-DOM-004`, `INV-DOM-005`, and `INV-DOM-006`.
- `INV-SAFE-003` and `INV-SAFE-005`.
- `INV-DEP-001` through `INV-DEP-009`; Task persistence must not enter Main or Studio client graphs.
- `INV-STATE-001`; no Task server record is duplicated into a client store.

## ARCH-004 Accepted Decision

### Accepted Narrow Decision

The accepted identity-only compatibility Task has these bounded semantics:

1. **Identity:** create an independent Task UUID in a sidecar Task table. Enforce one Task per stable
   `chatId` with a unique non-null `chat_id`. Do not add `copilot_chats.task_id` and do not reuse
   `chatId` as `taskId`.
2. **Status:** add no Task status. Do not derive status from unread, pinned, stream, inbox, or Copilot-run
   state.
3. **Ownership and visibility:** add no independent Task owner, visibility, ACL, API, or UI. A Task lookup
   must first pass the existing chat-owner and workspace-access checks. This preserves current access and
   defers final Task ownership semantics.
4. **Deletion:** while the Task contains identity only, hard-deleting the mapped chat also deletes its
   Task identity through `ON DELETE CASCADE`. No independent Task delete path is added. This preserves
   current delete behavior but deliberately couples Task lifetime to chat lifetime during the
   compatibility window.
5. **Rolling deployment and repair:** use a database-first additive migration. An `AFTER INSERT` trigger
   creates the Task row for every Mothership chat with a non-null `workspace_id`, including rows written by old
   binaries. A bounded idempotent backfill covers existing rows. An authorized Task lookup may perform
   the same conflict-safe ensure as explicit corruption repair. The unique constraint determines the
   winner under races.
6. **Failure behavior:** Task creation runs in the chat insert transaction, so a new Mothership chat is
   not committed without its Task identity. Existing chat APIs remain unchanged; a Task-aware lookup
   reports an explicit repair failure rather than broadening access or inventing identity.
7. **Rollback:** roll application code back while retaining the additive table, trigger, and Task IDs;
   old code ignores them. Do not down-migrate or drop Task rows during ordinary rollback. If the trigger
   itself blocks chat creation, disable only the trigger as containment, then repair missing mappings
   before re-enabling Task-aware behavior.

### Why Approval Was Required

Status and future ownership can be deferred, but deletion and mixed-version repair cannot. Every foreign
key must choose cascade, restriction, or retained/tombstoned identity. Old binaries also continue to
insert and delete `copilot_chats` during rollout, so the system must either enforce Task creation in the
database or explicitly accept a temporary unmapped window. Choosing either behavior defines durable-data
semantics tracked by ARCH-004.

### Alternatives

| Alternative | Migration impact | Rollback impact | Personal-use tradeoff | Decision |
| --- | --- | --- | --- | --- |
| Application transactions plus lazy repair; no trigger | Every current writer must change. Old binaries can create temporarily unmapped chats until a new path reads them. | Additive table can remain, but the repair window returns after code rollback. | Less database machinery; violates exact mixed-version identity unless an unmapped window is accepted. | Not recommended. |
| Reuse `chatId` as `taskId` or add only `copilot_chats.task_id` | Smallest schema diff, but Conversation remains the Task identity and old writers cannot populate a required pointer. | Removing a chat column becomes a later destructive contract migration. | Simple today; contradicts independent Task identity and resumability. | Reject. |
| Preserve a Task tombstone after chat deletion | Requires nullable conversation linkage plus accepted deletion/status/ownership state. | More state must survive rollback and be reconciled on re-upgrade. | Preserves identity history; expands into unresolved ARCH-004 lifecycle design. | Defer. |
| Restrict chat deletion while a Task exists | Old delete routes, retention cleanup, and parent cascades can fail. | Removing the restriction requires another migration. | Preserves Task identity by breaking current delete behavior. | Reject for Phase 2. |
| One-time backfill without trigger or repair | Misses chats created by old binaries after the scan. | Rollback immediately reopens the gap. | Lowest implementation cost; cannot prove the one-to-one invariant. | Reject. |

### Current Data Evidence

A read-only count on 2026-07-16 found `3` Mothership chats: all `3` are workspace-scoped, across `2`
workspaces and `1` user; `0` lack a workspace. These counts only size the current personal-use cohort.
The migration must remain correct for any row count and for concurrent old-version inserts.

## API And Compatibility Impact

- Existing HTTP request and response contracts remain unchanged.
- Existing URLs remain `/workspace/[workspaceId]/chat/[chatId]`.
- Existing SSE and resume correlation continue using `chatId` and current stream/run identifiers.
- Transcripts remain in `copilot_messages`; resources remain on `copilot_chats`; attachments retain their
  existing `workspace_files.chat_id` linkage.
- No `taskId` is added to client state, request bodies, streams, resources, attachments, or current chat
  response contracts in this slice.
- Task-aware server lookup must authorize through the mapped chat before returning or repairing a Task.
- Mixed-version reads must never inner-join away a valid chat solely because Task mapping is absent during
  migration or containment.

## Persistence And Migration

1. Added the minimal Task table and unique `chat_id` constraint as additive migration `0252`.
2. Installed the filtered workspace-scoped Mothership insert trigger before backfill so old-version
   concurrent writes receive identity in their own chat transaction.
3. Backfilled eligible rows in bounded, idempotent `1000`-row keyset batches using
   `ON CONFLICT DO NOTHING`.
4. Added a focused server-only Task repository and auth-first lookup service. Repair re-reads the winning
   row after a uniqueness conflict and never creates an orphan Task first.
5. Kept all current chat writers and readers compatible with both pre- and post-migration application
   binaries. Do not require a new Task field from old clients or servers.
6. Retain the trigger through the mixed-version window. Any future removal is a separate contract slice
   after every writer is proven Task-aware.

## Performance Budget

- No Main, Home, Center, or Workflow Studio client entry graph changes.
- No new required service, loader, provider, client query, or global store.
- Task creation adds one local database row inside Mothership chat creation; ordinary chat streaming and
  existing reads retain their current transport.
- Reuse accepted Phase 1 and upstream-integration compile/runtime evidence. Run a new performance probe
  only if implementation changes a relevant frontend entry or runtime graph.

## Observable Acceptance Criteria

- The slice decision is accepted and ARCH-004 is narrowed to explicitly deferred status, independent
  ownership/visibility, and post-compatibility deletion design.
- On an isolated clone of the personal database, every eligible existing Mothership chat maps to exactly
  one Task; no duplicate or missing mapping remains.
- Running migration/backfill twice is idempotent and preserves every original `chatId`, workspace link,
  transcript, resource, attachment, visibility, and permission.
- Old `main` code can create a Mothership chat against the expanded schema and the trigger creates exactly
  one Task in the same transaction.
- Empty-chat, first-turn, inbox, and fork creation each produce exactly one stable Task identity.
- Authorized lookup returns the same `taskId` across repeated calls; unauthorized or cross-workspace
  lookup returns no Task and performs no repair.
- Deleting a chat produces the accepted Task result through database enforcement, including legacy delete
  and parent-cascade paths.
- Fault-injected missing mapping repairs once, remains stable on retry, and cannot resurrect a deleted chat
  or leave an orphan Task after a race.
- Targeted Task, chat lifecycle, Mothership route, fork, contract, URL-handoff, and authorization tests pass.
- `bun run scripts/check-migrations-safety.ts main`, package/app typechecks, applicable Home, Studio,
  Center, API, React Query, and monorepo boundaries, targeted formatting, production build, and
  `git diff --check` pass.
- One personal-use browser journey proves existing Home/chat behavior, exact unchanged URL, transcript and
  resource restoration, reload/resumption, and stable database `taskId`.
- No Phase 3 files, schema, contracts, or behavior are introduced.

## Verification Evidence

- A disposable PostgreSQL 16 clone of the personal database started at migration `0240` and upgraded
  through `0252`. All `3` eligible chats received exactly `3` Task rows, with `0` missing, invalid, or
  duplicate mappings. A second migrator run left the migration count at `252`, and replaying the bounded
  backfill left every Task ID unchanged.
- Exact old-`main` chat creation against the expanded clone produced chat
  `28d4dc64-0001-4396-8ba1-c330152cc8df` and trigger-created Task
  `97da613d-b109-4035-9294-4bcfb400b14a`; the new conflict-safe ensure returned that same Task. Deleting
  the chat cascaded the Task row.
- Fault injection removed the mapping for chat `0ec933f3-4076-4d81-a808-cf10b62f15b8`, then authorized
  repair created Task `6d7efa0a-6e2d-4dd0-8525-1e743d0de519`; retry returned the same ID. Chat, message,
  and chat-linked workspace-file counts and content fingerprints were unchanged by the migration proof.
- The final scoped Vitest run passed `64` tests across `9` files. Targeted Biome, migration safety,
  database/testing/app typechecks, Home, Studio, Center, API-validation, React Query, and monorepo
  boundary checks, the production build, and `git diff --check` passed.
- The personal-use browser journey loaded Home, opened
  `/workspace/e16205a1-7107-4ab0-9eb1-dfb46028bc14/chat/00000000-0000-4000-8000-000000000001`, restored
  both transcript turns and the attached CSV resource, passed two reloads plus Home-to-chat reopen, and
  retained Task `a3fc282b-9166-4a4b-8902-1a64535e14e1`. The isolated worktree temporarily mounted the
  existing ignored local upload fixture for this proof and removed it afterward.

## Legacy Retirement Condition

No current chat path is removed in Phase 2. The database trigger and repair compatibility path remain
until every old writer is retired and a later accepted slice proves they are unnecessary. The identity-only
Task may not acquire status, independent ownership, artifact, or execution state without a new accepted
decision.

## Rollback And Containment

Normal rollback reverts application code while leaving the additive Task table, trigger, and generated
Task IDs intact. This preserves identity continuity for a later re-deploy and leaves existing chat behavior
available to old code. Do not drop the Task table or rewrite `copilot_chats` as routine rollback.

If the trigger causes new-chat failure, disable the trigger as the smallest containment action, preserve
all existing Task rows, restore chat availability, and run the idempotent repair before Task-aware behavior
is re-enabled. If verification finds any chat-data, URL, authorization, or transport regression, abandon
the slice application changes and retain the additive identity records for diagnosis rather than resetting
or rewriting personal data.

## Approval Record

On 2026-07-16, the user approved identity-only Phase 2 Tasks with independent UUIDs, existing chat
authorization, chat-deletion cascade for the identity-only row, database-triggered mixed-version
creation, bounded idempotent backfill/repair, and rollback that retains additive Task IDs.
