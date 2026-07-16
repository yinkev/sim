'use client'

import type React from 'react'
import { createContext, useCallback, useContext, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams, usePathname } from 'next/navigation'
import {
  useWorkspacePermissionsQuery,
  type WorkspacePermissions,
  workspacePermissionsKey,
} from '@/hooks/queries/workspace-permissions'
import { useUserPermissions, type WorkspaceUserPermissions } from '@/hooks/use-user-permissions'

interface WorkspacePermissionsContextType {
  workspacePermissions: WorkspacePermissions | null
  permissionsLoading: boolean
  permissionsError: string | null
  updatePermissions: (newPermissions: WorkspacePermissions) => void
  refetchPermissions: () => Promise<void>
  userPermissions: WorkspaceUserPermissions & { isOfflineMode?: boolean }
}

const WorkspacePermissionsContext = createContext<WorkspacePermissionsContextType>({
  workspacePermissions: null,
  permissionsLoading: false,
  permissionsError: null,
  updatePermissions: () => {},
  refetchPermissions: async () => {},
  userPermissions: {
    canRead: false,
    canEdit: false,
    canAdmin: false,
    userPermissions: 'read',
    isLoading: false,
    error: null,
  },
})

interface WorkspacePermissionsProviderProps {
  children: React.ReactNode
}

/**
 * Provides workspace permissions without importing workflow collaboration state.
 */
export function WorkspacePermissionsProvider({ children }: WorkspacePermissionsProviderProps) {
  const params = useParams()
  const workspaceId = params?.workspaceId as string
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const permissionsEnabled = pathname !== `/workspace/${workspaceId}/chat/new`

  const {
    data: queriedWorkspacePermissions,
    isLoading: queriedPermissionsLoading,
    error: permissionsErrorObj,
    refetch,
  } = useWorkspacePermissionsQuery(workspaceId, { enabled: permissionsEnabled })

  const workspacePermissions = permissionsEnabled ? (queriedWorkspacePermissions ?? null) : null
  const permissionsLoading = permissionsEnabled ? queriedPermissionsLoading : true
  const permissionsError = permissionsEnabled ? (permissionsErrorObj?.message ?? null) : null

  const updatePermissions = useCallback(
    (newPermissions: WorkspacePermissions) => {
      if (!workspaceId) return
      queryClient.setQueryData(workspacePermissionsKey(workspaceId), newPermissions)
    },
    [workspaceId, queryClient]
  )

  const refetchPermissions = useCallback(async () => {
    if (!permissionsEnabled) return
    await refetch()
  }, [permissionsEnabled, refetch])

  const resolvedUserPermissions = useUserPermissions(
    workspacePermissions,
    permissionsLoading,
    permissionsError
  )
  const userPermissions = useMemo(
    () => ({ ...resolvedUserPermissions, isOfflineMode: false }),
    [resolvedUserPermissions]
  )

  const contextValue = useMemo(
    () => ({
      workspacePermissions,
      permissionsLoading,
      permissionsError,
      updatePermissions,
      refetchPermissions,
      userPermissions,
    }),
    [
      workspacePermissions,
      permissionsLoading,
      permissionsError,
      updatePermissions,
      refetchPermissions,
      userPermissions,
    ]
  )

  return (
    <WorkspacePermissionsContext.Provider value={contextValue}>
      {children}
    </WorkspacePermissionsContext.Provider>
  )
}

interface WorkspacePermissionsOverrideProviderProps {
  children: React.ReactNode
  userPermissions: WorkspaceUserPermissions & { isOfflineMode?: boolean }
}

/** Overrides only the workflow-sensitive permission result for an owning route. */
export function WorkspacePermissionsOverrideProvider({
  children,
  userPermissions,
}: WorkspacePermissionsOverrideProviderProps) {
  const context = useWorkspacePermissionsContext()
  const contextValue = useMemo(() => ({ ...context, userPermissions }), [context, userPermissions])

  return (
    <WorkspacePermissionsContext.Provider value={contextValue}>
      {children}
    </WorkspacePermissionsContext.Provider>
  )
}

/**
 * Accesses workspace permissions data and operations from context.
 * Must be used within a WorkspacePermissionsProvider.
 */
export function useWorkspacePermissionsContext(): WorkspacePermissionsContextType {
  const context = useContext(WorkspacePermissionsContext)
  if (!context) {
    throw new Error(
      'useWorkspacePermissionsContext must be used within a WorkspacePermissionsProvider'
    )
  }
  return context
}

/**
 * Accesses the current user's computed permissions including offline mode status.
 * Convenience hook that extracts userPermissions from the context.
 */
export function useUserPermissionsContext(): WorkspaceUserPermissions & {
  isOfflineMode?: boolean
} {
  const { userPermissions } = useWorkspacePermissionsContext()
  return userPermissions
}

/**
 * Lightweight permissions provider for sandbox/academy contexts.
 * Grants full edit access without any API calls or workspace dependencies.
 */
export function SandboxWorkspacePermissionsProvider({ children }: { children: React.ReactNode }) {
  const sandboxPermissions = useMemo(
    (): WorkspacePermissionsContextType => ({
      workspacePermissions: null,
      permissionsLoading: false,
      permissionsError: null,
      updatePermissions: () => {},
      refetchPermissions: async () => {},
      userPermissions: {
        canRead: true,
        canEdit: true,
        canAdmin: false,
        userPermissions: 'write',
        isLoading: false,
        error: null,
        isOfflineMode: false,
      },
    }),
    []
  )

  return (
    <WorkspacePermissionsContext.Provider value={sandboxPermissions}>
      {children}
    </WorkspacePermissionsContext.Provider>
  )
}
