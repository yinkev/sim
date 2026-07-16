import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isPlainRecord } from '@sim/utils/object'
import type {
  CenterPlaneCommentRecord,
  CenterPlaneCycleRecord,
  CenterPlaneIssueRecord,
  CenterPlaneModuleRecord,
  CenterPlaneProjectRecord,
  CenterPlaneRecord,
  CenterPlaneSnapshot,
  CenterPlaneStatusRecord,
} from '@/lib/center/producers/plane'

const DEFAULT_PLANE_PRODUCER_FILE = path.join(
  getRepoRoot(),
  'apps/sim/fixtures/center/producers/plane/sample-events.json'
)

export async function readCenterPlaneSnapshot(
  filePath = process.env.CENTER_PLANE_PRODUCER_FILE || DEFAULT_PLANE_PRODUCER_FILE
): Promise<CenterPlaneSnapshot> {
  const text = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(text) as unknown
  return {
    sourcePath: filePath,
    records: normalizeCenterPlaneRecords(parsed),
  }
}

export function normalizeCenterPlaneRecords(input: unknown): CenterPlaneRecord[] {
  const rawRecords =
    isPlainRecord(input) && Array.isArray(input.records)
      ? input.records
      : Array.isArray(input)
        ? input
        : []
  return rawRecords
    .map((record) => normalizeCenterPlaneRecord(record))
    .filter((record): record is CenterPlaneRecord => !!record)
}

function normalizeCenterPlaneRecord(input: unknown): CenterPlaneRecord | null {
  if (!isPlainRecord(input)) return null
  const kind = readString(input, 'kind')
  if (kind === 'project') return normalizeProject(input)
  if (kind === 'cycle') return normalizeCycle(input)
  if (kind === 'module') return normalizeModule(input)
  if (kind === 'issue') return normalizeIssue(input)
  if (kind === 'comment') return normalizeComment(input)
  if (kind === 'status') return normalizeStatus(input)
  return null
}

function normalizeProject(input: Record<string, unknown>): CenterPlaneProjectRecord | null {
  const base = readBase(input)
  const name = readString(input, 'name')
  const status = readString(input, 'status')
  const updatedAt = readString(input, 'updatedAt')
  if (!base || !name || !status || !updatedAt) return null
  return {
    kind: 'project',
    ...base,
    name,
    status,
    updatedAt,
    lead: readString(input, 'lead'),
    url: readString(input, 'url'),
  }
}

function normalizeCycle(input: Record<string, unknown>): CenterPlaneCycleRecord | null {
  const base = readBase(input)
  const cycleId = readString(input, 'cycleId')
  const name = readString(input, 'name')
  const status = readString(input, 'status')
  const updatedAt = readString(input, 'updatedAt')
  if (!base || !cycleId || !name || !status || !updatedAt) return null
  return {
    kind: 'cycle',
    ...base,
    cycleId,
    name,
    status,
    updatedAt,
    startsAt: readString(input, 'startsAt'),
    endsAt: readString(input, 'endsAt'),
    url: readString(input, 'url'),
  }
}

function normalizeModule(input: Record<string, unknown>): CenterPlaneModuleRecord | null {
  const base = readBase(input)
  const moduleId = readString(input, 'moduleId')
  const name = readString(input, 'name')
  const status = readString(input, 'status')
  const updatedAt = readString(input, 'updatedAt')
  if (!base || !moduleId || !name || !status || !updatedAt) return null
  return {
    kind: 'module',
    ...base,
    moduleId,
    name,
    status,
    updatedAt,
    owner: readString(input, 'owner'),
    url: readString(input, 'url'),
  }
}

function normalizeIssue(input: Record<string, unknown>): CenterPlaneIssueRecord | null {
  const base = readBase(input)
  const issueId = readString(input, 'issueId')
  const title = readString(input, 'title')
  const status = readString(input, 'status')
  const updatedAt = readString(input, 'updatedAt')
  if (!base || !issueId || !title || !status || !updatedAt) return null
  return {
    kind: 'issue',
    ...base,
    issueId,
    title,
    status,
    updatedAt,
    assignee: readString(input, 'assignee'),
    cycleId: readString(input, 'cycleId'),
    dueAt: readString(input, 'dueAt'),
    moduleId: readString(input, 'moduleId'),
    priority: readString(input, 'priority'),
    sequenceId: readString(input, 'sequenceId'),
    url: readString(input, 'url'),
  }
}

function normalizeComment(input: Record<string, unknown>): CenterPlaneCommentRecord | null {
  const base = readBase(input)
  const issueId = readString(input, 'issueId')
  const commentId = readString(input, 'commentId')
  const body = readString(input, 'body')
  const createdAt = readString(input, 'createdAt')
  if (!base || !issueId || !commentId || !body || !createdAt) return null
  return {
    kind: 'comment',
    ...base,
    issueId,
    commentId,
    body,
    createdAt,
    author: readString(input, 'author'),
    url: readString(input, 'url'),
  }
}

function normalizeStatus(input: Record<string, unknown>): CenterPlaneStatusRecord | null {
  const base = readBase(input)
  const issueId = readString(input, 'issueId')
  const toStatus = readString(input, 'toStatus')
  const changedAt = readString(input, 'changedAt')
  if (!base || !issueId || !toStatus || !changedAt) return null
  return {
    kind: 'status',
    ...base,
    issueId,
    toStatus,
    changedAt,
    actor: readString(input, 'actor'),
    fromStatus: readString(input, 'fromStatus'),
    sequenceId: readString(input, 'sequenceId'),
    title: readString(input, 'title'),
    url: readString(input, 'url'),
  }
}

function readBase(input: Record<string, unknown>): { workspace: string; projectId: string } | null {
  const workspace = readString(input, 'workspace')
  const projectId = readString(input, 'projectId')
  if (!workspace || !projectId) return null
  return { workspace, projectId }
}

function readString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function getRepoRoot(): string {
  const cwd = process.cwd()
  if (cwd.endsWith(path.join('apps', 'sim'))) return path.resolve(cwd, '../..')
  return cwd
}
