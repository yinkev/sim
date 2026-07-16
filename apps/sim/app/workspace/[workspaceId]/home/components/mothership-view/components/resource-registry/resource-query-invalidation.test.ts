/**
 * @vitest-environment node
 */
import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { MothershipResourceType } from '@/app/workspace/[workspaceId]/home/types'
import { invalidateResourceQueries } from './resource-query-invalidation'

const WORKSPACE_ID = 'workspace-1'
const RESOURCE_ID = 'resource-1'

const EXPECTED_QUERY_KEYS: Record<MothershipResourceType, readonly (readonly unknown[])[]> = {
  generic: [],
  table: [
    ['tables', 'list'],
    ['tables', 'detail', RESOURCE_ID],
  ],
  file: [
    ['workspaceFiles', 'list'],
    ['workspaceFiles', 'content', WORKSPACE_ID, RESOURCE_ID],
    ['workspaceFiles', 'storageInfo'],
  ],
  workflow: [
    ['workflows', 'list', WORKSPACE_ID, 'active'],
    ['selectors', 'sim.workflows', WORKSPACE_ID],
  ],
  knowledgebase: [
    ['knowledge', 'list'],
    ['knowledge', 'detail', RESOURCE_ID],
    ['knowledge', 'detail', RESOURCE_ID, 'tagDefinitions'],
  ],
  folder: [['folders', 'list']],
  filefolder: [['workspaceFileFolders', 'list', WORKSPACE_ID]],
  task: [['mothership-chats', 'list', WORKSPACE_ID]],
  scheduledtask: [['schedules', 'list', WORKSPACE_ID]],
  log: [
    ['logs', 'detail'],
    ['logs', 'detail', WORKSPACE_ID, RESOURCE_ID],
  ],
  integration: [],
}

describe('invalidateResourceQueries', () => {
  it.each(Object.entries(EXPECTED_QUERY_KEYS))(
    'preserves %s invalidation query keys and order',
    (resourceType, expectedQueryKeys) => {
      const invalidateQueries = vi.fn().mockResolvedValue(undefined)
      const queryClient = { invalidateQueries } as unknown as QueryClient

      invalidateResourceQueries(
        queryClient,
        WORKSPACE_ID,
        resourceType as MothershipResourceType,
        RESOURCE_ID
      )

      expect(invalidateQueries.mock.calls.map(([filters]) => filters.queryKey)).toEqual(
        expectedQueryKeys
      )
    }
  )
})
