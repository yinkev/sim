import {
  type InfiniteData,
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { isApiClientError } from '@/lib/api/client/errors'
import { requestJson } from '@/lib/api/client/request'
import {
  cancelWorkflowExecutionContract,
  type DashboardStatsResponse,
  type ExecutionSnapshotData,
  getDashboardStatsContract,
  getExecutionSnapshotContract,
  getLogByExecutionIdContract,
  getLogDetailContract,
  type WorkflowLogDetail,
  type WorkflowStats,
} from '@/lib/api/contracts/logs'
import type { LogFilters, LogSortBy, LogSortOrder, LogsPage } from '@/hooks/queries/log-list'
import { applyFilterParams, logKeys, useLogsList } from '@/hooks/queries/log-list'

export type { DashboardStatsResponse, WorkflowStats }

export { logKeys, useLogsList }
export type { LogFilters, LogSortBy, LogSortOrder }

export async function fetchLogDetail(
  logId: string,
  workspaceId: string,
  signal?: AbortSignal
): Promise<WorkflowLogDetail> {
  const { data } = await requestJson(getLogDetailContract, {
    params: { id: logId },
    query: { workspaceId },
    signal,
  })
  return data
}

interface UseLogDetailOptions {
  enabled?: boolean
  refetchInterval?:
    | number
    | false
    | ((query: { state: { data?: WorkflowLogDetail } }) => number | false | undefined)
}

export function useLogDetail(
  logId: string | undefined,
  workspaceId: string | undefined,
  options?: UseLogDetailOptions
) {
  return useQuery({
    queryKey: logKeys.detail(logId),
    queryFn: ({ signal }) => fetchLogDetail(logId as string, workspaceId as string, signal),
    enabled: Boolean(logId) && Boolean(workspaceId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval ?? false,
    staleTime: 30 * 1000,
    retry: (failureCount, err) =>
      !(isApiClientError(err) && err.status === 404) && failureCount < 3,
  })
}

export function useLogByExecutionId(
  workspaceId: string | undefined,
  executionId: string | null | undefined
) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: logKeys.byExecution(workspaceId, executionId ?? undefined),
    queryFn: async ({ signal }) => {
      const { data } = await requestJson(getLogByExecutionIdContract, {
        params: { executionId: executionId as string },
        query: { workspaceId: workspaceId as string },
        signal,
      })
      queryClient.setQueryData(logKeys.detail(data.id), data)
      return data
    },
    enabled: Boolean(workspaceId) && Boolean(executionId),
    staleTime: 30 * 1000,
  })
}

export function prefetchLogDetail(queryClient: QueryClient, logId: string, workspaceId: string) {
  queryClient.prefetchQuery({
    queryKey: logKeys.detail(logId),
    queryFn: ({ signal }) => fetchLogDetail(logId, workspaceId, signal),
    staleTime: 30 * 1000,
  })
}

async function fetchDashboardStats(
  workspaceId: string,
  filters: Omit<LogFilters, 'limit' | 'sortBy' | 'sortOrder'>,
  signal?: AbortSignal
): Promise<DashboardStatsResponse> {
  const params = new URLSearchParams()
  applyFilterParams(params, filters)

  return requestJson(getDashboardStatsContract, {
    query: {
      workspaceId,
      ...Object.fromEntries(params.entries()),
    },
    signal,
  })
}

interface UseDashboardStatsOptions {
  enabled?: boolean
  refetchInterval?: number | false
}

export function useDashboardStats(
  workspaceId: string | undefined,
  filters: Omit<LogFilters, 'limit' | 'sortBy' | 'sortOrder'>,
  options?: UseDashboardStatsOptions
) {
  return useQuery({
    queryKey: logKeys.stat(workspaceId, filters),
    queryFn: ({ signal }) => fetchDashboardStats(workspaceId as string, filters, signal),
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval ?? false,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}

export type { ExecutionSnapshotData }

async function fetchExecutionSnapshot(
  executionId: string,
  signal?: AbortSignal
): Promise<ExecutionSnapshotData> {
  const data = await requestJson(getExecutionSnapshotContract, {
    params: { executionId },
    signal,
  })
  if (!data) {
    throw new Error('No execution snapshot data returned')
  }

  return data
}

export function useExecutionSnapshot(executionId: string | undefined) {
  return useQuery({
    queryKey: logKeys.executionSnapshot(executionId),
    queryFn: ({ signal }) => fetchExecutionSnapshot(executionId as string, signal),
    enabled: Boolean(executionId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCancelExecution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      workflowId,
      executionId,
    }: {
      workflowId: string
      executionId: string
    }) => {
      const data = await requestJson(cancelWorkflowExecutionContract, {
        params: { id: workflowId, executionId },
      })
      if (!data.success) throw new Error('Failed to cancel run')
      return data
    },
    onMutate: async ({ executionId }) => {
      await queryClient.cancelQueries({ queryKey: logKeys.lists() })

      const previousQueries = queryClient.getQueriesData<InfiniteData<LogsPage>>({
        queryKey: logKeys.lists(),
      })

      let affectedLogId: string | null = null
      queryClient.setQueriesData<InfiniteData<LogsPage>>({ queryKey: logKeys.lists() }, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            logs: page.logs.map((log) => {
              if (log.executionId !== executionId) return log
              affectedLogId = log.id
              return { ...log, status: 'cancelling' }
            }),
          })),
        }
      })

      let previousDetail: WorkflowLogDetail | undefined
      if (affectedLogId) {
        previousDetail = queryClient.getQueryData<WorkflowLogDetail>(logKeys.detail(affectedLogId))
        if (previousDetail) {
          queryClient.setQueryData<WorkflowLogDetail>(logKeys.detail(affectedLogId), {
            ...previousDetail,
            status: 'cancelling',
          })
        }
      }

      return { previousQueries, affectedLogId, previousDetail }
    },
    onError: (_err, _variables, context) => {
      for (const [queryKey, data] of context?.previousQueries ?? []) {
        queryClient.setQueryData(queryKey, data)
      }
      if (context?.affectedLogId && context.previousDetail !== undefined) {
        queryClient.setQueryData(logKeys.detail(context.affectedLogId), context.previousDetail)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: logKeys.lists() })
      queryClient.invalidateQueries({ queryKey: logKeys.details() })
      queryClient.invalidateQueries({ queryKey: logKeys.byExecutionAll() })
      queryClient.invalidateQueries({ queryKey: logKeys.stats() })
    },
  })
}

export function useRetryExecution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workflowId, input }: { workflowId: string; input?: unknown }) => {
      // boundary-raw-fetch: stream response, body is a ReadableStream consumed one chunk at a time
      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, triggerType: 'manual', stream: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to retry execution')
      }
      const reader = res.body?.getReader()
      if (reader) {
        await reader.read()
        reader.cancel()
      }
      return { started: true }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: logKeys.lists() })
      queryClient.invalidateQueries({ queryKey: logKeys.details() })
      queryClient.invalidateQueries({ queryKey: logKeys.byExecutionAll() })
      queryClient.invalidateQueries({ queryKey: logKeys.stats() })
    },
  })
}
