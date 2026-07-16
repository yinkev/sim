import type { QueryClient } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import {
  getWorkspaceContract,
  getWorkspacePermissionsContract,
} from '@/lib/api/contracts/workspaces'
import { workspaceKeys } from '@/hooks/queries/workspace-keys'

export async function fetchWorkspaceSettings(workspaceId: string, signal?: AbortSignal) {
  const [settings, permissions] = await Promise.all([
    requestJson(getWorkspaceContract, { params: { id: workspaceId }, signal }),
    requestJson(getWorkspacePermissionsContract, { params: { id: workspaceId }, signal }),
  ])

  return {
    settings,
    permissions,
  }
}

/** Prefetch workspace settings and permissions before navigation. */
export function prefetchWorkspaceSettings(queryClient: QueryClient, workspaceId: string) {
  if (!workspaceId) return
  queryClient.prefetchQuery({
    queryKey: workspaceKeys.settings(workspaceId),
    queryFn: ({ signal }) => fetchWorkspaceSettings(workspaceId, signal),
    staleTime: 30 * 1000,
  })
}
