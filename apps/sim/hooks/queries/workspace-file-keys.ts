export type WorkspaceFileQueryScope = 'active' | 'archived' | 'all'

/**
 * Query key factories for workspace files.
 */
export const workspaceFilesKeys = {
  all: ['workspaceFiles'] as const,
  lists: () => [...workspaceFilesKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...workspaceFilesKeys.lists(), workspaceId] as const,
  list: (workspaceId: string, scope: WorkspaceFileQueryScope = 'active') =>
    [...workspaceFilesKeys.workspaceLists(workspaceId), scope] as const,
  contents: () => [...workspaceFilesKeys.all, 'content'] as const,
  contentFile: (workspaceId: string, fileId: string) =>
    [...workspaceFilesKeys.contents(), workspaceId, fileId] as const,
  content: (
    workspaceId: string,
    fileId: string,
    mode: 'text' | 'raw' | 'binary' = 'text',
    storageKey?: string
  ) =>
    [
      ...workspaceFilesKeys.contentFile(workspaceId, fileId),
      mode,
      ...(storageKey ? [storageKey] : []),
    ] as const,
  storageInfo: () => [...workspaceFilesKeys.all, 'storageInfo'] as const,
}
