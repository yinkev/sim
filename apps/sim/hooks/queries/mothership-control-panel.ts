import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import {
  type ListMothershipFeatureCasesResponse,
  listMothershipFeatureCasesContract,
} from '@/lib/api/contracts/mothership-control-panel'

export const mothershipControlPanelKeys = {
  all: ['mothership-control-panel'] as const,
  featureCases: () => [...mothershipControlPanelKeys.all, 'feature-cases'] as const,
  featureCaseLists: () => [...mothershipControlPanelKeys.featureCases(), 'list'] as const,
  featureCaseList: (limit?: number, caseId?: string) =>
    [...mothershipControlPanelKeys.featureCaseLists(), limit ?? 100, caseId ?? ''] as const,
}

export async function fetchMothershipFeatureCases(
  input: { limit?: number; caseId?: string } = {},
  signal?: AbortSignal
): Promise<ListMothershipFeatureCasesResponse> {
  return requestJson(listMothershipFeatureCasesContract, {
    query: input,
    signal,
  })
}

export function useMothershipFeatureCases(input: { limit?: number; caseId?: string } = {}) {
  const { limit = 100, caseId } = input
  return useQuery({
    queryKey: mothershipControlPanelKeys.featureCaseList(limit, caseId),
    queryFn: ({ signal }) => fetchMothershipFeatureCases({ limit, caseId }, signal),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}
