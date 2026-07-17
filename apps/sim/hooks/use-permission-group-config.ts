'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  DEFAULT_PERMISSION_GROUP_CONFIG,
  type PermissionGroupConfig,
} from '@/lib/permission-groups/types'
import { useUserPermissionConfig } from '@/ee/access-control/hooks/use-user-permission-config'

interface PermissionGroupConfigResult {
  config: PermissionGroupConfig
  isLoading: boolean
  isInPermissionGroup: boolean
}

/**
 * Reads workspace permission-group configuration without loading executable block metadata.
 * Use `usePermissionConfig` only when a consumer needs integration or provider filtering.
 */
export function usePermissionGroupConfig(): PermissionGroupConfigResult {
  const params = useParams()
  const workspaceId = typeof params?.workspaceId === 'string' ? params.workspaceId : undefined
  const { data, isLoading } = useUserPermissionConfig(workspaceId)

  return useMemo(
    () => ({
      config: data?.config ?? DEFAULT_PERMISSION_GROUP_CONFIG,
      isLoading,
      isInPermissionGroup: Boolean(data?.permissionGroupId),
    }),
    [data, isLoading]
  )
}
