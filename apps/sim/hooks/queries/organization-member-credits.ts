import { useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import {
  getMyMemberCreditsContract,
  type MyMemberCreditsData,
} from '@/lib/api/contracts/organization'
import { organizationKeys } from '@/hooks/queries/organization-keys'

export async function fetchMyMemberCredits(
  workspaceId: string,
  signal?: AbortSignal
): Promise<MyMemberCreditsData> {
  const response = await requestJson(getMyMemberCreditsContract, {
    query: { workspaceId },
    signal,
  })
  return response.data
}

/**
 * The caller's own per-member credit usage and cap for a workspace's organization.
 */
export function useMyMemberCredits(workspaceId?: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options

  return useQuery({
    queryKey: organizationKeys.myMemberCredits(workspaceId ?? ''),
    queryFn: ({ signal }) => fetchMyMemberCredits(workspaceId as string, signal),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 30 * 1000,
  })
}
