/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { keepPreviousData, requestJson, useQuery } = vi.hoisted(() => ({
  keepPreviousData: Symbol('keepPreviousData'),
  requestJson: vi.fn(),
  useQuery: vi.fn((options) => options),
}))

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData,
  useMutation: vi.fn(),
  useQuery,
  useQueryClient: vi.fn(),
}))

vi.mock('@/components/emcn', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/lib/api/client/request', () => ({ requestJson }))

vi.mock('@/lib/uploads/client/direct-upload', () => ({
  DirectUploadError: class DirectUploadError extends Error {},
  runUploadStrategy: vi.fn(),
}))

import { listWorkspaceFilesContract } from '@/lib/api/contracts/workspace-files'
import { useWorkspaceFiles, workspaceFilesKeys } from '@/hooks/queries/workspace-files'

function readOptionalSource(relativePath: string): string {
  try {
    return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  } catch {
    return ''
  }
}

describe('workspace file list query seam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves every workspace file query key shape', () => {
    expect(workspaceFilesKeys.all).toEqual(['workspaceFiles'])
    expect(workspaceFilesKeys.lists()).toEqual(['workspaceFiles', 'list'])
    expect(workspaceFilesKeys.workspaceLists('workspace-1')).toEqual([
      'workspaceFiles',
      'list',
      'workspace-1',
    ])
    expect(workspaceFilesKeys.list('workspace-1')).toEqual([
      'workspaceFiles',
      'list',
      'workspace-1',
      'active',
    ])
    expect(workspaceFilesKeys.list('workspace-1', 'archived')).toEqual([
      'workspaceFiles',
      'list',
      'workspace-1',
      'archived',
    ])
    expect(workspaceFilesKeys.contents()).toEqual(['workspaceFiles', 'content'])
    expect(workspaceFilesKeys.contentFile('workspace-1', 'file-1')).toEqual([
      'workspaceFiles',
      'content',
      'workspace-1',
      'file-1',
    ])
    expect(workspaceFilesKeys.content('workspace-1', 'file-1')).toEqual([
      'workspaceFiles',
      'content',
      'workspace-1',
      'file-1',
      'text',
    ])
    expect(workspaceFilesKeys.content('workspace-1', 'file-1', 'raw', 'storage-key')).toEqual([
      'workspaceFiles',
      'content',
      'workspace-1',
      'file-1',
      'raw',
      'storage-key',
    ])
    expect(workspaceFilesKeys.storageInfo()).toEqual(['workspaceFiles', 'storageInfo'])
  })

  it('preserves list request, cancellation, and cache behavior', async () => {
    const files = [{ id: 'file-1' }]
    const signal = new AbortController().signal
    requestJson.mockResolvedValue({ success: true, files })

    useWorkspaceFiles('workspace-1', 'archived', { enabled: false })

    const options = useQuery.mock.calls[0][0] as {
      enabled: boolean
      placeholderData: unknown
      queryFn: (context: { signal: AbortSignal }) => Promise<unknown>
      queryKey: readonly string[]
      staleTime: number
    }

    expect(options.queryKey).toEqual(['workspaceFiles', 'list', 'workspace-1', 'archived'])
    expect(options.enabled).toBe(false)
    expect(options.staleTime).toBe(30_000)
    expect(options.placeholderData).toBe(keepPreviousData)
    await expect(options.queryFn({ signal })).resolves.toBe(files)
    expect(requestJson).toHaveBeenCalledWith(listWorkspaceFilesContract, {
      params: { id: 'workspace-1' },
      query: { scope: 'archived' },
      signal,
    })
  })

  it('keeps one narrow implementation with broad compatibility exports', () => {
    const keysSource = readOptionalSource('./workspace-file-keys.ts')
    const listSource = readOptionalSource('./workspace-file-list.ts')
    const broadSource = readOptionalSource('./workspace-files.ts')

    expect(keysSource).toContain('export const workspaceFilesKeys')
    expect(listSource).toContain('export function useWorkspaceFiles')
    expect(listSource).toContain('export function useWorkspaceFileRecord')
    expect(listSource).not.toMatch(/@sim\/logger|@\/components\/emcn|direct-upload/)
    expect(broadSource).toContain("from '@/hooks/queries/workspace-file-keys'")
    expect(broadSource).toContain("from '@/hooks/queries/workspace-file-list'")
    expect(broadSource).not.toMatch(/export const workspaceFilesKeys\s*=/)
    expect(broadSource).not.toMatch(/export function useWorkspaceFiles\s*\(/)
    expect(broadSource).not.toMatch(/async function fetchWorkspaceFiles\s*\(/)
  })
})
