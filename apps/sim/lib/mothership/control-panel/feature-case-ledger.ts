import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import {
  type FeatureCaseLedgerEvent,
  featureCaseLedgerEventSchema,
  type GetMothershipFeatureCaseArtifactQuery,
  type ListMothershipFeatureCasesQuery,
  type MothershipControlPanelCase,
  type MothershipFeatureCaseArtifact,
} from '@/lib/api/contracts/mothership-control-panel'

export const DEFAULT_FEATURE_CASE_LEDGER_PATH =
  'docs/superpowers/ledgers/mothership-feature-cases.jsonl'
const MAX_FEATURE_CASE_ARTIFACT_BYTES = 2 * 1024 * 1024

interface ReadFeatureCaseLedgerOptions extends Partial<ListMothershipFeatureCasesQuery> {
  ledgerPath?: string
  repoRoot?: string
}

interface ReadFeatureCaseLedgerResult {
  ledgerPath: string
  eventCount: number
  cases: MothershipControlPanelCase[]
}

interface ReadFeatureCaseLedgerEventsResult {
  repoRoot: string
  ledgerPath: string
  events: FeatureCaseLedgerEvent[]
}

interface ReadFeatureCaseArtifactOptions extends GetMothershipFeatureCaseArtifactQuery {
  ledgerPath?: string
  repoRoot?: string
}

interface ReadFeatureCaseArtifactResult {
  path: string
  filename: string
  contentType: string
  content: string
}

export class FeatureCaseArtifactNotFoundError extends Error {}

export class FeatureCaseArtifactForbiddenError extends Error {}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function digestValue(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function findRepoRoot(startDir: string): string {
  let current = resolve(startDir)
  while (true) {
    if (existsSync(join(current, DEFAULT_FEATURE_CASE_LEDGER_PATH))) return current
    const parent = dirname(current)
    if (parent === current) return resolve(startDir)
    current = parent
  }
}

function repoRelativePath(repoRoot: string, absolutePath: string): string {
  const relativePath = relative(repoRoot, absolutePath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('FeatureCase ledger path must stay inside repo root')
  }
  return relativePath.split('/').join('/')
}

function resolveRepoPath(repoRoot: string, path: string): string {
  if (isAbsolute(path)) return path
  if (path.split('/').includes('..')) {
    throw new Error('FeatureCase ledger path must be repo-relative')
  }
  return resolve(repoRoot, path)
}

function resolveLedgerPath(options: ReadFeatureCaseLedgerOptions): {
  repoRoot: string
  absolutePath: string
  relativePath: string
} {
  const repoRoot = resolve(options.repoRoot ?? findRepoRoot(process.cwd()))
  const configuredPath =
    options.ledgerPath ??
    process.env.MOTHERSHIP_FEATURE_CASE_LEDGER_PATH ??
    DEFAULT_FEATURE_CASE_LEDGER_PATH
  const absolutePath = resolveRepoPath(repoRoot, configuredPath)
  return {
    repoRoot,
    absolutePath,
    relativePath: repoRelativePath(repoRoot, absolutePath),
  }
}

function isPathInside(basePath: string, targetPath: string): boolean {
  const relativePath = relative(resolve(basePath), resolve(targetPath))
  return !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

function assertPathInside(basePath: string, targetPath: string, message: string): void {
  if (!isPathInside(basePath, targetPath)) {
    throw new FeatureCaseArtifactForbiddenError(message)
  }
}

function assertRealPathInside(basePath: string, targetPath: string, message: string): void {
  const realBasePath = realpathSync(basePath)
  const realTargetPath = realpathSync(targetPath)
  if (!isPathInside(realBasePath, realTargetPath)) {
    throw new FeatureCaseArtifactForbiddenError(message)
  }
}

function assertRealPathInsideOrThrow(basePath: string, targetPath: string, message: string): void {
  const realBasePath = realpathSync(basePath)
  const realTargetPath = realpathSync(targetPath)
  const relativePath = relative(realBasePath, realTargetPath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(message)
  }
}

function parseEvent(lineText: string, source: string, line: number): FeatureCaseLedgerEvent {
  let parsed: unknown
  try {
    parsed = JSON.parse(lineText) as unknown
  } catch {
    throw new Error(`${source}:${line}: event must be valid JSON`)
  }

  const eventRecord = asRecord(parsed)
  const event = featureCaseLedgerEventSchema.parse(parsed)
  if (!eventRecord) throw new Error(`${source}:${line}: event must be object`)

  if (digestValue(eventRecord.case) !== event.caseDigest) {
    throw new Error(`${source}:${line}: caseDigest does not match embedded case`)
  }
  const { entryDigest: _entryDigest, ...eventWithoutEntryDigest } = eventRecord
  if (digestValue(eventWithoutEntryDigest) !== event.entryDigest) {
    throw new Error(`${source}:${line}: entryDigest does not match event payload`)
  }
  return event
}

function validateCasePathDigest(
  repoRoot: string,
  event: FeatureCaseLedgerEvent,
  source: string,
  line: number
): void {
  if (isAbsolute(event.casePath)) {
    throw new Error(`${source}:${line}: casePath must be repo-relative`)
  }
  const absoluteCasePath = resolveRepoPath(repoRoot, event.casePath)
  if (!existsSync(absoluteCasePath)) {
    throw new Error(`${source}:${line}: casePath does not exist: ${event.casePath}`)
  }
  assertRealPathInsideOrThrow(
    repoRoot,
    absoluteCasePath,
    `${source}:${line}: casePath must stay inside repo root`
  )

  const currentCase = JSON.parse(readFileSync(realpathSync(absoluteCasePath), 'utf8')) as unknown
  if (digestValue(currentCase) !== event.caseDigest) {
    throw new Error(`${source}:${line}: casePath content does not match caseDigest`)
  }
}

function toControlPanelCase(event: FeatureCaseLedgerEvent): MothershipControlPanelCase {
  return {
    sequence: event.sequence,
    eventId: event.eventId,
    appendedAt: event.appendedAt,
    caseId: event.caseId,
    casePath: event.casePath,
    caseDigest: event.caseDigest,
    previousEntryDigest: event.previousEntryDigest,
    entryDigest: event.entryDigest,
    coverageAuditPath: event.coverageAuditPath,
    handoffPath: event.handoffPath,
    state: event.summary.state,
    decision: event.summary.decision,
    grade: event.summary.grade,
    nextAction: event.summary.nextAction,
    claimsAdvanced: event.case.grade.claimsAdvanced,
    nonClaims: event.case.grade.nonClaims,
    blockers: event.case.blockers ?? [],
    evidenceCommands: event.case.evidence.commands,
    reviews: event.case.reviews,
  }
}

function readFeatureCaseLedgerEvents(
  options: Pick<ReadFeatureCaseLedgerOptions, 'ledgerPath' | 'repoRoot'> = {}
): ReadFeatureCaseLedgerEventsResult {
  const { repoRoot, absolutePath, relativePath } = resolveLedgerPath(options)
  if (!existsSync(absolutePath)) {
    throw new Error(`${relativePath}: FeatureCase ledger does not exist`)
  }
  assertRealPathInsideOrThrow(
    repoRoot,
    absolutePath,
    `${relativePath}: FeatureCase ledger path must stay inside repo root`
  )

  const text = readFileSync(realpathSync(absolutePath), 'utf8')
  if (text.length === 0) {
    throw new Error(`${relativePath}: FeatureCase ledger must include at least one event`)
  }

  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  const lines = body.split('\n')
  const events: FeatureCaseLedgerEvent[] = []
  const seenEventIds = new Set<string>()

  for (const [index, lineText] of lines.entries()) {
    const line = index + 1
    if (!lineText.trim()) throw new Error(`${relativePath}:${line}: blank lines are not allowed`)

    const event = parseEvent(lineText, relativePath, line)
    validateCasePathDigest(repoRoot, event, relativePath, line)

    if (seenEventIds.has(event.eventId)) {
      throw new Error(`${relativePath}:${line}: duplicate eventId: ${event.eventId}`)
    }
    seenEventIds.add(event.eventId)

    const previousEvent = events.at(-1)
    const expectedSequence = previousEvent ? previousEvent.sequence + 1 : 1
    if (event.sequence !== expectedSequence) {
      throw new Error(`${relativePath}:${line}: sequence must be ${expectedSequence}`)
    }

    const expectedPreviousDigest = previousEvent?.entryDigest ?? null
    if (event.previousEntryDigest !== expectedPreviousDigest) {
      throw new Error(`${relativePath}:${line}: previousEntryDigest does not match previous entry`)
    }

    if (previousEvent && previousEvent.appendedAt > event.appendedAt) {
      throw new Error(`${relativePath}:${line}: appendedAt timestamps must be nondecreasing`)
    }

    events.push(event)
  }

  return { repoRoot, ledgerPath: relativePath, events }
}

function artifactPathForEvent(
  event: FeatureCaseLedgerEvent,
  artifact: MothershipFeatureCaseArtifact
): string {
  if (artifact === 'case') return event.casePath
  if (artifact === 'coverage-audit') return event.coverageAuditPath
  return event.handoffPath
}

function resolveArtifactPath(
  repoRoot: string,
  path: string,
  artifact: MothershipFeatureCaseArtifact
): { absolutePath: string; displayPath: string } {
  if (artifact === 'handoff') {
    if (!isAbsolute(path)) {
      throw new FeatureCaseArtifactForbiddenError(
        'FeatureCase handoff artifact path must be absolute'
      )
    }
    if (!/sim-mothership.*handoff.*\.md$/.test(basename(path))) {
      throw new FeatureCaseArtifactForbiddenError(
        'FeatureCase handoff artifact path is not allowed'
      )
    }
    assertPathInside(tmpdir(), path, 'FeatureCase handoff artifact must stay inside temp directory')
    return { absolutePath: resolve(path), displayPath: path }
  }

  if (isAbsolute(path) || path.split('/').includes('..')) {
    throw new FeatureCaseArtifactForbiddenError('FeatureCase artifact path must be repo-relative')
  }

  const absolutePath = resolveRepoPath(repoRoot, path)
  assertPathInside(repoRoot, absolutePath, 'FeatureCase artifact must stay inside repo root')
  return { absolutePath, displayPath: path }
}

export function readFeatureCaseArtifact(
  options: ReadFeatureCaseArtifactOptions
): ReadFeatureCaseArtifactResult {
  const { repoRoot, events } = readFeatureCaseLedgerEvents(options)
  const event = events.find((ledgerEvent) => ledgerEvent.eventId === options.eventId)
  if (!event) {
    throw new FeatureCaseArtifactNotFoundError(`FeatureCase event not found: ${options.eventId}`)
  }

  const artifactPath = artifactPathForEvent(event, options.artifact)
  const { absolutePath, displayPath } = resolveArtifactPath(
    repoRoot,
    artifactPath,
    options.artifact
  )
  if (!existsSync(absolutePath)) {
    throw new FeatureCaseArtifactNotFoundError(
      `FeatureCase artifact does not exist: ${displayPath}`
    )
  }
  assertRealPathInside(
    options.artifact === 'handoff' ? tmpdir() : repoRoot,
    absolutePath,
    options.artifact === 'handoff'
      ? 'FeatureCase handoff artifact must stay inside temp directory'
      : 'FeatureCase artifact must stay inside repo root'
  )

  const realPath = realpathSync(absolutePath)
  const stat = statSync(realPath)
  if (!stat.isFile()) {
    throw new FeatureCaseArtifactForbiddenError(
      `FeatureCase artifact is not a file: ${displayPath}`
    )
  }
  if (stat.size > MAX_FEATURE_CASE_ARTIFACT_BYTES) {
    throw new FeatureCaseArtifactForbiddenError(`FeatureCase artifact is too large: ${displayPath}`)
  }

  return {
    path: displayPath,
    filename: basename(realPath),
    contentType: 'text/plain; charset=utf-8',
    content: readFileSync(realPath, 'utf8'),
  }
}

export function readFeatureCaseLedger(
  options: ReadFeatureCaseLedgerOptions = {}
): ReadFeatureCaseLedgerResult {
  const { ledgerPath, events } = readFeatureCaseLedgerEvents(options)

  const caseId = options.caseId
  const limit = options.limit ?? 100
  const cases = events
    .filter((event) => !caseId || event.caseId === caseId)
    .slice(-limit)
    .reverse()
    .map(toControlPanelCase)

  return {
    ledgerPath,
    eventCount: events.length,
    cases,
  }
}
