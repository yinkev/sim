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

const DEFAULT_GITHUB_API_BASE_URL = 'https://api.github.com'

export interface CenterGithubLiveConfig {
  repos: string[]
  token?: string
  baseUrl?: string
}

interface GitHubLiveRequest {
  path: string
}

export function readCenterGithubLiveConfig(
  env: NodeJS.ProcessEnv = process.env
): CenterGithubLiveConfig | null {
  const repos = (env.CENTER_GITHUB_LIVE_REPOS ?? '')
    .split(',')
    .map((repo) => repo.trim())
    .filter((repo) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))
  if (repos.length === 0) return null

  return {
    repos,
    token: env.CENTER_GITHUB_TOKEN ?? env.GITHUB_TOKEN,
    baseUrl: env.CENTER_GITHUB_API_BASE_URL ?? DEFAULT_GITHUB_API_BASE_URL,
  }
}

export async function readCenterGithubLiveSnapshot(
  config: CenterGithubLiveConfig,
  fetchImpl: typeof fetch = fetch
): Promise<CenterGithubSnapshot> {
  const records: CenterGithubRecord[] = []
  for (const repo of config.repos) {
    records.push(...(await readRepoRecords(config, repo, fetchImpl)))
  }

  return {
    sourcePath: `github-live:${config.repos.join(',')}`,
    records,
  }
}

async function readRepoRecords(
  config: CenterGithubLiveConfig,
  repo: string,
  fetchImpl: typeof fetch
): Promise<CenterGithubRecord[]> {
  const [owner, name] = repo.split('/')
  if (!owner || !name) return []

  const [commits, issues, pulls, workflowRuns] = await Promise.all([
    githubJson(config, { path: `/repos/${owner}/${name}/commits?per_page=5` }, fetchImpl),
    githubJson(config, { path: `/repos/${owner}/${name}/issues?state=all&per_page=10` }, fetchImpl),
    githubJson(config, { path: `/repos/${owner}/${name}/pulls?state=all&per_page=10` }, fetchImpl),
    githubJson(config, { path: `/repos/${owner}/${name}/actions/runs?per_page=5` }, fetchImpl),
  ])
  const records: CenterGithubRecord[] = [
    ...readCommitRecords(repo, commits),
    ...readIssueRecords(repo, issues),
    ...readPullRequestRecords(repo, pulls),
    ...readCiRunRecords(repo, workflowRuns),
  ]

  for (const pull of readPullRequestNumbers(pulls).slice(0, 5)) {
    const reviews = await githubJson(
      config,
      { path: `/repos/${owner}/${name}/pulls/${pull}/reviews?per_page=5` },
      fetchImpl
    )
    records.push(...readReviewRecords(repo, pull, reviews))
  }

  return records
}

async function githubJson(
  config: CenterGithubLiveConfig,
  request: GitHubLiveRequest,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const baseUrl = (config.baseUrl ?? DEFAULT_GITHUB_API_BASE_URL).replace(/\/$/, '')
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (config.token) headers.Authorization = `Bearer ${config.token}`

  const response = await fetchImpl(`${baseUrl}${request.path}`, { headers })
  if (!response.ok) {
    throw new Error(`GitHub live producer request failed: ${response.status}`)
  }
  return response.json()
}

function readCommitRecords(repo: string, input: unknown): CenterGithubCommitRecord[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const sha = readString(item, 'sha')
    const commit = readRecord(item, 'commit')
    const author = readRecord(commit, 'author')
    const message = readString(commit, 'message')
    const committedAt = readString(author, 'date')
    if (!sha || !message || !committedAt) return []
    return [
      {
        kind: 'commit',
        repo,
        sha,
        message,
        committedAt,
        author: readString(readRecord(item, 'author'), 'login') ?? readString(author, 'name'),
        url: readString(item, 'html_url'),
      },
    ]
  })
}

function readIssueRecords(repo: string, input: unknown): CenterGithubIssueRecord[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item) => {
    if (!isPlainRecord(item) || isPlainRecord(item.pull_request)) return []
    const number = readNumber(item, 'number')
    const title = readString(item, 'title')
    const state = readString(item, 'state')
    const updatedAt = readString(item, 'updated_at')
    if (number === undefined || !title || !state || !updatedAt) return []
    return [
      {
        kind: 'issue',
        repo,
        number,
        title,
        state,
        updatedAt,
        url: readString(item, 'html_url'),
        labels: readNameList(item.labels),
        assignees: readLoginList(item.assignees),
      },
    ]
  })
}

function readPullRequestRecords(repo: string, input: unknown): CenterGithubPullRequestRecord[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const number = readNumber(item, 'number')
    const title = readString(item, 'title')
    const state = readString(item, 'state')
    const updatedAt = readString(item, 'updated_at')
    if (number === undefined || !title || !state || !updatedAt) return []
    return [
      {
        kind: 'pull_request',
        repo,
        number,
        title,
        state,
        updatedAt,
        url: readString(item, 'html_url'),
        headSha: readString(readRecord(item, 'head'), 'sha'),
        baseRef: readString(readRecord(item, 'base'), 'ref'),
      },
    ]
  })
}

function readReviewRecords(
  repo: string,
  pullNumber: number,
  input: unknown
): CenterGithubReviewRecord[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const reviewId = String(readNumber(item, 'id') ?? readString(item, 'node_id') ?? '')
    const state = readString(item, 'state')
    const submittedAt = readString(item, 'submitted_at')
    if (!reviewId || !state || !submittedAt) return []
    return [
      {
        kind: 'review',
        repo,
        pullNumber,
        reviewId,
        state,
        submittedAt,
        author: readString(readRecord(item, 'user'), 'login'),
        url: readString(item, 'html_url'),
      },
    ]
  })
}

function readCiRunRecords(repo: string, input: unknown): CenterGithubCiRunRecord[] {
  const workflowRuns = readArray(isPlainRecord(input) ? input.workflow_runs : undefined, input)
  return workflowRuns.flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const runId = String(readNumber(item, 'id') ?? '')
    const workflowName = readString(item, 'name')
    const status = readString(item, 'status')
    const updatedAt = readString(item, 'updated_at')
    if (!runId || !workflowName || !status || !updatedAt) return []
    return [
      {
        kind: 'ci_run',
        repo,
        runId,
        workflowName,
        status,
        updatedAt,
        conclusion: readString(item, 'conclusion'),
        headSha: readString(item, 'head_sha'),
        url: readString(item, 'html_url'),
      },
    ]
  })
}

function readPullRequestNumbers(input: unknown): number[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const number = readNumber(item, 'number')
    return number === undefined ? [] : [number]
  })
}

function readArray(primary: unknown, fallback: unknown): unknown[] {
  if (Array.isArray(primary)) return primary
  if (Array.isArray(fallback)) return fallback
  return []
}

function readRecord(input: unknown, key: string): Record<string, unknown> {
  if (!isPlainRecord(input)) return {}
  const value = input[key]
  return isPlainRecord(value) ? value : {}
}

function readString(input: unknown, key: string): string | undefined {
  if (!isPlainRecord(input)) return undefined
  const value = input[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readNumber(input: unknown, key: string): number | undefined {
  if (!isPlainRecord(input)) return undefined
  const value = input[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readNameList(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  const values = input.flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const name = readString(item, 'name')
    return name ? [name] : []
  })
  return values.length > 0 ? values : undefined
}

function readLoginList(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  const values = input.flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const login = readString(item, 'login')
    return login ? [login] : []
  })
  return values.length > 0 ? values : undefined
}
