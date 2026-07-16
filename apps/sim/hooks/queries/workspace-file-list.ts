import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import { listWorkspaceFilesContract } from '@/lib/api/contracts/workspace-files'
import type { WorkspaceFileRecord } from '@/lib/uploads/contexts/workspace'
import {
  type WorkspaceFileQueryScope,
  workspaceFilesKeys,
} from '@/hooks/queries/workspace-file-keys'

/**
 * Fetch workspace files from the API.
 */
async function fetchWorkspaceFiles(
  workspaceId: string,
  scope: WorkspaceFileQueryScope = 'active',
  signal?: AbortSignal
): Promise<WorkspaceFileRecord[]> {
  const data = await requestJson(listWorkspaceFilesContract, {
    params: { id: workspaceId },
    query: { scope },
    signal,
  })
  return data.success ? data.files : []
}

/**
 * Fetch a single workspace file record by ID.
 * Shares the `list(workspaceId, 'active')` query key with {@link useWorkspaceFiles} so no extra
 * network request is made when the list is already cached (warm path).
 * On a cold path (e.g. direct navigation to a file URL), this fetches the full active file list
 * for the workspace and selects the matching record via `select`.
 */
export function useWorkspaceFileRecord(workspaceId: string, fileId: string) {
  return useQuery({
    queryKey: workspaceFilesKeys.list(workspaceId, 'active'),
    queryFn: ({ signal }) => fetchWorkspaceFiles(workspaceId, 'active', signal),
    enabled: !!workspaceId && !!fileId,
    staleTime: 30 * 1000,
    select: (files) => files.find((file) => file.id === fileId) ?? null,
  })
}

/**
 * Fetch workspace files.
 */
export function useWorkspaceFiles(
  workspaceId: string,
  scope: WorkspaceFileQueryScope = 'active',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: workspaceFilesKeys.list(workspaceId, scope),
    queryFn: ({ signal }) => fetchWorkspaceFiles(workspaceId, scope, signal),
    enabled: !!workspaceId && (options?.enabled ?? true),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}
