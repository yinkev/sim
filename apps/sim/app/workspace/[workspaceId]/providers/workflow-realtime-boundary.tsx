'use client'

import type { ReactNode } from 'react'
import { useSession } from '@/lib/auth/auth-client'
import { WorkflowPermissionsProvider } from '@/app/workspace/[workspaceId]/providers/workflow-permissions-provider'
import { SocketProvider } from '@/app/workspace/providers/socket-provider'

interface WorkflowRealtimeBoundaryProps {
  children: ReactNode
}

/** Owns workflow-only collaboration and connection-aware permissions. */
export function WorkflowRealtimeBoundary({ children }: WorkflowRealtimeBoundaryProps) {
  const session = useSession()
  const user = session.data?.user
    ? {
        id: session.data.user.id,
        name: session.data.user.name ?? undefined,
        email: session.data.user.email,
      }
    : undefined

  return (
    <SocketProvider user={user}>
      <WorkflowPermissionsProvider>{children}</WorkflowPermissionsProvider>
    </SocketProvider>
  )
}
