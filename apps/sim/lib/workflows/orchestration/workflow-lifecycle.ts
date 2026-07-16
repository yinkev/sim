import { AuditAction, AuditResourceType, recordAudit } from '@sim/audit'
import { db } from '@sim/db'
import { workflow, workflowFolder } from '@sim/db/schema'
import { createLogger } from '@sim/logger'
import { toError } from '@sim/utils/errors'
import { generateId } from '@sim/utils/id'
import { isFolderInWorkspace } from '@sim/workflow-authz'
import { and, eq, isNull, min } from 'drizzle-orm'
import { generateRequestId } from '@/lib/core/utils/request'
import { buildDefaultWorkflowArtifacts } from '@/lib/workflows/defaults'
import { restoreWorkflow } from '@/lib/workflows/lifecycle'
import type { OrchestrationErrorCode } from '@/lib/workflows/orchestration/types'
import { workflowNameExistsInFolder } from '@/lib/workflows/orchestration/workflow-update'
import { saveWorkflowToNormalizedTables } from '@/lib/workflows/persistence/utils'
import { deduplicateWorkflowName } from '@/lib/workflows/utils'

export {
  type PerformDeleteWorkflowParams,
  type PerformDeleteWorkflowResult,
  performDeleteWorkflow,
} from '@/lib/workflows/orchestration/workflow-delete'
export {
  type PerformUpdateWorkflowParams,
  type PerformUpdateWorkflowResult,
  performUpdateWorkflow,
} from '@/lib/workflows/orchestration/workflow-update'

const logger = createLogger('WorkflowLifecycle')

export interface PerformCreateWorkflowParams {
  userId: string
  workspaceId: string
  name: string
  id?: string
  description?: string | null
  folderId?: string | null
  sortOrder?: number
  deduplicate?: boolean
  requestId?: string
}

export interface PerformCreateWorkflowResult {
  success: boolean
  error?: string
  errorCode?: OrchestrationErrorCode
  workflow?: {
    id: string
    name: string
    description?: string | null
    workspaceId: string
    folderId?: string | null
    sortOrder: number
    createdAt: Date
    updatedAt: Date
    startBlockId?: string
    subBlockValues: Record<string, unknown>
  }
}

export interface PerformRestoreWorkflowParams {
  workflowId: string
  userId: string
  requestId?: string
}

export interface PerformRestoreWorkflowResult {
  success: boolean
  error?: string
  errorCode?: OrchestrationErrorCode
  workflow?: Awaited<ReturnType<typeof restoreWorkflow>>['workflow']
}

async function nextWorkflowSortOrder(
  workspaceId: string,
  folderId: string | null | undefined
): Promise<number> {
  const workflowParentCondition = folderId
    ? eq(workflow.folderId, folderId)
    : isNull(workflow.folderId)
  const folderParentCondition = folderId
    ? eq(workflowFolder.parentId, folderId)
    : isNull(workflowFolder.parentId)

  const [[workflowMinResult], [folderMinResult]] = await Promise.all([
    db
      .select({ minOrder: min(workflow.sortOrder) })
      .from(workflow)
      .where(
        and(
          eq(workflow.workspaceId, workspaceId),
          workflowParentCondition,
          isNull(workflow.archivedAt)
        )
      ),
    db
      .select({ minOrder: min(workflowFolder.sortOrder) })
      .from(workflowFolder)
      .where(and(eq(workflowFolder.workspaceId, workspaceId), folderParentCondition)),
  ])

  const minSortOrder = [workflowMinResult?.minOrder, folderMinResult?.minOrder].reduce<
    number | null
  >((currentMin, candidate) => {
    if (candidate == null) return currentMin
    if (currentMin == null) return candidate
    return Math.min(currentMin, candidate)
  }, null)

  return minSortOrder != null ? minSortOrder - 1 : 0
}

export async function performCreateWorkflow(
  params: PerformCreateWorkflowParams
): Promise<PerformCreateWorkflowResult> {
  const requestId = params.requestId ?? generateRequestId()
  const workflowId = params.id || generateId()
  const folderId = params.folderId || null

  try {
    if (!(await isFolderInWorkspace(folderId, params.workspaceId))) {
      return { success: false, error: 'Target folder not found', errorCode: 'validation' }
    }

    const name = params.deduplicate
      ? await deduplicateWorkflowName(params.name, params.workspaceId, folderId)
      : params.name

    if (!params.deduplicate) {
      const duplicate = await workflowNameExistsInFolder({
        workspaceId: params.workspaceId,
        name,
        folderId,
      })
      if (duplicate) {
        return {
          success: false,
          error: `A workflow named "${name}" already exists in this folder`,
          errorCode: 'conflict',
        }
      }
    }

    const sortOrder =
      params.sortOrder !== undefined
        ? params.sortOrder
        : await nextWorkflowSortOrder(params.workspaceId, folderId)
    const now = new Date()
    const { workflowState, subBlockValues, startBlockId } = buildDefaultWorkflowArtifacts()

    await db.transaction(async (tx) => {
      await tx.insert(workflow).values({
        id: workflowId,
        userId: params.userId,
        workspaceId: params.workspaceId,
        folderId,
        sortOrder,
        name,
        description: params.description,
        lastSynced: now,
        createdAt: now,
        updatedAt: now,
        isDeployed: false,
        runCount: 0,
        variables: {},
      })

      await saveWorkflowToNormalizedTables(workflowId, workflowState, tx)
    })

    logger.info(`[${requestId}] Successfully created workflow ${workflowId}`)

    recordAudit({
      workspaceId: params.workspaceId,
      actorId: params.userId,
      action: AuditAction.WORKFLOW_CREATED,
      resourceType: AuditResourceType.WORKFLOW,
      resourceId: workflowId,
      resourceName: name,
      description: `Created workflow "${name}"`,
      metadata: {
        name,
        description: params.description || undefined,
        workspaceId: params.workspaceId,
        folderId: folderId || undefined,
        sortOrder,
      },
    })

    return {
      success: true,
      workflow: {
        id: workflowId,
        name,
        description: params.description,
        workspaceId: params.workspaceId,
        folderId,
        sortOrder,
        createdAt: now,
        updatedAt: now,
        startBlockId,
        subBlockValues,
      },
    }
  } catch (error) {
    logger.error(`[${requestId}] Failed to create workflow`, { error })
    return { success: false, error: toError(error).message, errorCode: 'internal' }
  }
}

export async function performRestoreWorkflow(
  params: PerformRestoreWorkflowParams
): Promise<PerformRestoreWorkflowResult> {
  const { workflowId, userId } = params
  const requestId = params.requestId ?? generateRequestId()

  try {
    const restoreResult = await restoreWorkflow(workflowId, { requestId })
    if (!restoreResult.workflow) {
      return { success: false, error: 'Workflow not found', errorCode: 'not_found' }
    }
    if (!restoreResult.restored) {
      return {
        success: false,
        error: 'Workflow is not archived',
        errorCode: 'validation',
        workflow: restoreResult.workflow,
      }
    }

    logger.info(`[${requestId}] Successfully restored workflow ${workflowId}`)

    recordAudit({
      workspaceId: restoreResult.workflow.workspaceId || null,
      actorId: userId,
      action: AuditAction.WORKFLOW_RESTORED,
      resourceType: AuditResourceType.WORKFLOW,
      resourceId: workflowId,
      resourceName: restoreResult.workflow.name,
      description: `Restored workflow "${restoreResult.workflow.name}"`,
      metadata: {
        workflowName: restoreResult.workflow.name,
        workspaceId: restoreResult.workflow.workspaceId || undefined,
      },
    })

    return { success: true, workflow: restoreResult.workflow }
  } catch (error) {
    logger.error(`[${requestId}] Failed to restore workflow ${workflowId}`, { error })
    return { success: false, error: toError(error).message, errorCode: 'internal' }
  }
}
