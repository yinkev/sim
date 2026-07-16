import { AuditAction, AuditResourceType, recordAudit } from '@sim/audit'
import { db } from '@sim/db'
import { workflow } from '@sim/db/schema'
import { createLogger } from '@sim/logger'
import { and, eq, isNull } from 'drizzle-orm'
import { generateRequestId } from '@/lib/core/utils/request'
import { archiveWorkflow } from '@/lib/workflows/lifecycle'
import type { OrchestrationErrorCode } from '@/lib/workflows/orchestration/types'

const logger = createLogger('WorkflowDelete')

export interface PerformDeleteWorkflowParams {
  workflowId: string
  userId: string
  requestId?: string
  /** When true, allows deleting the last workflow in a workspace. */
  skipLastWorkflowGuard?: boolean
  /** Override the actor ID used in audit logs. Defaults to `userId`. */
  actorId?: string
}

export interface PerformDeleteWorkflowResult {
  success: boolean
  error?: string
  errorCode?: OrchestrationErrorCode
}

/** Archives a workflow after enforcing the last-workflow guard. */
export async function performDeleteWorkflow(
  params: PerformDeleteWorkflowParams
): Promise<PerformDeleteWorkflowResult> {
  const { workflowId, userId, skipLastWorkflowGuard = false } = params
  const actorId = params.actorId ?? userId
  const requestId = params.requestId ?? generateRequestId()

  const [workflowRecord] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, workflowId))
    .limit(1)

  if (!workflowRecord) {
    return { success: false, error: 'Workflow not found', errorCode: 'not_found' }
  }

  if (!skipLastWorkflowGuard && workflowRecord.workspaceId) {
    const totalWorkflows = await db
      .select({ id: workflow.id })
      .from(workflow)
      .where(and(eq(workflow.workspaceId, workflowRecord.workspaceId), isNull(workflow.archivedAt)))

    if (totalWorkflows.length <= 1) {
      return {
        success: false,
        error: 'Cannot delete the only workflow in the workspace',
        errorCode: 'validation',
      }
    }
  }

  const archiveResult = await archiveWorkflow(workflowId, { requestId })
  if (!archiveResult.workflow) {
    return { success: false, error: 'Workflow not found', errorCode: 'not_found' }
  }

  logger.info(`[${requestId}] Successfully archived workflow ${workflowId}`)

  recordAudit({
    workspaceId: workflowRecord.workspaceId || null,
    actorId,
    action: AuditAction.WORKFLOW_DELETED,
    resourceType: AuditResourceType.WORKFLOW,
    resourceId: workflowId,
    resourceName: workflowRecord.name,
    description: `Archived workflow "${workflowRecord.name}"`,
    metadata: {
      archived: archiveResult.archived,
    },
  })

  return { success: true }
}
