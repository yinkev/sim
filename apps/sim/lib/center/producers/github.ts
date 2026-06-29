import { filterUndefined } from '@sim/utils/object'
import type { CenterProducerImportPacket } from '@/lib/center/producer-import'

export const GITHUB_PRODUCER_ID = 'github'

export type CenterGithubRecord =
  | CenterGithubCommitRecord
  | CenterGithubIssueRecord
  | CenterGithubPullRequestRecord
  | CenterGithubReviewRecord
  | CenterGithubCiRunRecord

export interface CenterGithubSnapshot {
  sourcePath: string
  records: CenterGithubRecord[]
}

export interface CenterGithubCommitRecord {
  kind: 'commit'
  repo: string
  sha: string
  message: string
  committedAt: string
  author?: string
  branch?: string
  url?: string
  status?: string
}

export interface CenterGithubIssueRecord {
  kind: 'issue'
  repo: string
  number: number
  title: string
  state: string
  updatedAt: string
  url?: string
  labels?: string[]
  assignees?: string[]
}

export interface CenterGithubPullRequestRecord {
  kind: 'pull_request'
  repo: string
  number: number
  title: string
  state: string
  updatedAt: string
  url?: string
  headSha?: string
  baseRef?: string
}

export interface CenterGithubReviewRecord {
  kind: 'review'
  repo: string
  pullNumber: number
  reviewId: string
  state: string
  submittedAt: string
  author?: string
  url?: string
}

export interface CenterGithubCiRunRecord {
  kind: 'ci_run'
  repo: string
  runId: string
  workflowName: string
  status: string
  updatedAt: string
  conclusion?: string
  headSha?: string
  url?: string
}

type PacketObservation = CenterProducerImportPacket['observations'][number]

interface RepoProjection {
  repo: string
  evidenceRefs: Set<string>
  blockers: string[]
  nextAction?: string
}

export function buildGithubImportPacket(
  snapshot: CenterGithubSnapshot
): CenterProducerImportPacket {
  const packet: CenterProducerImportPacket = {
    producerId: GITHUB_PRODUCER_ID,
    producerDisplayName: 'GitHub',
    actor: {
      kind: 'integration',
      displayName: 'GitHub',
    },
    evidence: [],
    rawEvents: [],
    observations: [],
    loops: [],
    recommendations: [],
    actionProposals: [],
  }
  const repos = new Map<string, RepoProjection>()

  for (const record of snapshot.records) {
    const repo = ensureRepo(repos, record.repo)
    if (record.kind === 'commit') {
      addCommit(packet, repo, record)
    } else if (record.kind === 'issue') {
      addIssue(packet, repo, record)
    } else if (record.kind === 'pull_request') {
      addPullRequest(packet, repo, record)
    } else if (record.kind === 'review') {
      addReview(packet, repo, record)
    } else {
      addCiRun(packet, repo, record)
    }
  }

  for (const repo of [...repos.values()].sort((left, right) =>
    left.repo.localeCompare(right.repo)
  )) {
    packet.loops.push({
      sourceRef: `github:loop:${repo.repo}`,
      title: `GitHub ${repo.repo}`,
      domain: 'engineering',
      status: repo.blockers.length > 0 ? 'blocked' : 'active',
      nextAction: repo.nextAction,
      blockedBy: repo.blockers.length > 0 ? repo.blockers : undefined,
      evidenceRefs: [...repo.evidenceRefs].slice(0, 10),
    })
  }

  return packet
}

function addCommit(
  packet: CenterProducerImportPacket,
  repo: RepoProjection,
  record: CenterGithubCommitRecord
) {
  const evidenceRef = `github:commit:${record.repo}:${record.sha}:evidence`
  const eventRef = `github:commit:${record.repo}:${record.sha}`
  const title = `Commit ${shortSha(record.sha)} - ${firstLine(record.message)}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'github-commit',
    subjectId: `${record.repo}@${record.sha}`,
    kind: 'diff',
    title,
    uri: record.url,
    payload: payload({
      repo: record.repo,
      sha: record.sha,
      branch: record.branch,
      author: record.author,
      status: record.status,
      message: record.message,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.committedAt,
    eventType: 'github.commit',
    subjectType: 'github-commit',
    subjectId: `${record.repo}@${record.sha}`,
    evidenceRefs: [evidenceRef],
    payload: payload({
      repo: record.repo,
      sha: record.sha,
      branch: record.branch,
      author: record.author,
      summary: firstLine(record.message),
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.committedAt,
      observationType: 'engineering.commit_landed',
      subjectType: 'github-repository',
      subjectId: record.repo,
      sourceEventRefs: [eventRef],
      payload: payload({
        repo: record.repo,
        summary: `Commit ${shortSha(record.sha)} landed: ${firstLine(record.message)}`,
        sha: record.sha,
        branch: record.branch,
        author: record.author,
        url: record.url,
      }),
    })
  )
  repo.evidenceRefs.add(evidenceRef)
}

function addIssue(
  packet: CenterProducerImportPacket,
  repo: RepoProjection,
  record: CenterGithubIssueRecord
) {
  const issueId = `${record.repo}#${record.number}`
  const evidenceRef = `github:issue:${issueId}:${record.updatedAt}:evidence`
  const eventRef = `github:issue:${issueId}:${record.updatedAt}`
  const open = record.state.toLowerCase() === 'open'
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'github-issue',
    subjectId: issueId,
    kind: 'source',
    title: `Issue #${record.number} - ${record.title}`,
    uri: record.url,
    payload: payload({
      repo: record.repo,
      number: record.number,
      state: record.state,
      labels: record.labels,
      assignees: record.assignees,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.updatedAt,
    eventType: 'github.issue.updated',
    subjectType: 'github-issue',
    subjectId: issueId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      repo: record.repo,
      number: record.number,
      title: record.title,
      state: record.state,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.updatedAt,
      observationType: open ? 'engineering.issue_open' : 'engineering.issue_closed',
      subjectType: 'github-issue',
      subjectId: issueId,
      sourceEventRefs: [eventRef],
      payload: payload({
        repo: record.repo,
        summary: `Issue #${record.number} is ${record.state}: ${record.title}`,
        title: record.title,
        state: record.state,
        url: record.url,
      }),
    })
  )
  repo.evidenceRefs.add(evidenceRef)
  if (open && !repo.nextAction) {
    repo.nextAction = `Triage issue #${record.number}: ${record.title}`
  }
}

function addPullRequest(
  packet: CenterProducerImportPacket,
  repo: RepoProjection,
  record: CenterGithubPullRequestRecord
) {
  const prId = `${record.repo}#${record.number}`
  const evidenceRef = `github:pull-request:${prId}:${record.updatedAt}:evidence`
  const eventRef = `github:pull-request:${prId}:${record.updatedAt}`
  const open = record.state.toLowerCase() === 'open'
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'github-pull-request',
    subjectId: prId,
    kind: 'source',
    title: `PR #${record.number} - ${record.title}`,
    uri: record.url,
    payload: payload({
      repo: record.repo,
      number: record.number,
      state: record.state,
      headSha: record.headSha,
      baseRef: record.baseRef,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.updatedAt,
    eventType: 'github.pull_request.updated',
    subjectType: 'github-pull-request',
    subjectId: prId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      repo: record.repo,
      number: record.number,
      title: record.title,
      state: record.state,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.updatedAt,
      observationType: open ? 'engineering.pr_open' : 'engineering.pr_closed',
      subjectType: 'github-pull-request',
      subjectId: prId,
      sourceEventRefs: [eventRef],
      payload: payload({
        repo: record.repo,
        summary: `PR #${record.number} is ${record.state}: ${record.title}`,
        title: record.title,
        state: record.state,
        url: record.url,
      }),
    })
  )
  repo.evidenceRefs.add(evidenceRef)
  if (open && !repo.nextAction) {
    repo.nextAction = `Review or merge PR #${record.number}: ${record.title}`
  }
}

function addReview(
  packet: CenterProducerImportPacket,
  repo: RepoProjection,
  record: CenterGithubReviewRecord
) {
  const reviewId = `${record.repo}#${record.pullNumber}:${record.reviewId}`
  const evidenceRef = `github:review:${reviewId}:evidence`
  const eventRef = `github:review:${reviewId}`
  const reviewState = normalizeReviewState(record.state)
  const blocking = reviewState === 'changes_requested'
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'github-review',
    subjectId: reviewId,
    kind: 'source',
    title: `Review ${record.state} on PR #${record.pullNumber}`,
    uri: record.url,
    payload: payload({
      repo: record.repo,
      pullNumber: record.pullNumber,
      reviewId: record.reviewId,
      state: record.state,
      author: record.author,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.submittedAt,
    eventType: 'github.pull_request.reviewed',
    subjectType: 'github-review',
    subjectId: reviewId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      repo: record.repo,
      pullNumber: record.pullNumber,
      reviewId: record.reviewId,
      state: record.state,
      author: record.author,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.submittedAt,
      observationType: blocking
        ? 'engineering.review_blocking'
        : reviewObservationType(reviewState),
      subjectType: 'github-pull-request',
      subjectId: `${record.repo}#${record.pullNumber}`,
      sourceEventRefs: [eventRef],
      payload: payload({
        repo: record.repo,
        summary: `Review ${record.state} on PR #${record.pullNumber}`,
        state: record.state,
        author: record.author,
        url: record.url,
      }),
    })
  )
  repo.evidenceRefs.add(evidenceRef)
  if (blocking) {
    addBlocker(repo, `Changes requested on PR #${record.pullNumber}`)
    repo.nextAction = `Address requested changes on PR #${record.pullNumber}`
  }
}

function addCiRun(
  packet: CenterProducerImportPacket,
  repo: RepoProjection,
  record: CenterGithubCiRunRecord
) {
  const runId = `${record.repo}/actions/runs/${record.runId}`
  const evidenceRef = `github:ci-run:${record.repo}:${record.runId}:${record.updatedAt}:evidence`
  const eventRef = `github:ci-run:${record.repo}:${record.runId}:${record.updatedAt}`
  const failed = isFailedCiRun(record)
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'github-ci-run',
    subjectId: runId,
    kind: 'test',
    title: `${record.workflowName} ${record.conclusion ?? record.status}`,
    uri: record.url,
    payload: payload({
      repo: record.repo,
      runId: record.runId,
      workflowName: record.workflowName,
      status: record.status,
      conclusion: record.conclusion,
      headSha: record.headSha,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.updatedAt,
    eventType: failed ? 'github.ci.failed' : 'github.ci.completed',
    subjectType: 'github-ci-run',
    subjectId: runId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      repo: record.repo,
      runId: record.runId,
      workflowName: record.workflowName,
      status: record.status,
      conclusion: record.conclusion,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.updatedAt,
      observationType: failed ? 'engineering.ci_failed' : 'engineering.ci_completed',
      subjectType: 'github-ci-run',
      subjectId: runId,
      sourceEventRefs: [eventRef],
      payload: payload({
        repo: record.repo,
        summary: `${record.workflowName} ${record.conclusion ?? record.status}`,
        workflowName: record.workflowName,
        status: record.status,
        conclusion: record.conclusion,
        url: record.url,
      }),
    })
  )
  repo.evidenceRefs.add(evidenceRef)
  if (failed) {
    addBlocker(repo, `CI failed: ${record.workflowName}`)
    repo.nextAction = `Inspect failing CI run ${record.workflowName} in ${record.repo}`
  }
}

function observation(item: PacketObservation): PacketObservation {
  return { confidence: 1, ...item }
}

function ensureRepo(repos: Map<string, RepoProjection>, repo: string): RepoProjection {
  const existing = repos.get(repo)
  if (existing) return existing
  const next: RepoProjection = {
    repo,
    evidenceRefs: new Set(),
    blockers: [],
  }
  repos.set(repo, next)
  return next
}

function addBlocker(repo: RepoProjection, blocker: string) {
  if (!repo.blockers.includes(blocker)) repo.blockers.push(blocker)
}

function payload(input: Record<string, unknown>): Record<string, unknown> {
  return filterUndefined(input) as Record<string, unknown>
}

function firstLine(message: string): string {
  return message.split('\n')[0]?.trim() || message
}

function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

function normalizeReviewState(state: string): string {
  return state.trim().toLowerCase().replace(/\s+/g, '_')
}

function reviewObservationType(state: string): string {
  if (state === 'approved') return 'engineering.review_approved'
  if (state === 'commented') return 'engineering.review_comment'
  return 'engineering.review_recorded'
}

function isFailedCiRun(record: CenterGithubCiRunRecord): boolean {
  return (
    record.conclusion?.toLowerCase() === 'failure' ||
    record.conclusion?.toLowerCase() === 'timed_out' ||
    record.status.toLowerCase() === 'failure'
  )
}
