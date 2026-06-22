#!/usr/bin/env bun
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { getErrorMessage } from '@sim/utils/errors'
import { validateCase } from './check-mothership-feature-case.ts'

const ROOT = process.cwd()
const DEFAULT_LEDGER = 'docs/superpowers/ledgers/mothership-feature-cases.jsonl'
const DEFAULT_COVERAGE_AUDIT = 'docs/superpowers/plans/mothership-replacement-coverage-audit.md'
const EVENT_TYPE = 'feature_case.snapshot.v1'
const LEDGER_VERSION = 1

interface FeatureCaseSummary {
  state: string
  decision: string
  grade: string
  nextAction: string
}

interface FeatureCaseLedgerEvent {
  ledgerVersion: 1
  sequence: number
  eventId: string
  type: typeof EVENT_TYPE
  appendedAt: string
  caseId: string
  casePath: string
  caseDigest: string
  previousEntryDigest: string | null
  entryDigest: string
  coverageAuditPath: string
  handoffPath: string
  summary: FeatureCaseSummary
  case: unknown
}

interface LedgerCheckResult {
  errors: string[]
  events: Array<FeatureCaseLedgerEvent & { line: number }>
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

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
  return JSON.stringify(value)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function digestValue(value: unknown): string {
  return sha256(stableStringify(value))
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new Error(`${label}: invalid JSON: ${getErrorMessage(error)}`)
  }
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {}
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index]
    if (!key?.startsWith('--')) {
      throw new Error(`unexpected argument: ${key}`)
    }
    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`${key} requires a value`)
    }
    flags[key.slice(2)] = value
    index += 1
  }
  return flags
}

function repoRelativePath(path: string, label: string): string {
  const absolutePath = resolve(ROOT, path)
  const relativePath = relative(ROOT, absolutePath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside repo root`)
  }
  return relativePath.split('/').join('/')
}

function resolveRepoPath(path: string, label: string): string {
  if (isAbsolute(path) || path.split('/').includes('..')) {
    throw new Error(`${label} must be repo-relative`)
  }
  const absolutePath = resolve(ROOT, path)
  const relativePath = relative(ROOT, absolutePath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside repo root`)
  }
  return absolutePath
}

function extractSummary(caseRecord: Record<string, unknown>, label: string): FeatureCaseSummary {
  const grade = asRecord(caseRecord.grade)
  const state = stringValue(caseRecord.state)
  const decision = stringValue(grade?.decision)
  const gradeValue = stringValue(grade?.grade)
  const nextAction = stringValue(caseRecord.nextAction)
  if (!state || !decision || !gradeValue || !nextAction) {
    throw new Error(`${label}: case summary fields are required`)
  }
  return { state, decision, grade: gradeValue, nextAction }
}

function extractHandoffPath(caseRecord: Record<string, unknown>, label: string): string {
  const ledger = asRecord(caseRecord.ledger)
  const handoffPath = stringValue(ledger?.handoffPath)
  if (!handoffPath) throw new Error(`${label}: ledger.handoffPath is required`)
  return handoffPath
}

function validateTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
}

function readValidCase(casePath: string): {
  caseId: string
  casePath: string
  caseDigest: string
  handoffPath: string
  summary: FeatureCaseSummary
  caseValue: unknown
} {
  const relativeCasePath = repoRelativePath(casePath, 'case path')
  const absoluteCasePath = resolveRepoPath(relativeCasePath, 'case path')
  const caseText = readFileSync(absoluteCasePath, 'utf8')
  const caseValue = parseJson(caseText, relativeCasePath)
  const errors = validateCase(relativeCasePath, caseValue)
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  const caseRecord = asRecord(caseValue)
  const caseId = stringValue(caseRecord?.id)
  if (!caseRecord || !caseId) {
    throw new Error(`${relativeCasePath}: case id is required`)
  }

  return {
    caseId,
    casePath: relativeCasePath,
    caseDigest: digestValue(caseValue),
    handoffPath: extractHandoffPath(caseRecord, relativeCasePath),
    summary: extractSummary(caseRecord, relativeCasePath),
    caseValue,
  }
}

function eventDigest(event: Omit<FeatureCaseLedgerEvent, 'entryDigest'>): string {
  return digestValue(event)
}

function withoutEntryDigest(
  event: FeatureCaseLedgerEvent
): Omit<FeatureCaseLedgerEvent, 'entryDigest'> {
  const { entryDigest: _entryDigest, ...rest } = event
  return rest
}

function buildEvent(
  flags: Record<string, string>,
  previousEvent?: FeatureCaseLedgerEvent
): FeatureCaseLedgerEvent {
  const casePath = flags.case
  if (!casePath) throw new Error('append requires --case <path>')

  const caseSnapshot = readValidCase(casePath)
  const appendedAt = flags.timestamp ?? new Date().toISOString()
  if (!validateTimestamp(appendedAt)) {
    throw new Error('--timestamp must be an ISO timestamp from Date.toISOString()')
  }

  const eventWithoutDigest = {
    ledgerVersion: LEDGER_VERSION,
    sequence: previousEvent ? previousEvent.sequence + 1 : 1,
    eventId: flags['event-id'] ?? `${caseSnapshot.caseId}:${appendedAt}`,
    type: EVENT_TYPE,
    appendedAt,
    caseId: caseSnapshot.caseId,
    casePath: caseSnapshot.casePath,
    caseDigest: caseSnapshot.caseDigest,
    previousEntryDigest: previousEvent?.entryDigest ?? null,
    coverageAuditPath: repoRelativePath(
      flags['coverage-audit'] ?? DEFAULT_COVERAGE_AUDIT,
      'coverage audit path'
    ),
    handoffPath: caseSnapshot.handoffPath,
    summary: caseSnapshot.summary,
    case: caseSnapshot.caseValue,
  } satisfies Omit<FeatureCaseLedgerEvent, 'entryDigest'>

  return {
    ...eventWithoutDigest,
    entryDigest: eventDigest(eventWithoutDigest),
  }
}

function validateEvent(
  source: string,
  line: number,
  value: unknown
): { errors: string[]; event?: FeatureCaseLedgerEvent & { line: number } } {
  const errors: string[] = []
  const event = asRecord(value)
  if (!event) return { errors: [`${source}:${line}: event must be object`] }

  if (event.ledgerVersion !== LEDGER_VERSION) {
    errors.push(`${source}:${line}: ledgerVersion must be ${LEDGER_VERSION}`)
  }
  if (!Number.isInteger(event.sequence) || Number(event.sequence) < 1) {
    errors.push(`${source}:${line}: sequence must be a positive integer`)
  }
  if (event.type !== EVENT_TYPE) {
    errors.push(`${source}:${line}: type must be ${EVENT_TYPE}`)
  }

  const eventId = stringValue(event.eventId)
  const appendedAt = stringValue(event.appendedAt)
  const caseId = stringValue(event.caseId)
  const casePath = stringValue(event.casePath)
  const caseDigest = stringValue(event.caseDigest)
  const previousEntryDigest = event.previousEntryDigest
  const entryDigest = stringValue(event.entryDigest)
  const coverageAuditPath = stringValue(event.coverageAuditPath)
  const handoffPath = stringValue(event.handoffPath)
  const summary = asRecord(event.summary)
  const caseValue = event.case

  if (!eventId) errors.push(`${source}:${line}: eventId is required`)
  if (!appendedAt) {
    errors.push(`${source}:${line}: appendedAt is required`)
  } else if (!validateTimestamp(appendedAt)) {
    errors.push(`${source}:${line}: appendedAt must be ISO Date.toISOString() output`)
  }
  if (!caseId) errors.push(`${source}:${line}: caseId is required`)
  if (!casePath) errors.push(`${source}:${line}: casePath is required`)
  if (!caseDigest || !/^[a-f0-9]{64}$/.test(caseDigest)) {
    errors.push(`${source}:${line}: caseDigest must be 64 lowercase hex chars`)
  }
  if (
    previousEntryDigest !== null &&
    (typeof previousEntryDigest !== 'string' || !/^[a-f0-9]{64}$/.test(previousEntryDigest))
  ) {
    errors.push(`${source}:${line}: previousEntryDigest must be null or 64 lowercase hex chars`)
  }
  if (!entryDigest || !/^[a-f0-9]{64}$/.test(entryDigest)) {
    errors.push(`${source}:${line}: entryDigest must be 64 lowercase hex chars`)
  }
  if (!coverageAuditPath) errors.push(`${source}:${line}: coverageAuditPath is required`)
  if (!handoffPath) errors.push(`${source}:${line}: handoffPath is required`)
  if (!summary) errors.push(`${source}:${line}: summary is required`)
  if (!caseValue) errors.push(`${source}:${line}: case is required`)

  if (
    !eventId ||
    !appendedAt ||
    !caseId ||
    !casePath ||
    !caseDigest ||
    !entryDigest ||
    !coverageAuditPath ||
    !handoffPath ||
    !summary ||
    !caseValue
  ) {
    return { errors }
  }

  if (!existsSync(resolveRepoPath(coverageAuditPath, `${source}:${line}: coverageAuditPath`))) {
    errors.push(`${source}:${line}: coverageAuditPath does not exist: ${coverageAuditPath}`)
  }

  const embeddedCaseDigest = digestValue(caseValue)
  if (embeddedCaseDigest !== caseDigest) {
    errors.push(`${source}:${line}: caseDigest does not match embedded case`)
  }

  const absoluteCasePath = resolveRepoPath(casePath, `${source}:${line}: casePath`)
  if (!existsSync(absoluteCasePath)) {
    errors.push(`${source}:${line}: casePath does not exist: ${casePath}`)
  } else {
    const currentCaseValue = parseJson(readFileSync(absoluteCasePath, 'utf8'), casePath)
    if (digestValue(currentCaseValue) !== caseDigest) {
      errors.push(`${source}:${line}: casePath content does not match caseDigest`)
    }
  }

  for (const caseError of validateCase(casePath, caseValue)) {
    errors.push(`${source}:${line}: ${caseError}`)
  }

  const caseRecord = asRecord(caseValue)
  const actualCaseId = stringValue(caseRecord?.id)
  if (actualCaseId !== caseId) {
    errors.push(`${source}:${line}: caseId does not match case.id`)
  }

  if (caseRecord) {
    const actualSummary = extractSummary(caseRecord, casePath)
    for (const field of ['state', 'decision', 'grade', 'nextAction'] as const) {
      if (summary[field] !== actualSummary[field]) {
        errors.push(`${source}:${line}: summary.${field} does not match case`)
      }
    }
  }

  const normalizedEvent = {
    ledgerVersion: LEDGER_VERSION,
    sequence: Number(event.sequence),
    eventId,
    type: EVENT_TYPE,
    appendedAt,
    caseId,
    casePath,
    caseDigest,
    previousEntryDigest: previousEntryDigest as string | null,
    entryDigest,
    coverageAuditPath,
    handoffPath,
    summary: summary as unknown as FeatureCaseSummary,
    case: caseValue,
  } satisfies FeatureCaseLedgerEvent
  if (eventDigest(withoutEntryDigest(normalizedEvent)) !== entryDigest) {
    errors.push(`${source}:${line}: entryDigest does not match event payload`)
  }

  return {
    errors,
    event: {
      ...normalizedEvent,
      line,
    },
  }
}

function validateLedgerText(source: string, text: string): LedgerCheckResult {
  const errors: string[] = []
  const events: Array<FeatureCaseLedgerEvent & { line: number }> = []
  const seenEventIds = new Set<string>()
  let previousEvent: (FeatureCaseLedgerEvent & { line: number }) | undefined

  if (text.length === 0) {
    return { errors: [`${source}: ledger must include at least one event`], events }
  }

  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  const lines = body.split('\n')
  for (const [index, lineText] of lines.entries()) {
    const line = index + 1
    if (lineText.trim().length === 0) {
      errors.push(`${source}:${line}: blank lines are not allowed`)
      continue
    }

    let parsed: unknown
    try {
      parsed = parseJson(lineText, `${source}:${line}`)
    } catch (error) {
      errors.push(getErrorMessage(error))
      continue
    }

    const result = validateEvent(source, line, parsed)
    errors.push(...result.errors)
    if (!result.event) continue

    if (seenEventIds.has(result.event.eventId)) {
      errors.push(`${source}:${line}: duplicate eventId: ${result.event.eventId}`)
    }
    seenEventIds.add(result.event.eventId)

    const expectedSequence = previousEvent ? previousEvent.sequence + 1 : 1
    if (result.event.sequence !== expectedSequence) {
      errors.push(`${source}:${line}: sequence must be ${expectedSequence}`)
    }

    const expectedPreviousDigest = previousEvent?.entryDigest ?? null
    if (result.event.previousEntryDigest !== expectedPreviousDigest) {
      errors.push(`${source}:${line}: previousEntryDigest does not match previous entry`)
    }

    if (previousEvent && previousEvent.appendedAt > result.event.appendedAt) {
      errors.push(`${source}:${line}: appendedAt timestamps must be nondecreasing`)
    }

    events.push(result.event)
    previousEvent = result.event
  }

  return { errors, events }
}

function checkLedger(ledgerPath: string): LedgerCheckResult {
  const relativeLedgerPath = repoRelativePath(ledgerPath, 'ledger path')
  const absoluteLedgerPath = resolveRepoPath(relativeLedgerPath, 'ledger path')
  if (!existsSync(absoluteLedgerPath)) {
    return {
      errors: [`${relativeLedgerPath}: ledger does not exist`],
      events: [],
    }
  }
  return validateLedgerText(relativeLedgerPath, readFileSync(absoluteLedgerPath, 'utf8'))
}

function assertCleanLedger(ledgerPath: string): LedgerCheckResult {
  const result = checkLedger(ledgerPath)
  if (result.errors.length > 0) throw new Error(result.errors.join('\n'))
  return result
}

function appendCase(args: string[]): void {
  const flags = parseFlags(args)
  const ledgerPath = flags.ledger ?? DEFAULT_LEDGER
  const relativeLedgerPath = repoRelativePath(ledgerPath, 'ledger path')
  const absoluteLedgerPath = resolveRepoPath(relativeLedgerPath, 'ledger path')
  const existing = existsSync(absoluteLedgerPath)
    ? assertCleanLedger(relativeLedgerPath)
    : undefined
  const previousEvent = existing?.events.at(-1)
  const event = buildEvent(flags, previousEvent)

  if (existing?.events.some((existingEvent) => existingEvent.eventId === event.eventId)) {
    throw new Error(`${relativeLedgerPath}: duplicate eventId: ${event.eventId}`)
  }

  mkdirSync(dirname(absoluteLedgerPath), { recursive: true })
  appendFileSync(absoluteLedgerPath, `${JSON.stringify(event)}\n`)
  console.log(`${relativeLedgerPath}: appended ${event.caseId} (${event.eventId})`)
}

function checkCommand(args: string[]): void {
  const ledgerPath = args[0] ?? DEFAULT_LEDGER
  const result = assertCleanLedger(ledgerPath)
  console.log(
    `${repoRelativePath(ledgerPath, 'ledger path')}: valid ledger (${result.events.length})`
  )
}

function listCommand(args: string[]): void {
  const ledgerPath = args[0] ?? DEFAULT_LEDGER
  const result = assertCleanLedger(ledgerPath)
  console.log(
    JSON.stringify(
      result.events.map((event) => ({
        sequence: event.sequence,
        eventId: event.eventId,
        appendedAt: event.appendedAt,
        caseId: event.caseId,
        casePath: event.casePath,
        caseDigest: event.caseDigest,
        previousEntryDigest: event.previousEntryDigest,
        entryDigest: event.entryDigest,
        ...event.summary,
      })),
      null,
      2
    )
  )
}

function checkFixtures(): void {
  const result = assertCleanLedger(DEFAULT_LEDGER)
  console.log(`${DEFAULT_LEDGER}: valid ledger (${result.events.length})`)

  const baseEvent = result.events[0]
  if (!baseEvent) throw new Error(`${DEFAULT_LEDGER}: expected at least one fixture event`)

  const duplicate = `${JSON.stringify(baseEvent)}\n${JSON.stringify(baseEvent)}\n`
  const badCaseDigest = `${JSON.stringify({
    ...baseEvent,
    caseDigest: '0'.repeat(64),
  })}\n`
  const brokenChain = `${JSON.stringify({
    ...baseEvent,
    sequence: 2,
    previousEntryDigest: '0'.repeat(64),
    entryDigest: eventDigest({
      ...withoutEntryDigest(baseEvent),
      sequence: 2,
      previousEntryDigest: '0'.repeat(64),
    }),
  })}\n`
  const summaryDriftPayload = {
    ...withoutEntryDigest(baseEvent),
    summary: { ...baseEvent.summary, grade: 'A' },
  }
  const summaryDrift = `${JSON.stringify({
    ...summaryDriftPayload,
    entryDigest: eventDigest(summaryDriftPayload),
  })}\n`

  const invalidFixtures = [
    { name: 'duplicate-event-id', text: duplicate, expectedError: 'duplicate eventId' },
    { name: 'bad-case-digest', text: badCaseDigest, expectedError: 'caseDigest does not match' },
    {
      name: 'broken-hash-chain',
      text: brokenChain,
      expectedError: 'sequence must be 1',
    },
    {
      name: 'summary-drift',
      text: summaryDrift,
      expectedError: 'summary.grade does not match case',
    },
  ] as const

  for (const fixture of invalidFixtures) {
    const invalid = validateLedgerText(`synthetic:${fixture.name}`, fixture.text)
    if (!invalid.errors.some((error) => error.includes(fixture.expectedError))) {
      throw new Error(
        `${fixture.name} did not fail for expected reason "${fixture.expectedError}"\nActual errors:\n${invalid.errors.join('\n')}`
      )
    }
    console.log(`${fixture.name}: rejected as expected (${fixture.expectedError})`)
  }
}

function printUsage(): void {
  console.log(`Usage:
  bun run scripts/mothership-feature-case-ledger.ts append --case <case.json> [--ledger ${DEFAULT_LEDGER}] [--event-id <id>] [--timestamp <iso>]
  bun run scripts/mothership-feature-case-ledger.ts check [ledger.jsonl]
  bun run scripts/mothership-feature-case-ledger.ts list [ledger.jsonl]
  bun run scripts/mothership-feature-case-ledger.ts check-fixtures`)
}

function main(): void {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'append') {
    appendCase(args)
    return
  }
  if (command === 'check') {
    checkCommand(args)
    return
  }
  if (command === 'list') {
    listCommand(args)
    return
  }
  if (command === 'check-fixtures' || !command) {
    checkFixtures()
    return
  }
  printUsage()
  throw new Error(`unknown command: ${command}`)
}

try {
  main()
} catch (error) {
  console.error(getErrorMessage(error))
  process.exitCode = 1
}
