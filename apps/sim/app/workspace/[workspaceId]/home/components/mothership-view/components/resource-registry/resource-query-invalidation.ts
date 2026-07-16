import type { QueryClient } from '@tanstack/react-query'
import type { MothershipResourceType } from '@/app/workspace/[workspaceId]/home/types'
import { knowledgeKeys } from '@/hooks/queries/kb/knowledge-list'
import { logKeys } from '@/hooks/queries/log-list'
import { mothershipChatKeys } from '@/hooks/queries/mothership-chat-keys'
import { scheduleKeys } from '@/hooks/queries/schedule-list'
import { tableKeys } from '@/hooks/queries/utils/table-keys'
import { folderKeys } from '@/hooks/queries/utils/folder-keys'
import { invalidateWorkflowLists } from '@/hooks/queries/utils/invalidate-workflow-lists'
import { workspaceFileFolderKeys } from '@/hooks/queries/workspace-file-folders'
import { workspaceFilesKeys } from '@/hooks/queries/workspace-files'

type CacheableResourceType = Exclude<MothershipResourceType, 'generic'>

const RESOURCE_INVALIDATORS: Record<
  CacheableResourceType,
  (qc: QueryClient, workspaceId: string, resourceId: string) => void
> = {
  table: (qc, _wId, id) => {
    qc.invalidateQueries({ queryKey: tableKeys.lists() })
    qc.invalidateQueries({ queryKey: tableKeys.detail(id) })
  },
  file: (qc, wId, id) => {
    qc.invalidateQueries({ queryKey: workspaceFilesKeys.lists() })
    qc.invalidateQueries({ queryKey: workspaceFilesKeys.contentFile(wId, id) })
    qc.invalidateQueries({ queryKey: workspaceFilesKeys.storageInfo() })
  },
  workflow: (qc, wId) => {
    void invalidateWorkflowLists(qc, wId)
  },
  knowledgebase: (qc, _wId, id) => {
    qc.invalidateQueries({ queryKey: knowledgeKeys.lists() })
    qc.invalidateQueries({ queryKey: knowledgeKeys.detail(id) })
    qc.invalidateQueries({ queryKey: knowledgeKeys.tagDefinitions(id) })
  },
  folder: (qc) => {
    qc.invalidateQueries({ queryKey: folderKeys.lists() })
  },
  filefolder: (qc, wId) => {
    qc.invalidateQueries({ queryKey: workspaceFileFolderKeys.workspaceLists(wId) })
  },
  task: (qc, wId) => {
    qc.invalidateQueries({ queryKey: mothershipChatKeys.list(wId) })
  },
  scheduledtask: (qc, wId) => {
    qc.invalidateQueries({ queryKey: scheduleKeys.list(wId) })
  },
  log: (qc, wId, id) => {
    qc.invalidateQueries({ queryKey: logKeys.details() })
    qc.invalidateQueries({ queryKey: logKeys.detail(wId, id) })
  },
  /**
   * Integrations are sourced from the static integration catalog
   * (`listIntegrations()`), not a server-backed query, so there is nothing to
   * invalidate when one is added.
   */
  integration: () => {},
}

/**
 * Invalidate list and detail queries for a specific resource.
 * Called when a `resource_added` event arrives so the embedded view refreshes
 * and the add-resource dropdown stays up to date.
 */
export function invalidateResourceQueries(
  queryClient: QueryClient,
  workspaceId: string,
  resourceType: MothershipResourceType,
  resourceId: string
): void {
  if (resourceType === 'generic') return
  RESOURCE_INVALIDATORS[resourceType](queryClient, workspaceId, resourceId)
}
