import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isPlainRecord } from '@sim/utils/object'
import type {
  CenterGithubCiRunRecord,
  CenterGithubCommitRecord,
  CenterGithubIssueRecord,
  CenterGithubPullRequestRecord,
  CenterGithubRecord,
  CenterGithubReviewRecord,
  CenterGithubSnapshot,
} from '@/lib/center/producers/github'

const DEFAULT_GITHUB_PRODUCER_FILE = path.join(
  getRepoRoot(),
  'apps/sim/fixtures/center/producers/github/sample-events.json'
)

export async function readCenterGithubSnapshot(
  filePath = process.env.CENTER_GITHUB_PRODUCER_FILE || DEFAULT_GITHUB_PRODUCER_FILE
): Promise<CenterGithubSnapshot> {
  const text = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(text) as unknown
  return {
    sourcePath: filePath,
    records: normalizeCenterGithubRecords(parsed),
  }
}

export function normalizeCenterGithubRecords(input: unknown): CenterGithubRecord[] {
  const rawRecords =
    isPlainRecord(input) && Array.isArray(input.records)
      ? input.records
      : Array.isArray(input)
        ? input
        : []
  return rawRecords
    .map((record) => normalizeCenterGithubRecord(record))
    .filter((record): record is CenterGithubRecord => !!record)
}

function normalizeCenterGithubRecord(input: unknown): CenterGithubRecord | null {
  if (!isPlainRecord(input)) return null
  const kind = readString(input, 'kind')
  if (kind === 'commit') return normalizeCommit(input)
  if (kind === 'issue') return normalizeIssue(input)
  if (kind === 'pull_request') return normalizePullRequest(input)
  if (kind === 'review') return normalizeReview(input)
  if (kind === 'ci_run') return normalizeCiRun(input)
  return null
}

function normalizeCommit(input: Record<string, unknown>): CenterGithubCommitRecord | null {
  const repo = readString(input, 'repo')
  const sha = readString(input, 'sha')
  const message = readString(input, 'message')
  const committedAt = readString(input, 'committedAt')
  if (!repo || !sha || !message || !committedAt) return null
  return {
    kind: 'commit',
    repo,
    sha,
    message,
    committedAt,
    author: readString(input, 'author'),
    branch: readString(input, 'branch'),
    url: readString(input, 'url'),
    status: readString(input, 'status'),
  }
}

function normalizeIssue(input: Record<string, unknown>): CenterGithubIssueRecord | null {
  const repo = readString(input, 'repo')
  const number = readNumber(input, 'number')
  const title = readString(input, 'title')
  const state = readString(input, 'state')
  const updatedAt = readString(input, 'updatedAt')
  if (!repo || number === undefined || !title || !state || !updatedAt) return null
  return {
    kind: 'issue',
    repo,
    number,
    title,
    state,
    updatedAt,
    url: readString(input, 'url'),
    labels: readStringArray(input, 'labels'),
    assignees: readStringArray(input, 'assignees'),
  }
}

function normalizePullRequest(
  input: Record<string, unknown>
): CenterGithubPullRequestRecord | null {
  const repo = readString(input, 'repo')
  const number = readNumber(input, 'number')
  const title = readString(input, 'title')
  const state = readString(input, 'state')
  const updatedAt = readString(input, 'updatedAt')
  if (!repo || number === undefined || !title || !state || !updatedAt) return null
  return {
    kind: 'pull_request',
    repo,
    number,
    title,
    state,
    updatedAt,
    url: readString(input, 'url'),
    headSha: readString(input, 'headSha'),
    baseRef: readString(input, 'baseRef'),
  }
}

function normalizeReview(input: Record<string, unknown>): CenterGithubReviewRecord | null {
  const repo = readString(input, 'repo')
  const pullNumber = readNumber(input, 'pullNumber')
  const reviewId = readString(input, 'reviewId')
  const state = readString(input, 'state')
  const submittedAt = readString(input, 'submittedAt')
  if (!repo || pullNumber === undefined || !reviewId || !state || !submittedAt) return null
  return {
    kind: 'review',
    repo,
    pullNumber,
    reviewId,
    state,
    submittedAt,
    author: readString(input, 'author'),
    url: readString(input, 'url'),
  }
}

function normalizeCiRun(input: Record<string, unknown>): CenterGithubCiRunRecord | null {
  const repo = readString(input, 'repo')
  const runId = readString(input, 'runId')
  const workflowName = readString(input, 'workflowName')
  const status = readString(input, 'status')
  const updatedAt = readString(input, 'updatedAt')
  if (!repo || !runId || !workflowName || !status || !updatedAt) return null
  return {
    kind: 'ci_run',
    repo,
    runId,
    workflowName,
    status,
    updatedAt,
    conclusion: readString(input, 'conclusion'),
    headSha: readString(input, 'headSha'),
    url: readString(input, 'url'),
  }
}

function readString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function readStringArray(input: Record<string, unknown>, key: string): string[] | undefined {
  const value = input[key]
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function getRepoRoot(): string {
  const cwd = process.cwd()
  if (cwd.endsWith(path.join('apps', 'sim'))) return path.resolve(cwd, '../..')
  return cwd
}
