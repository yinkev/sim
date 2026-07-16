'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import { listTablesContract } from '@/lib/api/contracts/tables'
import type { TableDefinition } from '@/lib/table'
import { type TableQueryScope, tableKeys } from '@/hooks/queries/utils/table-keys'

export { type TableQueryScope, tableKeys } from '@/hooks/queries/utils/table-keys'

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
