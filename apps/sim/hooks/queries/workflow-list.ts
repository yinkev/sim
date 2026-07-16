import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { type WorkflowQueryScope, workflowKeys } from '@/hooks/queries/utils/workflow-keys'
import {
  getWorkflowListQueryOptions,
  WORKFLOW_LIST_STALE_TIME,
} from '@/hooks/queries/utils/workflow-list-query'
import type { WorkflowMetadata } from '@/stores/workflows/registry/types'

export { type WorkflowQueryScope, workflowKeys } from '@/hooks/queries/utils/workflow-keys'

export function useWorkflows(
  workspaceId?: string,
  options?: { enabled?: boolean; scope?: WorkflowQueryScope }
) {
  const { scope = 'active' } = options || {}

  return useQuery({
    queryKey: workflowKeys.list(workspaceId, scope),
    queryFn: workspaceId ? getWorkflowListQueryOptions(workspaceId, scope).queryFn : skipToken,
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: WORKFLOW_LIST_STALE_TIME,
  })
}

const selectWorkflowMap = (data: WorkflowMetadata[]): Record<string, WorkflowMetadata> =>
  Object.fromEntries(data.map((workflow) => [workflow.id, workflow]))

/**
 * Returns workflows as a `Record<string, WorkflowMetadata>` keyed by ID.
 * Uses the `select` option so the transformation runs inside React Query
 * with structural sharing — components only re-render when the record changes.
 */
export function useWorkflowMap(workspaceId?: string, options?: { scope?: WorkflowQueryScope }) {
  const { scope = 'active' } = options || {}

  return useQuery({
    queryKey: workflowKeys.list(workspaceId, scope),
    queryFn: workspaceId ? getWorkflowListQueryOptions(workspaceId, scope).queryFn : skipToken,
    placeholderData: keepPreviousData,
    staleTime: WORKFLOW_LIST_STALE_TIME,
    select: selectWorkflowMap,
  })
}
