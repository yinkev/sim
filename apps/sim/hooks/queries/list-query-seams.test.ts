import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readQuerySource(fileName: string): string {
  try {
    return readFileSync(new URL(fileName, import.meta.url), 'utf8')
  } catch {
    return ''
  }
}

describe('list query seams', () => {
  it('keeps folder list reads independent from folder mutations', () => {
    const folderList = readQuerySource('folder-list.ts')
    const folders = readQuerySource('folders.ts')

    expect(folderList).toContain('export function useFolders')
    expect(folderList).toContain('export function useFolderMap')
    expect(folderList).toContain('queryKey: folderKeys.list(workspaceId, scope)')
    expect(folderList).toContain(
      'queryFn: ({ signal }) => fetchFolders(workspaceId as string, scope, signal)'
    )
    expect(folderList).toContain('enabled: Boolean(workspaceId)')
    expect(folderList).toContain('placeholderData: keepPreviousData')
    expect(folderList).toContain('staleTime: 60 * 1000')
    expect(folderList).not.toMatch(/useMutation|createFolderContract|deleteFolderContract/)
    expect(folders).toContain(
      "export { useFolderMap, useFolders } from '@/hooks/queries/folder-list'"
    )
    expect(folders).not.toMatch(/export function useFolders|export function useFolderMap/)
  })

  it('keeps workflow list reads independent from workflow mutations', () => {
    const workflowList = readQuerySource('workflow-list.ts')
    const workflows = readQuerySource('workflows.ts')

    expect(workflowList).toContain('export function useWorkflows')
    expect(workflowList).toContain('export function useWorkflowMap')
    expect(workflowList).toContain('queryKey: workflowKeys.list(workspaceId, scope)')
    expect(workflowList).toContain(
      'queryFn: workspaceId ? getWorkflowListQueryOptions(workspaceId, scope).queryFn : skipToken'
    )
    expect(workflowList).toContain('placeholderData: keepPreviousData')
    expect(workflowList).toContain('staleTime: WORKFLOW_LIST_STALE_TIME')
    expect(workflowList).not.toMatch(/useMutation|createWorkflowContract|deleteWorkflowContract/)
    expect(workflows).toContain(
      "export { useWorkflowMap, useWorkflows } from '@/hooks/queries/workflow-list'"
    )
    expect(workflows).not.toMatch(/export function useWorkflows|export function useWorkflowMap/)
  })
})
