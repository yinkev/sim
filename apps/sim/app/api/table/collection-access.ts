import { getUserEntityPermissions } from '@/lib/workspaces/permissions/utils'

export interface WorkspaceAccessResult {
  hasAccess: boolean
  canWrite: boolean
}

export async function checkWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<WorkspaceAccessResult> {
  const permission = await getUserEntityPermissions(userId, 'workspace', workspaceId)

  if (permission === null) {
    return { hasAccess: false, canWrite: false }
  }

  return {
    hasAccess: true,
    canWrite: permission === 'admin' || permission === 'write',
  }
}
