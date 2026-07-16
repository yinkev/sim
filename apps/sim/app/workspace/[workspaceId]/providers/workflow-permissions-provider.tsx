'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createLogger } from '@sim/logger'
import { useParams } from 'next/navigation'
import { useToast } from '@/components/emcn'
import {
  useWorkspacePermissionsContext,
  WorkspacePermissionsOverrideProvider,
} from '@/app/workspace/[workspaceId]/providers/workspace-permissions-provider'
import { useSocket } from '@/app/workspace/providers/socket-provider'
import { useStableFlag } from '@/hooks/use-stable-flag'
import { useOperationQueueStore } from '@/stores/operation-queue/store'

const logger = createLogger('WorkflowPermissionsProvider')
const RECONNECTING_TOAST_DELAY_MS = 2000
const RECONNECTING_TOAST_MIN_VISIBLE_MS = 1500

interface PersistentToastOptions {
  description?: string
  action?: { label: string; onClick: () => void }
}

interface WorkflowPermissionsProviderProps {
  children: React.ReactNode
}

/**
 * Shows a persistent error toast while `message` is non-null, replaces it when
 * the message changes, and dismisses it when the message becomes null or the
 * owning component unmounts.
 */
function usePersistentErrorToast(message: string | null, options?: PersistentToastOptions) {
  const { toast } = useToast()
  const toastIdRef = useRef<string | null>(null)
  const shownMessageRef = useRef<string | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const dismiss = useCallback(() => {
    if (!toastIdRef.current) return
    toast.dismiss(toastIdRef.current)
    toastIdRef.current = null
    shownMessageRef.current = null
  }, [])

  useEffect(() => {
    if (!message) {
      dismiss()
      return
    }

    if (toastIdRef.current && shownMessageRef.current === message) return

    dismiss()

    try {
      toastIdRef.current = toast.error(message, {
        ...optionsRef.current,
        duration: 0,
        persistAcrossRoutes: true,
      })
      shownMessageRef.current = message
    } catch (error) {
      logger.error('Failed to show persistent notification', { error, message })
    }
  }, [dismiss, message])

  useEffect(() => dismiss, [dismiss])
}

/** Applies connection-aware write protection only inside Workflow Studio. */
export function WorkflowPermissionsProvider({ children }: WorkflowPermissionsProviderProps) {
  const params = useParams<{ workflowId?: string }>()
  const { userPermissions: baseUserPermissions } = useWorkspacePermissionsContext()
  const hasOperationError = useOperationQueueStore((state) => state.hasOperationError)
  const { isReconnecting, isRetryingWorkflowJoin, blockedJoinWorkflowId } = useSocket()

  const isJoinBlocked =
    Boolean(blockedJoinWorkflowId) && blockedJoinWorkflowId === params?.workflowId
  const showReconnecting = useStableFlag(isReconnecting, {
    delayMs: RECONNECTING_TOAST_DELAY_MS,
    minVisibleMs: RECONNECTING_TOAST_MIN_VISIBLE_MS,
  })
  const realtimeStatusMessage = hasOperationError
    ? null
    : showReconnecting
      ? 'Reconnecting...'
      : isRetryingWorkflowJoin
        ? 'Joining workflow...'
        : null

  usePersistentErrorToast(realtimeStatusMessage)
  usePersistentErrorToast(hasOperationError ? 'Connection unavailable' : null, {
    description: 'Recent changes may not have been saved. Refresh to resync.',
    action: { label: 'Refresh', onClick: () => window.location.reload() },
  })
  usePersistentErrorToast(isJoinBlocked ? 'Unable to connect to workflow' : null, {
    description: 'Changes cannot be saved. Refresh to retry.',
    action: { label: 'Refresh', onClick: () => window.location.reload() },
  })

  const userPermissions = useMemo(() => {
    if (hasOperationError || isJoinBlocked) {
      return {
        ...baseUserPermissions,
        canEdit: false,
        canAdmin: false,
        isOfflineMode: hasOperationError,
      }
    }

    return { ...baseUserPermissions, isOfflineMode: false }
  }, [baseUserPermissions, hasOperationError, isJoinBlocked])

  return (
    <WorkspacePermissionsOverrideProvider userPermissions={userPermissions}>
      {children}
    </WorkspacePermissionsOverrideProvider>
  )
}
