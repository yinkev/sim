import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isPlainRecord } from '@sim/utils/object'
import type {
  CenterWorkerArtifactRecord,
  CenterWorkerDiffRecord,
  CenterWorkerFailureRecord,
  CenterWorkerLaneRecord,
  CenterWorkerLaneSnapshot,
  CenterWorkerReviewNeededRecord,
  CenterWorkerRunCompletedRecord,
  CenterWorkerRunStartedRecord,
  CenterWorkerTestResultRecord,
} from '@/lib/center/producers/worker-lane'

const DEFAULT_WORKER_LANE_PRODUCER_FILE = path.join(
  getRepoRoot(),
  '.ai-bridge/projects/worker-lane/sample-events.json'
)

export async function readCenterWorkerLaneSnapshot(
  filePath = process.env.CENTER_WORKER_LANE_PRODUCER_FILE || DEFAULT_WORKER_LANE_PRODUCER_FILE
): Promise<CenterWorkerLaneSnapshot> {
  const text = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(text) as unknown
  return {
    sourcePath: filePath,
    records: normalizeCenterWorkerLaneRecords(parsed),
  }
}

export function normalizeCenterWorkerLaneRecords(input: unknown): CenterWorkerLaneRecord[] {
  const rawRecords =
    isPlainRecord(input) && Array.isArray(input.records)
      ? input.records
      : Array.isArray(input)
        ? input
        : []
  return rawRecords
    .map((record) => normalizeCenterWorkerLaneRecord(record))
    .filter((record): record is CenterWorkerLaneRecord => !!record)
}

function normalizeCenterWorkerLaneRecord(input: unknown): CenterWorkerLaneRecord | null {
  if (!isPlainRecord(input)) return null
  const kind = readString(input, 'kind')
  if (kind === 'run_started') return normalizeRunStarted(input)
  if (kind === 'run_completed') return normalizeRunCompleted(input)
  if (kind === 'failure') return normalizeFailure(input)
  if (kind === 'diff') return normalizeDiff(input)
  if (kind === 'test_result') return normalizeTestResult(input)
  if (kind === 'artifact') return normalizeArtifact(input)
  if (kind === 'review_needed') return normalizeReviewNeeded(input)
  return null
}

function normalizeRunStarted(input: Record<string, unknown>): CenterWorkerRunStartedRecord | null {
  const base = readBase(input)
  const startedAt = readString(input, 'startedAt')
  if (!base || !startedAt) return null
  return {
    ...base,
    kind: 'run_started',
    startedAt,
    command: readString(input, 'command'),
  }
}

function normalizeRunCompleted(
  input: Record<string, unknown>
): CenterWorkerRunCompletedRecord | null {
  const base = readBase(input)
  const completedAt = readString(input, 'completedAt')
  const status = readString(input, 'status')
  if (!base || !completedAt || !status) return null
  return {
    ...base,
    kind: 'run_completed',
    completedAt,
    status,
    durationMs: readNumber(input, 'durationMs'),
  }
}

function normalizeFailure(input: Record<string, unknown>): CenterWorkerFailureRecord | null {
  const base = readBase(input)
  const failureId = readString(input, 'failureId')
  const title = readString(input, 'title')
  const failedAt = readString(input, 'failedAt')
  const severity = readString(input, 'severity')
  if (!base || !failureId || !title || !failedAt || !severity) return null
  return {
    ...base,
    kind: 'failure',
    failureId,
    title,
    failedAt,
    severity,
    message: readString(input, 'message'),
  }
}

function normalizeDiff(input: Record<string, unknown>): CenterWorkerDiffRecord | null {
  const base = readBase(input)
  const diffId = readString(input, 'diffId')
  const title = readString(input, 'title')
  const changedAt = readString(input, 'changedAt')
  if (!base || !diffId || !title || !changedAt) return null
  return {
    ...base,
    kind: 'diff',
    diffId,
    title,
    changedAt,
    filesChanged: readNumber(input, 'filesChanged'),
    insertions: readNumber(input, 'insertions'),
    deletions: readNumber(input, 'deletions'),
  }
}

function normalizeTestResult(input: Record<string, unknown>): CenterWorkerTestResultRecord | null {
  const base = readBase(input)
  const testId = readString(input, 'testId')
  const title = readString(input, 'title')
  const status = readString(input, 'status')
  const finishedAt = readString(input, 'finishedAt')
  if (!base || !testId || !title || !status || !finishedAt) return null
  return {
    ...base,
    kind: 'test_result',
    testId,
    title,
    status,
    finishedAt,
    passed: readNumber(input, 'passed'),
    failed: readNumber(input, 'failed'),
  }
}

function normalizeArtifact(input: Record<string, unknown>): CenterWorkerArtifactRecord | null {
  const base = readBase(input)
  const artifactId = readString(input, 'artifactId')
  const title = readString(input, 'title')
  const artifactKind = readString(input, 'artifactKind')
  const createdAt = readString(input, 'createdAt')
  if (!base || !artifactId || !title || !artifactKind || !createdAt) return null
  return {
    ...base,
    kind: 'artifact',
    artifactId,
    title,
    artifactKind,
    createdAt,
  }
}

function normalizeReviewNeeded(
  input: Record<string, unknown>
): CenterWorkerReviewNeededRecord | null {
  const base = readBase(input)
  const reviewId = readString(input, 'reviewId')
  const title = readString(input, 'title')
  const reason = readString(input, 'reason')
  const requestedAt = readString(input, 'requestedAt')
  if (!base || !reviewId || !title || !reason || !requestedAt) return null
  return {
    ...base,
    kind: 'review_needed',
    reviewId,
    title,
    reason,
    requestedAt,
    authorityRequired: readString(input, 'authorityRequired'),
  }
}

function readBase(input: Record<string, unknown>) {
  const producerId = readString(input, 'producerId')
  const runId = readString(input, 'runId')
  const loopKey = readString(input, 'loopKey')
  const loopTitle = readString(input, 'loopTitle')
  const taskTitle = readString(input, 'taskTitle')
  if (!producerId || !runId || !loopKey || !loopTitle || !taskTitle) return null
  return {
    producerId,
    producerDisplayName: readString(input, 'producerDisplayName'),
    runId,
    loopKey,
    loopTitle,
    taskTitle,
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
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function getRepoRoot(): string {
  const cwd = process.cwd()
  if (cwd.endsWith(path.join('apps', 'sim'))) return path.resolve(cwd, '../..')
  return cwd
}
