import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ApiClientError } from '@/lib/api/client/errors'
import type { WorkspacePermissions } from '@/lib/api/contracts/workspaces'
import { workspaceKeys } from '@/hooks/queries/workspace-keys'

export type { WorkspacePermissions } from '@/lib/api/contracts/workspaces'

export const workspacePermissionsKey = workspaceKeys.permissions

async function fetchWorkspacePermissions(
  workspaceId: string,
  signal?: AbortSignal
): Promise<WorkspacePermissions> {
  try {
    const [{ requestJson }, { getWorkspacePermissionsContract }] = await Promise.all([
      import('@/lib/api/client/request'),
      import('@/lib/api/contracts/workspaces'),
    ])
    return await requestJson(getWorkspacePermissionsContract, {
      params: { id: workspaceId },
      signal,
    })
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new Error('Workspace not found or access denied', { cause: error })
    }
    if (error instanceof ApiClientError && error.status === 401) {
      throw new Error('Authentication required', { cause: error })
    }
    throw error
  }
}

export function useWorkspacePermissionsQuery(
  workspaceId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: workspacePermissionsKey(workspaceId ?? ''),
    queryFn: ({ signal }) => fetchWorkspacePermissions(workspaceId as string, signal),
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}
