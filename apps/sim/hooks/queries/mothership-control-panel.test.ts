/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequestJson, mockUseQuery } = vi.hoisted(() => ({
  mockRequestJson: vi.fn(),
  mockUseQuery: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: {},
  useQuery: mockUseQuery,
}))

vi.mock('@/lib/api/client/request', () => ({
  requestJson: mockRequestJson,
}))

import { listMothershipFeatureCasesContract } from '@/lib/api/contracts/mothership-control-panel'
import {
  fetchMothershipFeatureCases,
  mothershipControlPanelKeys,
  useMothershipFeatureCases,
} from '@/hooks/queries/mothership-control-panel'

describe('mothership control-panel queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches FeatureCases through the route contract', async () => {
    const signal = new AbortController().signal
    mockRequestJson.mockResolvedValueOnce({ success: true, ledgerPath: 'ledger.jsonl', cases: [] })

    await fetchMothershipFeatureCases({ limit: 20, caseId: 'case-1' }, signal)

    expect(mockRequestJson).toHaveBeenCalledWith(listMothershipFeatureCasesContract, {
      query: { limit: 20, caseId: 'case-1' },
      signal,
    })
  })

  it('builds a variable query key and forwards cancellation', () => {
    useMothershipFeatureCases({ limit: 50, caseId: 'case-2' })

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: mothershipControlPanelKeys.featureCaseList(50, 'case-2'),
        staleTime: 30 * 1000,
      })
    )

    const options = mockUseQuery.mock.calls[0][0]
    const signal = new AbortController().signal
    options.queryFn({ signal })

    expect(mockRequestJson).toHaveBeenCalledWith(listMothershipFeatureCasesContract, {
      query: { limit: 50, caseId: 'case-2' },
      signal,
    })
  })
})
