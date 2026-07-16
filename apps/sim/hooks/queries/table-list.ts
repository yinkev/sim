'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import { listTablesContract } from '@/lib/api/contracts/tables'
import type { TableDefinition } from '@/lib/table'

type TableQueryScope = 'active' | 'archived' | 'all'

export const tableKeys = {
  all: ['tables'] as const,
  lists: () => [...tableKeys.all, 'list'] as const,
  list: (workspaceId?: string, scope: TableQueryScope = 'active') =>
    [...tableKeys.lists(), workspaceId ?? '', scope] as const,
  details: () => [...tableKeys.all, 'detail'] as const,
  detail: (tableId: string) => [...tableKeys.details(), tableId] as const,
  exportJobs: (workspaceId?: string) =>
    [...tableKeys.all, 'export-jobs', workspaceId ?? ''] as const,
  rowsRoot: (tableId: string) => [...tableKeys.detail(tableId), 'rows'] as const,
  infiniteRows: (tableId: string, paramsKey: string) =>
    [...tableKeys.rowsRoot(tableId), 'infinite', paramsKey] as const,
  rowWrites: (tableId: string) => [...tableKeys.rowsRoot(tableId), 'write'] as const,
  find: (tableId: string, paramsKey: string) =>
    [...tableKeys.rowsRoot(tableId), 'find', paramsKey] as const,
  activeDispatches: (tableId: string) =>
    [...tableKeys.detail(tableId), 'active-dispatches'] as const,
}

/**
 * Fetch all tables for a workspace.
 */
export function useTablesList(
  workspaceId?: string,
  scope: TableQueryScope = 'active',
  options?: {
    enabled?: boolean
    /** Poll cadence, or a predicate over the current list that returns a cadence (or `false`). */
    refetchInterval?: number | false | ((tables: TableDefinition[] | undefined) => number | false)
  }
) {
  const refetchInterval = options?.refetchInterval
  return useQuery({
    queryKey: tableKeys.list(workspaceId, scope),
    queryFn: async ({ signal }) => {
      if (!workspaceId) throw new Error('Workspace ID required')

      const response = await requestJson(listTablesContract, {
        query: { workspaceId, scope },
        signal,
      })
      return response.data.tables
    },
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    refetchInterval:
      typeof refetchInterval === 'function'
        ? (query) => refetchInterval(query.state.data)
        : (refetchInterval ?? false),
  })
}
