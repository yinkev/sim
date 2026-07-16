import { AuditAction, AuditResourceType, recordAudit } from '@sim/audit'
import { db } from '@sim/db'
import { workflow, workflowFolder } from '@sim/db/schema'
import { createLogger } from '@sim/logger'
import { generateId } from '@sim/utils/id'
import { and, eq, isNull, min } from 'drizzle-orm'
import type { OrchestrationErrorCode } from '@/lib/workflows/orchestration/types'

const logger = createLogger('FolderCreate')

export interface PerformCreateFolderParams {
  userId: string
  workspaceId: string
  name: string
  id?: string
  parentId?: string | null
  color?: string
  sortOrder?: number
}

export interface PerformCreateFolderResult {
  success: boolean
  error?: string
  errorCode?: OrchestrationErrorCode
  folder?: typeof workflowFolder.$inferSelect
}

/**
 * Verifies that a prospective parent exists in the target workspace and is active.
 */
export async function assertParentFolderInWorkspace(
  parentId: string,
  workspaceId: string
): Promise<{ error: string; errorCode: OrchestrationErrorCode } | null> {
  const [parent] = await db
    .select({
      workspaceId: workflowFolder.workspaceId,
      archivedAt: workflowFolder.archivedAt,
    })
    .from(workflowFolder)
    .where(eq(workflowFolder.id, parentId))
    .limit(1)

  if (!parent || parent.workspaceId !== workspaceId || parent.archivedAt) {
    return { error: 'Parent folder not found', errorCode: 'validation' }
  }

  return null
}

async function nextFolderSortOrder(
  workspaceId: string,
  parentId: string | null | undefined
): Promise<number> {
  const folderParentCondition = parentId
    ? eq(workflowFolder.parentId, parentId)
    : isNull(workflowFolder.parentId)
  const workflowParentCondition = parentId
    ? eq(workflow.folderId, parentId)
    : isNull(workflow.folderId)

  const [[folderResult], [workflowResult]] = await Promise.all([
    db
      .select({ minSortOrder: min(workflowFolder.sortOrder) })
      .from(workflowFolder)
      .where(and(eq(workflowFolder.workspaceId, workspaceId), folderParentCondition)),
    db
      .select({ minSortOrder: min(workflow.sortOrder) })
      .from(workflow)
      .where(and(eq(workflow.workspaceId, workspaceId), workflowParentCondition)),
  ])

  const minSortOrder = [folderResult?.minSortOrder, workflowResult?.minSortOrder].reduce<
    number | null
  >((currentMin, candidate) => {
    if (candidate == null) return currentMin
    if (currentMin == null) return candidate
    return Math.min(currentMin, candidate)
  }, null)

  return minSortOrder != null ? minSortOrder - 1 : 0
}

/** Creates a workflow folder after validating its parent and sort position. */
export async function performCreateFolder(
  params: PerformCreateFolderParams
): Promise<PerformCreateFolderResult> {
  try {
    const folderId = params.id || generateId()
    const parentId = params.parentId || null

    if (parentId) {
      if (parentId === folderId) {
        return {
          success: false,
          error: 'Folder cannot be its own parent',
          errorCode: 'validation',
        }
      }
      const parentError = await assertParentFolderInWorkspace(parentId, params.workspaceId)
      if (parentError) return { success: false, ...parentError }
    }

    const sortOrder =
      params.sortOrder !== undefined
        ? params.sortOrder
        : await nextFolderSortOrder(params.workspaceId, parentId)

    const [folder] = await db
      .insert(workflowFolder)
      .values({
        id: folderId,
        name: params.name.trim(),
        userId: params.userId,
        workspaceId: params.workspaceId,
        parentId,
        color: params.color || '#6B7280',
        sortOrder,
      })
      .returning()

    logger.info('Created workflow folder', { folderId, workspaceId: params.workspaceId, parentId })

    recordAudit({
      workspaceId: params.workspaceId,
      actorId: params.userId,
      action: AuditAction.FOLDER_CREATED,
      resourceType: AuditResourceType.FOLDER,
      resourceId: folderId,
      resourceName: folder.name,
      description: `Created folder "${folder.name}"`,
      metadata: {
        name: folder.name,
        workspaceId: params.workspaceId,
        parentId: parentId || undefined,
        color: folder.color,
        sortOrder: folder.sortOrder,
      },
    })

    return { success: true, folder }
  } catch (error) {
    logger.error('Failed to create workflow folder', { error })
    return { success: false, error: 'Internal server error', errorCode: 'internal' }
  }
}
