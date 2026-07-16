/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { keepPreviousData, requestJson, useInfiniteQuery, useQuery } = vi.hoisted(() => ({
  keepPreviousData: Symbol('keepPreviousData'),
  requestJson: vi.fn(),
  useInfiniteQuery: vi.fn((options) => options),
  useQuery: vi.fn((options) => options),
}))

vi.mock('@tanstack/react-query', () => ({
  infiniteQueryOptions: (options: unknown) => options,
  keepPreviousData,
  useInfiniteQuery,
  useMutation: vi.fn((options) => options),
  useQuery,
  useQueryClient: vi.fn(() => ({
    cancelQueries: vi.fn(),
    getQueriesData: vi.fn(() => []),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    prefetchQuery: vi.fn(),
    removeQueries: vi.fn(),
    setQueriesData: vi.fn(),
    setQueryData: vi.fn(),
  })),
}))

vi.mock('@/components/emcn', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/lib/api/client/request', () => ({ requestJson }))

import {
  knowledgeKeys as broadKnowledgeKeys,
  useKnowledgeBasesQuery as broadUseKnowledgeBasesQuery,
} from '@/hooks/queries/kb/knowledge'
import {
  knowledgeKeys as leafKnowledgeKeys,
  useKnowledgeBasesQuery as leafUseKnowledgeBasesQuery,
} from '@/hooks/queries/kb/knowledge-list'
import { logKeys as leafLogKeys, useLogsList as leafUseLogsList } from '@/hooks/queries/log-list'
import { logKeys as broadLogKeys, useLogsList as broadUseLogsList } from '@/hooks/queries/logs'
import {
  scheduleKeys as leafScheduleKeys,
  useWorkspaceSchedules as leafUseWorkspaceSchedules,
} from '@/hooks/queries/schedule-list'
import {
  scheduleKeys as broadScheduleKeys,
  useWorkspaceSchedules as broadUseWorkspaceSchedules,
} from '@/hooks/queries/schedules'
import {
  tableKeys as leafTableKeys,
  useTablesList as leafUseTablesList,
} from '@/hooks/queries/table-list'
import {
  tableKeys as broadTableKeys,
  useTablesList as broadUseTablesList,
} from '@/hooks/queries/tables'

function readQuerySource(fileName: string): string {
  return readFileSync(new URL(fileName, import.meta.url), 'utf8')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resource list query seams', () => {
  it('re-exports the exact leaf key and hook bindings from broad modules', () => {
    expect(broadTableKeys).toBe(leafTableKeys)
    expect(broadUseTablesList).toBe(leafUseTablesList)
    expect(broadKnowledgeKeys).toBe(leafKnowledgeKeys)
    expect(broadUseKnowledgeBasesQuery).toBe(leafUseKnowledgeBasesQuery)
    expect(broadLogKeys).toBe(leafLogKeys)
    expect(broadUseLogsList).toBe(leafUseLogsList)
    expect(broadScheduleKeys).toBe(leafScheduleKeys)
    expect(broadUseWorkspaceSchedules).toBe(leafUseWorkspaceSchedules)
  })

  it('keeps table list keys and query behavior unchanged', async () => {
    requestJson.mockResolvedValueOnce({ data: { tables: [{ id: 'table-1' }] } })

    const options = leafUseTablesList('workspace-1', 'archived', {
      enabled: false,
      refetchInterval: 2_000,
    })

    expect(options.queryKey).toEqual(['tables', 'list', 'workspace-1', 'archived'])
    expect(options.enabled).toBe(false)
    expect(options.staleTime).toBe(30_000)
    expect(options.placeholderData).toBe(keepPreviousData)
    expect(options.refetchInterval).toBe(2_000)

    const signal = new AbortController().signal
    await expect(options.queryFn({ signal })).resolves.toEqual([{ id: 'table-1' }])
    expect(requestJson).toHaveBeenLastCalledWith(expect.anything(), {
      query: { workspaceId: 'workspace-1', scope: 'archived' },
      signal,
    })
  })

  it('keeps knowledge list keys and query behavior unchanged', async () => {
    requestJson.mockResolvedValueOnce({ data: [{ id: 'knowledge-1' }] })

    const options = leafUseKnowledgeBasesQuery('workspace-1', {
      enabled: false,
      scope: 'archived',
    })

    expect(options.queryKey).toEqual(['knowledge', 'list', 'workspace-1', 'archived'])
    expect(options.enabled).toBe(false)
    expect(options.staleTime).toBe(60_000)
    expect(options.placeholderData).toBe(keepPreviousData)

    const signal = new AbortController().signal
    await expect(options.queryFn({ signal })).resolves.toEqual([{ id: 'knowledge-1' }])
    expect(requestJson).toHaveBeenLastCalledWith(expect.anything(), {
      query: { workspaceId: 'workspace-1', scope: 'archived' },
      signal,
    })
  })

  it('keeps log pagination, keys, and query behavior unchanged', async () => {
    const filters = {
      timeRange: 'All time' as const,
      level: 'all',
      workflowIds: [],
      folderIds: [],
      triggers: [],
      searchQuery: '',
      limit: 20,
      sortBy: 'date' as const,
      sortOrder: 'desc' as const,
    }
    requestJson.mockResolvedValueOnce({ data: [{ id: 'log-1' }], nextCursor: 'next' })

    const options = leafUseLogsList('workspace-1', filters, {
      enabled: false,
      refetchInterval: 2_000,
    })

    expect(options.queryKey).toEqual(['logs', 'list', 'workspace-1', filters])
    expect(options.enabled).toBe(false)
    expect(options.refetchInterval).toBe(2_000)
    expect(options.staleTime).toBe(30_000)
    expect(options.placeholderData).toBe(keepPreviousData)
    expect(options.initialPageParam).toBeNull()
    expect(options.getNextPageParam({ nextCursor: 'next' })).toBe('next')

    const signal = new AbortController().signal
    await expect(options.queryFn({ pageParam: null, signal })).resolves.toEqual({
      logs: [{ id: 'log-1' }],
      nextCursor: 'next',
    })
    expect(requestJson).toHaveBeenLastCalledWith(expect.anything(), {
      query: {
        workspaceId: 'workspace-1',
        limit: 20,
        sortBy: 'date',
        sortOrder: 'desc',
      },
      signal,
    })
  })

  it('keeps schedule list keys and query behavior unchanged', async () => {
    requestJson.mockResolvedValueOnce({ schedules: [{ id: 'schedule-1' }] })

    const options = leafUseWorkspaceSchedules('workspace-1', { enabled: false })

    expect(options.queryKey).toEqual(['schedules', 'list', 'workspace-1'])
    expect(options.enabled).toBe(false)
    expect(options.staleTime).toBe(30_000)
    expect(options.placeholderData).toBe(keepPreviousData)

    const signal = new AbortController().signal
    await expect(options.queryFn({ signal })).resolves.toEqual([{ id: 'schedule-1' }])
    expect(requestJson).toHaveBeenLastCalledWith(expect.anything(), {
      query: { workspaceId: 'workspace-1' },
      signal,
    })
  })

  it('keeps leaf modules free of mutation dependencies', () => {
    for (const fileName of [
      'table-list.ts',
      'kb/knowledge-list.ts',
      'log-list.ts',
      'schedule-list.ts',
    ]) {
      expect(readQuerySource(fileName)).not.toMatch(/useMutation|useQueryClient|toast/)
    }
    expect(readQuerySource('log-list.ts')).not.toContain('@/lib/logs/filters')
  })
})
