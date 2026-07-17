/**
 * @vitest-environment node
 */
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPrefetchInternalJson } = vi.hoisted(() => ({
  mockPrefetchInternalJson: vi.fn(),
}))

vi.mock('@/app/workspace/[workspaceId]/lib/prefetch-internal-fetch', () => ({
  prefetchInternalJson: mockPrefetchInternalJson,
}))

vi.mock('@/components/emcn', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { prefetchHomeLists } from '@/app/workspace/[workspaceId]/home/prefetch'
import { folderKeys } from '@/hooks/queries/utils/folder-keys'
import { workspaceFilesKeys } from '@/hooks/queries/workspace-files'

const WORKSPACE_ID = 'ws-123'

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('workspace list prefetches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('prefetchHomeLists', () => {
    it('primes folder + file keys, mapping folder rows to the client shape', async () => {
      const folderRow = {
        id: 'folder-1',
        name: 'Docs',
        userId: 'u-1',
        workspaceId: WORKSPACE_ID,
        parentId: null,
        color: null,
        isExpanded: true,
        locked: false,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        archivedAt: null,
      }
      const files = [{ id: 'f-1' }]
      mockPrefetchInternalJson.mockImplementation(async (path: string) =>
        path.startsWith('/api/folders') ? { folders: [folderRow] } : { success: true, files }
      )
      const client = makeClient()

      await prefetchHomeLists(client, WORKSPACE_ID)

      expect(mockPrefetchInternalJson).toHaveBeenCalledWith(
        `/api/folders?workspaceId=${WORKSPACE_ID}&scope=active`
      )
      const cachedFolders = client.getQueryData(folderKeys.list(WORKSPACE_ID, 'active')) as Array<{
        id: string
        color: string
        createdAt: Date
      }>
      expect(cachedFolders).toHaveLength(1)
      expect(cachedFolders[0].color).toBe('#6B7280')
      expect(cachedFolders[0].createdAt).toBeInstanceOf(Date)
      expect(client.getQueryData(workspaceFilesKeys.list(WORKSPACE_ID, 'active'))).toEqual(files)
    })
  })

  describe('graceful failure', () => {
    it('does not throw when the home fetcher rejects', async () => {
      mockPrefetchInternalJson.mockRejectedValue(new Error('500'))
      const client = makeClient()

      await expect(prefetchHomeLists(client, WORKSPACE_ID)).resolves.toBeUndefined()
      expect(client.getQueryData(folderKeys.list(WORKSPACE_ID, 'active'))).toBeUndefined()
    })
  })
})
