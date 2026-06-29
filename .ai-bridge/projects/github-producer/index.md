---
id: github-producer-index
type: project
status: active
updated: 2026-06-29
links:
  - center-roadmap-v1
  - capability-metadata-contract-v1
  - emit.github_commit
  - emit.github_issue
  - emit.github_pull_request
  - emit.github_pr_review
  - emit.github_ci_run
  - center-phase-8-implementation
---

# GitHub Producer

## Purpose

Bring engineering reality into Center without making the Center route import GitHub tools, provider SDKs, workflow registries, or connector registries.

## Current interface

Local development imports a bounded GitHub-shaped snapshot from:

```text
.ai-bridge/projects/github-producer/sample-events.json
```

Override path:

```text
CENTER_GITHUB_PRODUCER_FILE=/path/to/events.json
```

## Registered capabilities

```text
.ai-bridge/capabilities/emit.github_commit.json
.ai-bridge/capabilities/emit.github_issue.json
.ai-bridge/capabilities/emit.github_pull_request.json
.ai-bridge/capabilities/emit.github_pr_review.json
.ai-bridge/capabilities/emit.github_ci_run.json
```

## Record kinds

```text
commit
issue
pull_request
review
ci_run
```

## Center mapping

```text
commit -> RawEvent github.commit -> Observation engineering.commit_landed -> Evidence diff
issue -> RawEvent github.issue.updated -> Observation engineering.issue_open/closed -> Evidence source
pull_request -> RawEvent github.pull_request.updated -> Observation engineering.pr_open/closed -> Evidence source
review -> RawEvent github.pull_request.reviewed -> Observation engineering.review_* -> Evidence source
ci_run -> RawEvent github.ci.failed/completed -> Observation engineering.ci_failed/completed -> Evidence test
repo projection -> Center Loop with next action and blocker state
```

## Non-goal

This phase does not call the GitHub API. Authenticated GitHub sync remains a future producer connection. Discovery/import is explicit and local.
