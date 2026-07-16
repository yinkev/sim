'use client'

import { useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import {
  getUserPermissionConfigContract,
  type UserPermissionConfig,
} from '@/lib/api/contracts/permission-groups'

export const userPermissionConfigKeys = {
  all: ['permissionGroups'] as const,
  userConfig: (workspaceId?: string) =>
    [...userPermissionConfigKeys.all, 'userConfig', workspaceId ?? ''] as const,
}

export function useUserPermissionConfig(workspaceId?: string) {
  return useQuery<UserPermissionConfig>({
    queryKey: userPermissionConfigKeys.userConfig(workspaceId),
    queryFn: async ({ signal }) => {
      return requestJson(getUserPermissionConfigContract, {
        query: { workspaceId: workspaceId ?? '' },
        signal,
      })
    },
    enabled: Boolean(workspaceId),
    staleTime: 60 * 1000,
  })
}
