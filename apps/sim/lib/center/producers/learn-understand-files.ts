import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isPlainRecord } from '@sim/utils/object'
import type {
  CenterDependencyObservationRecord,
  CenterLearningGapRecord,
  CenterLearnUnderstandRecord,
  CenterLearnUnderstandSnapshot,
  CenterPracticeTaskRecord,
  CenterReviewEvidenceRecord,
  CenterRiskEvidenceRecord,
  CenterSystemMapRecord,
} from '@/lib/center/producers/learn-understand'

const DEFAULT_LEARN_UNDERSTAND_PRODUCER_FILE = path.join(
  getRepoRoot(),
  '.ai-bridge/projects/learn-understand-producers/sample-events.json'
)

export async function readCenterLearnUnderstandSnapshot(
  filePath = process.env.CENTER_LEARN_UNDERSTAND_PRODUCER_FILE ||
    DEFAULT_LEARN_UNDERSTAND_PRODUCER_FILE
): Promise<CenterLearnUnderstandSnapshot> {
  const text = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(text) as unknown
  return {
    sourcePath: filePath,
    records: normalizeCenterLearnUnderstandRecords(parsed),
  }
}

export function normalizeCenterLearnUnderstandRecords(
  input: unknown
): CenterLearnUnderstandRecord[] {
  const rawRecords =
    isPlainRecord(input) && Array.isArray(input.records)
      ? input.records
      : Array.isArray(input)
        ? input
        : []
  return rawRecords
    .map((record) => normalizeCenterLearnUnderstandRecord(record))
    .filter((record): record is CenterLearnUnderstandRecord => !!record)
}

function normalizeCenterLearnUnderstandRecord(input: unknown): CenterLearnUnderstandRecord | null {
  if (!isPlainRecord(input)) return null
  const kind = readString(input, 'kind')
  if (kind === 'learning_gap') return normalizeLearningGap(input)
  if (kind === 'practice_task') return normalizePracticeTask(input)
  if (kind === 'review_evidence') return normalizeReviewEvidence(input)
  if (kind === 'system_map') return normalizeSystemMap(input)
  if (kind === 'dependency_observation') return normalizeDependencyObservation(input)
  if (kind === 'risk_evidence') return normalizeRiskEvidence(input)
  return null
}

function normalizeLearningGap(input: Record<string, unknown>): CenterLearningGapRecord | null {
  const gapId = readString(input, 'gapId')
  const topic = readString(input, 'topic')
  const title = readString(input, 'title')
  const severity = readString(input, 'severity')
  const detectedAt = readString(input, 'detectedAt')
  if (!gapId || !topic || !title || !severity || !detectedAt) return null
  return {
    kind: 'learning_gap',
    gapId,
    topic,
    title,
    severity,
    detectedAt,
    source: readString(input, 'source'),
    url: readString(input, 'url'),
  }
}

function normalizePracticeTask(input: Record<string, unknown>): CenterPracticeTaskRecord | null {
  const taskId = readString(input, 'taskId')
  const topic = readString(input, 'topic')
  const title = readString(input, 'title')
  const status = readString(input, 'status')
  const createdAt = readString(input, 'createdAt')
  if (!taskId || !topic || !title || !status || !createdAt) return null
  return {
    kind: 'practice_task',
    taskId,
    topic,
    title,
    status,
    createdAt,
    dueAt: readString(input, 'dueAt'),
    url: readString(input, 'url'),
  }
}

function normalizeReviewEvidence(
  input: Record<string, unknown>
): CenterReviewEvidenceRecord | null {
  const evidenceId = readString(input, 'evidenceId')
  const topic = readString(input, 'topic')
  const title = readString(input, 'title')
  const result = readString(input, 'result')
  const reviewedAt = readString(input, 'reviewedAt')
  if (!evidenceId || !topic || !title || !result || !reviewedAt) return null
  return {
    kind: 'review_evidence',
    evidenceId,
    topic,
    title,
    result,
    reviewedAt,
    score: readNumber(input, 'score'),
    url: readString(input, 'url'),
  }
}

function normalizeSystemMap(input: Record<string, unknown>): CenterSystemMapRecord | null {
  const mapId = readString(input, 'mapId')
  const scope = readString(input, 'scope')
  const title = readString(input, 'title')
  const generatedAt = readString(input, 'generatedAt')
  if (!mapId || !scope || !title || !generatedAt) return null
  return {
    kind: 'system_map',
    mapId,
    scope,
    title,
    generatedAt,
    edgeCount: readNumber(input, 'edgeCount'),
    nodeCount: readNumber(input, 'nodeCount'),
    url: readString(input, 'url'),
  }
}

function normalizeDependencyObservation(
  input: Record<string, unknown>
): CenterDependencyObservationRecord | null {
  const observationId = readString(input, 'observationId')
  const scope = readString(input, 'scope')
  const from = readString(input, 'from')
  const to = readString(input, 'to')
  const relation = readString(input, 'relation')
  const observedAt = readString(input, 'observedAt')
  if (!observationId || !scope || !from || !to || !relation || !observedAt) return null
  return {
    kind: 'dependency_observation',
    observationId,
    scope,
    from,
    to,
    relation,
    observedAt,
    risk: readString(input, 'risk'),
    url: readString(input, 'url'),
  }
}

function normalizeRiskEvidence(input: Record<string, unknown>): CenterRiskEvidenceRecord | null {
  const riskId = readString(input, 'riskId')
  const scope = readString(input, 'scope')
  const title = readString(input, 'title')
  const severity = readString(input, 'severity')
  const detectedAt = readString(input, 'detectedAt')
  if (!riskId || !scope || !title || !severity || !detectedAt) return null
  return {
    kind: 'risk_evidence',
    riskId,
    scope,
    title,
    severity,
    detectedAt,
    area: readString(input, 'area'),
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
