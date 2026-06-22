/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import type { MothershipControlPanelCase } from '@/lib/api/contracts/mothership-control-panel'
import {
  getFeatureCaseArtifactRows,
  getFeatureCaseGateStatuses,
} from '@/app/workspace/[workspaceId]/mothership/mothership-control-panel'
import {
  classifyReviewerFamily,
  formatCapReason,
  formatClaimsNonClaimsSummary,
  getReviewFamilyGroups,
} from '@/app/workspace/[workspaceId]/mothership/mothership-control-panel.utils'

function caseFixture(overrides: Partial<MothershipControlPanelCase>): MothershipControlPanelCase {
  return {
    sequence: 1,
    eventId: 'event-1',
    appendedAt: '2026-06-22T04:23:27.000Z',
    caseId: 'case-1',
    casePath: 'scripts/fixtures/case.json',
    caseDigest: 'a'.repeat(64),
    previousEntryDigest: null,
    entryDigest: 'b'.repeat(64),
    coverageAuditPath: 'docs/superpowers/plans/mothership-replacement-coverage-audit.md',
    handoffPath: '/tmp/sim-mothership-owned-replacement-handoff-test.md',
    state: 'NEXT_SLICE_SELECTED',
    decision: 'CLOSE_SAFE_PARTIAL',
    grade: 'B',
    nextAction: 'Build YES UI.',
    claimsAdvanced: ['Control-panel backend exists.'],
    nonClaims: [],
    blockers: [],
    evidenceCommands: [
      { cmd: 'bun run mship-case-ledger:check', result: 'passed', proves: ['ledger valid'] },
    ],
    reviews: [{ type: 'self-review', reviewer: 'codex-main', status: 'self_review' }],
    ...overrides,
  }
}

describe('getFeatureCaseGateStatuses', () => {
  it('marks hard gates blocked from explicit non-claims and blockers', () => {
    const statuses = getFeatureCaseGateStatuses([
      caseFixture({
        nonClaims: ['browser/provider E2E proof not claimed', 'replacement complete not claimed'],
        blockers: ['Docker proof remains blocked', 'Kubernetes proof remains blocked'],
      }),
    ])

    expect(statuses).toEqual([
      expect.objectContaining({ id: 'browser-provider-e2e', status: 'blocked' }),
      expect.objectContaining({ id: 'docker-image', status: 'blocked' }),
      expect.objectContaining({ id: 'kubernetes', status: 'blocked' }),
      expect.objectContaining({ id: 'replacement-complete', status: 'blocked' }),
    ])
  })

  it('keeps unmentioned hard gates unproven', () => {
    const statuses = getFeatureCaseGateStatuses([
      caseFixture({ nonClaims: ['YES UI not built'], blockers: [] }),
    ])

    expect(statuses.every((status) => status.status === 'unproven')).toBe(true)
  })

  it('does not classify positive claims as blocked gates', () => {
    const statuses = getFeatureCaseGateStatuses([
      caseFixture({
        claimsAdvanced: ['browser/provider E2E passed in a future proof case'],
        nonClaims: [],
        blockers: [],
      }),
    ])

    expect(statuses.find((status) => status.id === 'browser-provider-e2e')).toEqual(
      expect.objectContaining({ status: 'unproven' })
    )
  })
})

describe('getFeatureCaseArtifactRows', () => {
  it('builds controlled artifact links for a ledger-backed case', () => {
    const rows = getFeatureCaseArtifactRows(
      caseFixture({
        eventId: 'task-67-control-panel-ui:2026-06-22T05:14:42.000Z',
        casePath: 'scripts/fixtures/mothership-feature-cases/valid/control-panel-ui.json',
        coverageAuditPath: 'docs/superpowers/plans/mothership-replacement-coverage-audit.md',
        handoffPath:
          '/var/folders/mc/example/T/sim-mothership-owned-replacement-handoff-20260622T051442Z.md',
      })
    )

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'case',
        label: 'Case JSON',
        path: 'scripts/fixtures/mothership-feature-cases/valid/control-panel-ui.json',
        href: expect.stringContaining('artifact=case'),
      }),
      expect.objectContaining({
        id: 'coverage-audit',
        label: 'Coverage Audit',
        path: 'docs/superpowers/plans/mothership-replacement-coverage-audit.md',
        href: expect.stringContaining('artifact=coverage-audit'),
      }),
      expect.objectContaining({
        id: 'handoff',
        label: 'Handoff',
        href: expect.stringContaining('artifact=handoff'),
      }),
    ])
    expect(rows[0].href).toContain(
      'eventId=task-67-control-panel-ui%3A2026-06-22T05%3A14%3A42.000Z'
    )
  })
})

describe('classifyReviewerFamily', () => {
  it('routes subagent, grok, and oracle reviewers to their families', () => {
    expect(classifyReviewerFamily('kuhn-subagent-review')).toBe('subagent')
    expect(classifyReviewerFamily('locke-doc-review')).toBe('subagent')
    expect(classifyReviewerFamily('leibniz-subagent-review')).toBe('subagent')
    expect(classifyReviewerFamily('grok-cli-review')).toBe('grok')
    expect(classifyReviewerFamily('oracle-vision-review')).toBe('oracle')
  })

  it('falls back to other for unrecognized reviewers', () => {
    expect(classifyReviewerFamily('codex-main')).toBe('other')
  })
})

describe('getReviewFamilyGroups', () => {
  it('always returns subagent, grok, and oracle in fixed order with honest empty families', () => {
    const groups = getReviewFamilyGroups([
      { type: 'code', reviewer: 'kuhn-subagent-review', status: 'pass' },
      { type: 'spec', reviewer: 'grok-cli-review', status: 'pass' },
    ])

    expect(groups.map((group) => group.family)).toEqual(['subagent', 'grok', 'oracle'])
    expect(groups.find((group) => group.family === 'oracle')?.reviews).toEqual([])
    expect(groups.find((group) => group.family === 'subagent')?.reviews).toHaveLength(1)
  })

  it('returns the three families even when there are no reviews', () => {
    const groups = getReviewFamilyGroups([])

    expect(groups.map((group) => group.family)).toEqual(['subagent', 'grok', 'oracle'])
    expect(groups.every((group) => group.reviews.length === 0)).toBe(true)
  })

  it('appends an other panel only when an unmatched reviewer exists', () => {
    const withoutOther = getReviewFamilyGroups([
      { type: 'code', reviewer: 'kuhn-subagent-review', status: 'pass' },
    ])
    expect(withoutOther.some((group) => group.family === 'other')).toBe(false)

    const withOther = getReviewFamilyGroups([
      { type: 'self-review', reviewer: 'codex-main', status: 'self_review' },
    ])
    expect(withOther.map((group) => group.family)).toEqual(['subagent', 'grok', 'oracle', 'other'])
    expect(withOther.find((group) => group.family === 'other')?.reviews).toHaveLength(1)
  })
})

describe('formatCapReason', () => {
  it('humanizes snake_case tokens into a sentence', () => {
    expect(formatCapReason('reviewer_separation_missing')).toBe('Reviewer separation missing.')
  })

  it('uppercases known acronym tokens', () => {
    expect(formatCapReason('strict_e2e')).toBe('Strict E2E.')
  })

  it('keeps a real sentence and ensures terminal punctuation', () => {
    expect(formatCapReason('safe local slice')).toBe('Safe local slice.')
    expect(formatCapReason('External gates blocked.')).toBe('External gates blocked.')
  })

  it('returns null for missing or empty input', () => {
    expect(formatCapReason(undefined)).toBeNull()
    expect(formatCapReason('   ')).toBeNull()
  })
})

describe('formatClaimsNonClaimsSummary', () => {
  it('pluralizes claims and non-claims', () => {
    expect(formatClaimsNonClaimsSummary(['a', 'b', 'c', 'd'], ['x'])).toBe('4 claims · 1 non-claim')
  })

  it('handles singular and zero counts', () => {
    expect(formatClaimsNonClaimsSummary(['a'], [])).toBe('1 claim · 0 non-claims')
  })
})
