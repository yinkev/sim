'use client'

import { createContext, type ReactNode, useContext } from 'react'

type PermissionType = 'admin' | 'write' | 'read'

interface WorkspaceUserPermissions {
  canRead: boolean
  canEdit: boolean
  canAdmin: boolean
  userPermissions: PermissionType
  isLoading: boolean
  error: string | null
  isOfflineMode?: boolean
}

interface WorkspacePermissionsContextType {
  workspacePermissions: null
  permissionsLoading: boolean
  permissionsError: string | null
  updatePermissions: (permissions: unknown) => void
  refetchPermissions: () => Promise<void>
  userPermissions: WorkspaceUserPermissions
}

const refetchPermissions = (): Promise<void> => Promise.resolve()

const ADMIN_CONTEXT: WorkspacePermissionsContextType = {
  workspacePermissions: null,
  permissionsLoading: false,
  permissionsError: null,
  updatePermissions: () => {},
  refetchPermissions,
  userPermissions: {
    canRead: true,
    canEdit: true,
    canAdmin: true,
    userPermissions: 'admin',
    isLoading: false,
    error: null,
    isOfflineMode: false,
  },
}

const WorkspacePermissionsContext = createContext<WorkspacePermissionsContextType | null>(null)

/** Grants the trusted anonymous operator full workspace permissions without an API query. */
export function WorkspacePermissionsProvider({ children }: { children: ReactNode }) {
  return (
    <WorkspacePermissionsContext.Provider value={ADMIN_CONTEXT}>
      {children}
    </WorkspacePermissionsContext.Provider>
  )
}

interface WorkspacePermissionsOverrideProviderProps {
  children: ReactNode
  userPermissions: WorkspaceUserPermissions
}

/** Preserves workflow-local offline and join protection over anonymous base permissions. */
export function WorkspacePermissionsOverrideProvider({
  children,
  userPermissions,
}: WorkspacePermissionsOverrideProviderProps) {
  const context = useWorkspacePermissionsContext()
  return (
    <WorkspacePermissionsContext.Provider value={{ ...context, userPermissions }}>
      {children}
    </WorkspacePermissionsContext.Provider>
  )
}

export function useWorkspacePermissionsContext(): WorkspacePermissionsContextType {
  const context = useContext(WorkspacePermissionsContext)
  if (!context) {
    throw new Error(
      'useWorkspacePermissionsContext must be used within a WorkspacePermissionsProvider'
    )
  }
  return context
}

export function useUserPermissionsContext(): WorkspaceUserPermissions {
  return useWorkspacePermissionsContext().userPermissions
}

/** Matches sandbox behavior while keeping the same dependency-free boundary. */
export function SandboxWorkspacePermissionsProvider({ children }: { children: ReactNode }) {
  return <WorkspacePermissionsProvider>{children}</WorkspacePermissionsProvider>
}
