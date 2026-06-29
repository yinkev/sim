import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CenterReviewPacketImportRecord } from '@/lib/center/review-packets'
import type { CenterReviewPacket } from '@/lib/center/types'

const DEFAULT_REVIEW_DIR = path.join(getRepoRoot(), '.ai-bridge/projects/center/reviews')
const FRONTMATTER_KEYS = new Set([
  'id',
  'type',
  'project',
  'status',
  'round',
  'max_rounds',
  'created',
  'updated',
  'topic',
  'approval_state',
  'worker_gate',
])

interface ParsedFrontmatter {
  id?: string
  type?: string
  project?: string
  status?: string
  round?: string
  max_rounds?: string
  created?: string
  updated?: string
  topic?: string
  approval_state?: string
  worker_gate?: string
}

export async function readCenterReviewPacketRecords(
  reviewDir = process.env.CENTER_REVIEW_PACKET_DIR || DEFAULT_REVIEW_DIR
): Promise<CenterReviewPacketImportRecord[]> {
  const files = await readdir(reviewDir).catch(() => [])
  const records = await Promise.all(
    files
      .filter((file) => file.endsWith('.md'))
      .sort()
      .map(async (file) => parseCenterReviewPacketFile(path.join(reviewDir, file)))
  )
  return records.filter((record): record is CenterReviewPacketImportRecord => !!record)
}

export async function parseCenterReviewPacketFile(
  filePath: string
): Promise<CenterReviewPacketImportRecord | null> {
  const text = await readFile(filePath, 'utf8')
  const frontmatter = parseFrontmatter(text)
  if (frontmatter.type !== 'review-packet' || !frontmatter.id) return null

  const verdict = extractVerdict(text)
  const inferredApprovalState = getApprovalState(frontmatter.status, verdict)
  const approvalState = normalizeApprovalState(frontmatter.approval_state) ?? inferredApprovalState
  const workerGate = normalizeWorkerGate(frontmatter.worker_gate) ?? getWorkerGate(approvalState)
  const title = extractTitle(text) ?? frontmatter.topic ?? frontmatter.id

  return {
    sourceRef: `ai-bridge:review-packet:${frontmatter.id}`,
    packetId: frontmatter.id,
    projectId: frontmatter.project,
    title,
    topic: frontmatter.topic,
    status: normalizeStatus(frontmatter.status),
    approvalState,
    workerGate,
    round: parseInteger(frontmatter.round, 0),
    maxRounds: parseInteger(frontmatter.max_rounds, 20),
    createdAt: frontmatter.created,
    updatedAt: frontmatter.updated,
    uri: filePath,
    payload: {
      status: frontmatter.status,
      approvalState: frontmatter.approval_state,
      workerGate: frontmatter.worker_gate,
      inferredApprovalState,
      verdict,
    },
  }
}

function parseFrontmatter(text: string): ParsedFrontmatter {
  if (!text.startsWith('---')) return {}
  const end = text.indexOf('\n---', 3)
  if (end === -1) return {}
  const block = text.slice(3, end).trim()
  const frontmatter: ParsedFrontmatter = {}

  for (const line of block.split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (FRONTMATTER_KEYS.has(key)) {
      frontmatter[key as keyof ParsedFrontmatter] = stripQuotes(value)
    }
  }

  return frontmatter
}

function normalizeStatus(status: string | undefined): CenterReviewPacket['status'] {
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'deadlocked') return 'deadlocked'
  if (status === 'superseded') return 'superseded'
  if (status === 'converged') return 'converged'
  if (status === 'reviewing') return 'reviewing'
  return 'draft'
}

function getApprovalState(
  status: string | undefined,
  verdict: string | null
): CenterReviewPacket['approvalState'] {
  const normalizedStatus = normalizeStatus(status)
  const normalizedVerdict = verdict?.toLowerCase() ?? ''
  if (normalizedStatus === 'rejected') return 'rejected'
  if (normalizedStatus === 'deadlocked') return 'deadlocked'
  if (normalizedStatus === 'superseded') return 'superseded'
  if (normalizedVerdict.includes('approve with required changes')) {
    return 'approved-with-required-changes'
  }
  if (normalizedVerdict.includes('approve') || normalizedStatus === 'approved') return 'approved'
  if (normalizedStatus === 'converged' || normalizedStatus === 'reviewing') return 'in-review'
  return 'draft'
}

function getWorkerGate(
  approvalState: CenterReviewPacket['approvalState']
): CenterReviewPacket['workerGate'] {
  if (approvalState === 'approved' || approvalState === 'approved-with-required-changes') {
    return 'approved-for-execution'
  }
  if (approvalState === 'rejected' || approvalState === 'deadlocked') return 'blocked'
  return 'review-required'
}

function normalizeApprovalState(
  approvalState: string | undefined
): CenterReviewPacket['approvalState'] | null {
  if (approvalState === 'draft') return 'draft'
  if (approvalState === 'in-review') return 'in-review'
  if (approvalState === 'approved') return 'approved'
  if (approvalState === 'approved-with-required-changes') {
    return 'approved-with-required-changes'
  }
  if (approvalState === 'rejected') return 'rejected'
  if (approvalState === 'deadlocked') return 'deadlocked'
  if (approvalState === 'superseded') return 'superseded'
  return null
}

function normalizeWorkerGate(
  workerGate: string | undefined
): CenterReviewPacket['workerGate'] | null {
  if (workerGate === 'blocked') return 'blocked'
  if (workerGate === 'review-required') return 'review-required'
  if (workerGate === 'approved-for-execution') return 'approved-for-execution'
  return null
}

function extractVerdict(text: string): string | null {
  const match = text.match(/## Verdict\s+([\s\S]*?)(?:\n## |\n# |$)/)
  if (!match) return null
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

function extractTitle(text: string): string | null {
  const match = text.match(/^#\s+(.+)$/m)
  return match?.[1].trim() ?? null
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stripQuotes(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1)
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1)
  return value
}

function getRepoRoot(): string {
  const cwd = process.cwd()
  if (cwd.endsWith(path.join('apps', 'sim'))) return path.resolve(cwd, '../..')
  return cwd
}
