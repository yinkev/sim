'use client'

const DISABLED_USER_PERMISSION_CONFIG_RESULT = {
  data: undefined,
  isLoading: false,
} as const

/** Returns the unrestricted fallback used by `usePermissionConfig` in trusted DISABLE_AUTH mode. */
export function useUserPermissionConfig(_workspaceId?: string) {
  return DISABLED_USER_PERMISSION_CONFIG_RESULT
}
