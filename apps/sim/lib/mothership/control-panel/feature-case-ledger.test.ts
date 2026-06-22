/**
 * @vitest-environment node
 */
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_FEATURE_CASE_LEDGER_PATH,
  FeatureCaseArtifactForbiddenError,
  FeatureCaseArtifactNotFoundError,
  readFeatureCaseArtifact,
  readFeatureCaseLedger,
} from '@/lib/mothership/control-panel/feature-case-ledger'

const repoRoot = resolve(process.cwd(), '../..')
const tempLedgers: string[] = []
const TASK_67_EVENT_ID = 'task-67-control-panel-ui:2026-06-22T05:14:42.000Z'

function realLedgerText(): string {
  return readFileSync(resolve(repoRoot, DEFAULT_FEATURE_CASE_LEDGER_PATH), 'utf8')
}

function realLedgerLines(): string[] {
  return realLedgerText().trimEnd().split('\n')
}

function firstRealEvent(): Record<string, unknown> {
  return JSON.parse(realLedgerLines()[0]) as Record<string, unknown>
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
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

function writeTempLedger(text: string): string {
  const path = join(
    repoRoot,
    'docs/superpowers/ledgers',
    `.tmp-feature-case-ledger-${process.pid}-${tempLedgers.length}.jsonl`
  )
  writeFileSync(path, text)
  tempLedgers.push(path)
  return path
}

describe('readFeatureCaseLedger', () => {
  afterEach(() => {
    for (const path of tempLedgers.splice(0)) {
      rmSync(path, { force: true })
    }
  })

  it('returns list-ready FeatureCase summaries from the hash-chained ledger', () => {
    const result = readFeatureCaseLedger({ repoRoot })
    const caseRunner = result.cases.find((caseItem) => caseItem.caseId === 'task-64-case-runner')

    expect(result.ledgerPath).toBe(DEFAULT_FEATURE_CASE_LEDGER_PATH)
    expect(result.eventCount).toBeGreaterThanOrEqual(1)
    expect(caseRunner).toEqual(
      expect.objectContaining({
        sequence: 1,
        caseId: 'task-64-case-runner',
        decision: 'CLOSE_SAFE_PARTIAL',
        grade: 'B',
        claimsAdvanced: expect.arrayContaining([
          'FeatureCase checker validates closed FeatureCase gate evidence sources and rejects forbidden over-claims.',
        ]),
        nonClaims: expect.arrayContaining(['replacement complete not claimed']),
        evidenceCommands: expect.arrayContaining([
          expect.objectContaining({ cmd: 'bun run scripts/check-mothership-feature-case.ts' }),
        ]),
      })
    )
  })

  it('filters by caseId and applies the requested limit', () => {
    const result = readFeatureCaseLedger({ repoRoot, caseId: 'missing-case', limit: 1 })

    expect(result.eventCount).toBeGreaterThanOrEqual(1)
    expect(result.cases).toEqual([])
  })

  it('rejects duplicate event ids', () => {
    const line = realLedgerText().trimEnd()
    const tempLedger = writeTempLedger(`${line}\n${line}\n`)

    expect(() => readFeatureCaseLedger({ repoRoot, ledgerPath: tempLedger })).toThrow(
      /duplicate eventId/
    )
  })

  it('rejects tampered case digests', () => {
    const tampered = realLedgerText().replace(/"caseDigest":"[a-f0-9]{64}"/, () => {
      return `"caseDigest":"${'0'.repeat(64)}"`
    })
    const tempLedger = writeTempLedger(tampered)

    expect(() => readFeatureCaseLedger({ repoRoot, ledgerPath: tempLedger })).toThrow(
      /caseDigest does not match embedded case/
    )
  })

  it('rejects absolute case paths even when the entry digest matches', () => {
    const event = firstRealEvent()
    event.casePath = resolve(repoRoot, event.casePath as string)
    const { entryDigest: _entryDigest, ...eventWithoutEntryDigest } = event
    event.entryDigest = digestValue(eventWithoutEntryDigest)
    const tempLedger = writeTempLedger(`${JSON.stringify(event)}\n`)

    expect(() => readFeatureCaseLedger({ repoRoot, ledgerPath: tempLedger })).toThrow(
      /casePath must be repo-relative/
    )
  })

  it('reads an artifact referenced by a validated ledger event', () => {
    const artifact = readFeatureCaseArtifact({
      repoRoot,
      eventId: TASK_67_EVENT_ID,
      artifact: 'case',
    })

    expect(artifact.path).toBe(
      'scripts/fixtures/mothership-feature-cases/valid/control-panel-ui.json'
    )
    expect(artifact.filename).toBe('control-panel-ui.json')
    expect(artifact.contentType).toBe('text/plain; charset=utf-8')
    expect(artifact.content).toContain('"id": "task-67-control-panel-ui"')
  })

  it('rejects unknown artifact events', () => {
    expect(() =>
      readFeatureCaseArtifact({
        repoRoot,
        eventId: 'missing-event',
        artifact: 'case',
      })
    ).toThrow(FeatureCaseArtifactNotFoundError)
  })

  it('rejects handoff artifacts outside the temp directory', () => {
    const event = firstRealEvent()
    event.eventId = 'forbidden-handoff-event'
    event.handoffPath = '/etc/passwd'
    const { entryDigest: _entryDigest, ...eventWithoutEntryDigest } = event
    event.entryDigest = digestValue(eventWithoutEntryDigest)
    const tempLedger = writeTempLedger(`${JSON.stringify(event)}\n`)

    expect(() =>
      readFeatureCaseArtifact({
        repoRoot,
        ledgerPath: tempLedger,
        eventId: 'forbidden-handoff-event',
        artifact: 'handoff',
      })
    ).toThrow(FeatureCaseArtifactForbiddenError)
  })

  it('rejects repo-relative artifact symlinks that escape the repo root', () => {
    const outsidePath = join(tmpdir(), `mship-artifact-outside-${process.pid}.md`)
    writeFileSync(outsidePath, 'outside repo')
    tempLedgers.push(outsidePath)

    const symlinkPath = join(
      repoRoot,
      'docs/superpowers/ledgers',
      `.tmp-artifact-symlink-${process.pid}.md`
    )
    symlinkSync(outsidePath, symlinkPath)
    tempLedgers.push(symlinkPath)

    const event = firstRealEvent()
    event.eventId = 'symlink-coverage-event'
    event.coverageAuditPath = `docs/superpowers/ledgers/.tmp-artifact-symlink-${process.pid}.md`
    const { entryDigest: _entryDigest, ...eventWithoutEntryDigest } = event
    event.entryDigest = digestValue(eventWithoutEntryDigest)
    const tempLedger = writeTempLedger(`${JSON.stringify(event)}\n`)

    expect(() =>
      readFeatureCaseArtifact({
        repoRoot,
        ledgerPath: tempLedger,
        eventId: 'symlink-coverage-event',
        artifact: 'coverage-audit',
      })
    ).toThrow(FeatureCaseArtifactForbiddenError)
  })

  it('rejects temp handoff symlinks that escape the temp directory', () => {
    const symlinkPath = join(
      tmpdir(),
      `sim-mothership-owned-replacement-handoff-symlink-${process.pid}.md`
    )
    symlinkSync(resolve(repoRoot, 'package.json'), symlinkPath)
    tempLedgers.push(symlinkPath)

    const event = firstRealEvent()
    event.eventId = 'symlink-handoff-event'
    event.handoffPath = symlinkPath
    const { entryDigest: _entryDigest, ...eventWithoutEntryDigest } = event
    event.entryDigest = digestValue(eventWithoutEntryDigest)
    const tempLedger = writeTempLedger(`${JSON.stringify(event)}\n`)

    expect(() =>
      readFeatureCaseArtifact({
        repoRoot,
        ledgerPath: tempLedger,
        eventId: 'symlink-handoff-event',
        artifact: 'handoff',
      })
    ).toThrow(FeatureCaseArtifactForbiddenError)
  })
})
