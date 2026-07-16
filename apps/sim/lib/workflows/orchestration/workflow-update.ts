import { db } from '@sim/db'
import { workflow } from '@sim/db/schema'
import { createLogger } from '@sim/logger'
import { toError } from '@sim/utils/errors'
import { isFolderInWorkspace } from '@sim/platform-authz/workflow'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { generateRequestId } from '@/lib/core/utils/request'
import type { OrchestrationErrorCode } from '@/lib/workflows/orchestration/types'

const logger = createLogger('WorkflowUpdate')

export interface PerformUpdateWorkflowParams {
  workflowId: string
  userId: string
  workspaceId: string
  currentName: string
  currentFolderId?: string | null
  name?: string
  description?: string | null
  folderId?: string | null
  sortOrder?: number
  locked?: boolean
  requestId?: string
}

export interface PerformUpdateWorkflowResult {
  success: boolean
  error?: string
  errorCode?: OrchestrationErrorCode
  workflow?: {
    id: string
    name: string
    description: string | null
    workspaceId: string | null
    folderId: string | null
    sortOrder: number | null
    locked: boolean | null
    createdAt: Date
    updatedAt: Date
    archivedAt: Date | null
  }
}

/** Returns whether an active workflow already uses the name in the target folder. */
export async function workflowNameExistsInFolder(params: {
  workspaceId: string
  name: string
  folderId?: string | null
  excludeWorkflowId?: string
}): Promise<boolean> {
  const conditions = [
    eq(workflow.workspaceId, params.workspaceId),
    isNull(workflow.archivedAt),
    eq(workflow.name, params.name),
  ]

  if (params.excludeWorkflowId) {
    conditions.push(ne(workflow.id, params.excludeWorkflowId))
  }

  if (params.folderId) {
    conditions.push(eq(workflow.folderId, params.folderId))
  } else {
    conditions.push(isNull(workflow.folderId))
  }

  const [duplicateWorkflow] = await db
    .select({ id: workflow.id })
    .from(workflow)
    .where(and(...conditions))
    .limit(1)
  return Boolean(duplicateWorkflow)
}

/** Updates workflow metadata after validating its folder and name constraints. */
export async function performUpdateWorkflow(
  params: PerformUpdateWorkflowParams
): Promise<PerformUpdateWorkflowResult> {
  const requestId = params.requestId ?? generateRequestId()

  try {
    const targetName = params.name ?? params.currentName
    const targetFolderId =
      params.folderId !== undefined ? params.folderId || null : params.currentFolderId || null

    if (
      params.folderId !== undefined &&
      !(await isFolderInWorkspace(targetFolderId, params.workspaceId))
    ) {
      return { success: false, error: 'Target folder not found', errorCode: 'validation' }
    }

    if (params.name !== undefined || params.folderId !== undefined) {
      const duplicate = await workflowNameExistsInFolder({
        workspaceId: params.workspaceId,
        name: targetName,
        folderId: targetFolderId,
        excludeWorkflowId: params.workflowId,
      })
      if (duplicate) {
        return {
          success: false,
          error: `A workflow named "${targetName}" already exists in this folder`,
          errorCode: 'conflict',
        }
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (params.name !== undefined) updateData.name = params.name
    if (params.description !== undefined) updateData.description = params.description
    if (params.folderId !== undefined) updateData.folderId = params.folderId
    if (params.sortOrder !== undefined) updateData.sortOrder = params.sortOrder
    if (params.locked !== undefined) updateData.locked = params.locked

    const [updatedWorkflow] = await db
      .update(workflow)
      .set(updateData)
      .where(eq(workflow.id, params.workflowId))
      .returning({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        workspaceId: workflow.workspaceId,
        folderId: workflow.folderId,
        sortOrder: workflow.sortOrder,
        locked: workflow.locked,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        archivedAt: workflow.archivedAt,
      })

    if (!updatedWorkflow) {
      return { success: false, error: 'Workflow not found', errorCode: 'not_found' }
    }

    logger.info(`[${requestId}] Successfully updated workflow ${params.workflowId}`, {
      updates: updateData,
    })

    return { success: true, workflow: updatedWorkflow }
  } catch (error) {
    logger.error(`[${requestId}] Failed to update workflow ${params.workflowId}`, { error })
    return { success: false, error: toError(error).message, errorCode: 'internal' }
  }
}
