import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import { type FolderApi, listFoldersContract } from '@/lib/api/contracts/folders'
import { type FolderQueryScope, folderKeys } from '@/hooks/queries/utils/folder-keys'
import type { WorkflowFolder } from '@/stores/folders/types'

export { type FolderQueryScope, folderKeys } from '@/hooks/queries/utils/folder-keys'

export function mapFolder(folder: FolderApi): WorkflowFolder {
  return {
    id: folder.id,
    name: folder.name,
    userId: folder.userId,
    workspaceId: folder.workspaceId,
    parentId: folder.parentId,
    color: folder.color ?? '#6B7280',
    isExpanded: folder.isExpanded,
    locked: folder.locked,
    sortOrder: folder.sortOrder,
    createdAt: new Date(folder.createdAt),
    updatedAt: new Date(folder.updatedAt),
    archivedAt: folder.archivedAt ? new Date(folder.archivedAt) : null,
  }
}

async function fetchFolders(
  workspaceId: string,
  scope: FolderQueryScope = 'active',
  signal?: AbortSignal
): Promise<WorkflowFolder[]> {
  const { folders } = await requestJson(listFoldersContract, {
    query: { workspaceId, scope },
    signal,
  })
  return folders.map(mapFolder)
}

export function useFolders(
  workspaceId?: string,
  options?: { enabled?: boolean; scope?: FolderQueryScope }
) {
  const scope = options?.scope ?? 'active'
  return useQuery({
    queryKey: folderKeys.list(workspaceId, scope),
    queryFn: ({ signal }) => fetchFolders(workspaceId as string, scope, signal),
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })
}

const selectFolderMap = (folders: WorkflowFolder[]): Record<string, WorkflowFolder> =>
  Object.fromEntries(folders.map((folder) => [folder.id, folder]))

export function useFolderMap(workspaceId?: string) {
  return useQuery({
    queryKey: folderKeys.list(workspaceId),
    queryFn: ({ signal }) => fetchFolders(workspaceId as string, 'active', signal),
    enabled: Boolean(workspaceId),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    select: selectFolderMap,
  })
}
