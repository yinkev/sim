import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import { listLogsContract, type WorkflowLogSummary } from '@/lib/api/contracts/logs'
import { parseQuery, queryToApiParams } from '@/lib/logs/query-parser'
import type { TimeRange } from '@/stores/logs/filters/types'

export type LogSortBy = 'date' | 'duration' | 'cost' | 'status'
export type LogSortOrder = 'asc' | 'desc'

export interface LogFilters {
  timeRange: TimeRange
  startDate?: string
  endDate?: string
  level: string
  workflowIds: string[]
  folderIds: string[]
  triggers: string[]
  searchQuery: string
  limit: number
  sortBy: LogSortBy
  sortOrder: LogSortOrder
}

export const logKeys = {
  all: ['logs'] as const,
  lists: () => [...logKeys.all, 'list'] as const,
  list: (workspaceId: string | undefined, filters: LogFilters) =>
    [...logKeys.lists(), workspaceId ?? '', filters] as const,
  details: () => [...logKeys.all, 'detail'] as const,
  workspaceDetails: (workspaceId?: string) =>
    [...logKeys.details(), workspaceId ?? ''] as const,
  detail: (workspaceId: string | undefined, logId: string | undefined) =>
    [...logKeys.workspaceDetails(workspaceId), logId ?? ''] as const,
  byExecutionAll: () => [...logKeys.all, 'byExecution'] as const,
  byExecution: (workspaceId: string | undefined, executionId: string | undefined) =>
    [...logKeys.byExecutionAll(), workspaceId ?? '', executionId ?? ''] as const,
  stats: () => [...logKeys.all, 'stats'] as const,
  stat: (workspaceId: string | undefined, filters: object) =>
    [...logKeys.stats(), workspaceId ?? '', filters] as const,
  executionSnapshots: () => [...logKeys.all, 'executionSnapshot'] as const,
  executionSnapshot: (executionId: string | undefined) =>
    [...logKeys.executionSnapshots(), executionId ?? ''] as const,
}

function getStartDateFromTimeRange(timeRange: TimeRange, startDate?: string): Date | null {
  if (timeRange === 'All time') return null

  if (timeRange === 'Custom range') {
    if (startDate) {
      const date = new Date(startDate)
      if (!startDate.includes('T')) date.setHours(0, 0, 0, 0)
      return date
    }
    return null
  }

  const now = new Date()

  switch (timeRange) {
    case 'Past 30 minutes':
      return new Date(now.getTime() - 30 * 60 * 1000)
    case 'Past hour':
      return new Date(now.getTime() - 60 * 60 * 1000)
    case 'Past 6 hours':
      return new Date(now.getTime() - 6 * 60 * 60 * 1000)
    case 'Past 12 hours':
      return new Date(now.getTime() - 12 * 60 * 60 * 1000)
    case 'Past 24 hours':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case 'Past 3 days':
      return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    case 'Past 7 days':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'Past 14 days':
      return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    case 'Past 30 days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default:
      return new Date(0)
  }
}

function getEndDateFromTimeRange(timeRange: TimeRange, endDate?: string): Date | null {
  if (timeRange !== 'Custom range') return null

  if (endDate) {
    const date = new Date(endDate)
    if (!endDate.includes('T')) {
      date.setHours(23, 59, 59, 999)
    } else {
      date.setMilliseconds(999)
    }
    return date
  }

  return null
}

export function applyFilterParams(
  params: URLSearchParams,
  filters: Omit<LogFilters, 'limit' | 'sortBy' | 'sortOrder'>
): void {
  if (filters.level !== 'all') {
    params.set('level', filters.level)
  }

  if (filters.triggers.length > 0) {
    params.set('triggers', filters.triggers.join(','))
  }

  if (filters.workflowIds.length > 0) {
    params.set('workflowIds', filters.workflowIds.join(','))
  }

  if (filters.folderIds.length > 0) {
    params.set('folderIds', filters.folderIds.join(','))
  }

  const startDate = getStartDateFromTimeRange(filters.timeRange, filters.startDate)
  if (startDate) {
    params.set('startDate', startDate.toISOString())
  }

  const endDate = getEndDateFromTimeRange(filters.timeRange, filters.endDate)
  if (endDate) {
    params.set('endDate', endDate.toISOString())
  }

  if (filters.searchQuery.trim()) {
    const parsedQuery = parseQuery(filters.searchQuery.trim())
    const searchParams = queryToApiParams(parsedQuery)

    for (const [key, value] of Object.entries(searchParams)) {
      params.set(key, value)
    }
  }
}

function buildListQuery(workspaceId: string, filters: LogFilters, cursor: string | null) {
  const params = new URLSearchParams()
  applyFilterParams(params, filters)

  return {
    workspaceId,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    ...(cursor ? { cursor } : {}),
    ...Object.fromEntries(params.entries()),
  }
}

export interface LogsPage {
  logs: WorkflowLogSummary[]
  nextCursor: string | null
}

async function fetchLogsPage(
  workspaceId: string,
  filters: LogFilters,
  cursor: string | null,
  signal?: AbortSignal
): Promise<LogsPage> {
  const apiData = await requestJson(listLogsContract, {
    query: buildListQuery(workspaceId, filters, cursor),
    signal,
  })

  return {
    logs: apiData.data,
    nextCursor: apiData.nextCursor,
  }
}

interface UseLogsListOptions {
  enabled?: boolean
  refetchInterval?: number | false
}

export function useLogsList(
  workspaceId: string | undefined,
  filters: LogFilters,
  options?: UseLogsListOptions
) {
  return useInfiniteQuery({
    queryKey: logKeys.list(workspaceId, filters),
    queryFn: ({ pageParam, signal }) =>
      fetchLogsPage(workspaceId as string, filters, pageParam, signal),
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval ?? false,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
