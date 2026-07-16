import { getQueryClient } from '@/app/_shell/providers/get-query-client'
import { type WorkflowQueryScope, workflowKeys } from '@/hooks/queries/utils/workflow-keys'
import type { WorkflowMetadata } from '@/stores/workflows/registry/types'
import type { WorkflowState } from '@/stores/workflows/workflow/types'

const EMPTY_WORKFLOWS: WorkflowMetadata[] = []

/**
 * Reads workflow metadata for a workspace directly from the React Query cache.
 */
export function getWorkflows(
  workspaceId: string,
  scope: WorkflowQueryScope = 'active'
): WorkflowMetadata[] {
  return (
    getQueryClient().getQueryData<WorkflowMetadata[]>(workflowKeys.list(workspaceId, scope)) ??
    EMPTY_WORKFLOWS
  )
}

/**
 * Reads a single workflow by id from the React Query cache.
 */
export function getWorkflowById(
  workspaceId: string,
  workflowId: string,
  scope: WorkflowQueryScope = 'active'
): WorkflowMetadata | undefined {
  return getWorkflows(workspaceId, scope).find((workflow) => workflow.id === workflowId)
}

/**
 * Finds workflow metadata across already-populated list queries. This is used
 * by workspace-level presentation code that knows a workflow id but should not
 * import or initialize the editor registry merely to render a display name.
 */
export function findCachedWorkflowById(workflowId: string): WorkflowMetadata | undefined {
  const cachedLists = getQueryClient().getQueriesData<WorkflowMetadata[]>({
    queryKey: workflowKeys.lists(),
  })

  for (const [, workflows] of cachedLists) {
    const workflow = workflows?.find((candidate) => candidate.id === workflowId)
    if (workflow) return workflow
  }

  return undefined
}

/**
 * Finds a block in any already-populated workflow-state query. Workflow and
 * block ids are generated identifiers, so the first cached match is canonical
 * for display-only labels.
 */
export function findCachedWorkflowBlockById(
  blockId: string
): WorkflowState['blocks'][string] | undefined {
  const cachedStates = getQueryClient().getQueriesData<WorkflowState | null>({
    queryKey: workflowKeys.states(),
  })

  for (const [, state] of cachedStates) {
    const block = state?.blocks?.[blockId]
    if (block) return block
  }

  return undefined
}
