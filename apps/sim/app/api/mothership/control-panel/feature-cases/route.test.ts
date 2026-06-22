/**
 * @vitest-environment node
 */
import { copilotHttpMock, copilotHttpMockFns } from '@sim/testing'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockReadFeatureCaseLedger } = vi.hoisted(() => ({
  mockReadFeatureCaseLedger: vi.fn(),
}))

vi.mock('@/lib/copilot/request/http', () => copilotHttpMock)
vi.mock('@/lib/mothership/control-panel/feature-case-ledger', () => ({
  readFeatureCaseLedger: mockReadFeatureCaseLedger,
}))

import { GET } from '@/app/api/mothership/control-panel/feature-cases/route'

function request(query = '') {
  return new NextRequest(
    `http://localhost:3000/api/mothership/control-panel/feature-cases${query}`,
    { method: 'GET' }
  )
}

describe('GET /api/mothership/control-panel/feature-cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    copilotHttpMockFns.mockAuthenticateCopilotRequestSessionOnly.mockResolvedValue({
      userId: 'user-1',
      isAuthenticated: true,
    })
    mockReadFeatureCaseLedger.mockReturnValue({
      ledgerPath: 'docs/superpowers/ledgers/mothership-feature-cases.jsonl',
      eventCount: 1,
      cases: [
        {
          sequence: 1,
          eventId: 'event-1',
          appendedAt: '2026-06-22T04:23:27.000Z',
          caseId: 'task-64-case-runner',
          casePath:
            'scripts/fixtures/mothership-feature-cases/valid/close-safe-partial-case-runner.json',
          caseDigest: 'a'.repeat(64),
          previousEntryDigest: null,
          entryDigest: 'b'.repeat(64),
          coverageAuditPath: 'docs/superpowers/plans/mothership-replacement-coverage-audit.md',
          handoffPath: '/tmp/sim-mothership-owned-replacement-handoff-test.md',
          state: 'NEXT_SLICE_SELECTED',
          decision: 'CLOSE_SAFE_PARTIAL',
          grade: 'B',
          nextAction: 'Build control-panel backend.',
          claimsAdvanced: ['FeatureCase ledger available.'],
          nonClaims: ['YES UI not built'],
          blockers: ['Docker unavailable'],
          evidenceCommands: [
            { cmd: 'bun run mship-case-ledger:check', result: 'passed', proves: ['ledger valid'] },
          ],
          reviews: [
            { type: 'evidence', reviewer: 'evidence-review', status: 'pass', findings: [] },
          ],
        },
      ],
    })
  })

  it('returns FeatureCase control-panel summaries', async () => {
    const response = await GET(request('?limit=20&caseId=task-64-case-runner'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      ledgerPath: 'docs/superpowers/ledgers/mothership-feature-cases.jsonl',
      eventCount: 1,
      cases: [
        expect.objectContaining({
          caseId: 'task-64-case-runner',
          grade: 'B',
          blockers: ['Docker unavailable'],
        }),
      ],
    })
    expect(mockReadFeatureCaseLedger).toHaveBeenCalledWith({
      caseId: 'task-64-case-runner',
      limit: 20,
    })
  })

  it('authenticates before parsing query params', async () => {
    copilotHttpMockFns.mockAuthenticateCopilotRequestSessionOnly.mockResolvedValueOnce({
      userId: null,
      isAuthenticated: false,
    })

    const response = await GET(request('?limit=0'))

    expect(response.status).toBe(401)
    expect(mockReadFeatureCaseLedger).not.toHaveBeenCalled()
  })

  it('rejects invalid query params without reading the ledger', async () => {
    const response = await GET(request('?limit=0'))

    expect(response.status).toBe(400)
    expect(mockReadFeatureCaseLedger).not.toHaveBeenCalled()
  })

  it('fails closed when the ledger cannot be validated', async () => {
    mockReadFeatureCaseLedger.mockImplementationOnce(() => {
      throw new Error('entryDigest does not match event payload')
    })

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Failed to read FeatureCase ledger',
    })
  })
})
