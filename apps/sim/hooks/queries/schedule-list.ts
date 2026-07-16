import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import {
  listWorkspaceSchedulesContract,
  type WorkflowScheduleRow,
  type WorkspaceScheduleRow,
} from '@/lib/api/contracts/schedules'

export const scheduleKeys = {
  all: ['schedules'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...scheduleKeys.lists(), workspaceId] as const,
  details: () => [...scheduleKeys.all, 'detail'] as const,
  schedule: (workflowId: string, blockId: string) =>
    [...scheduleKeys.details(), workflowId, blockId] as const,
  byId: (scheduleId: string) => [...scheduleKeys.details(), scheduleId] as const,
}

export type ScheduleData = WorkflowScheduleRow
export type WorkspaceScheduleData = WorkspaceScheduleRow

/**
 * Fetch all schedules for a workspace.
 */
export function useWorkspaceSchedules(workspaceId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: scheduleKeys.list(workspaceId ?? ''),
    queryFn: async ({ signal }) => {
      if (!workspaceId) throw new Error('Workspace ID required')

      const data = await requestJson(listWorkspaceSchedulesContract, {
        query: { workspaceId },
        signal,
      })
      return data.schedules || []
    },
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}
