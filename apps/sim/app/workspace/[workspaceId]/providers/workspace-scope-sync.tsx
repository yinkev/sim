'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'

/**
 * Keeps workflow registry workspace scope synchronized with the current route.
 */
export function WorkspaceScopeSync() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const posthog = usePostHog()

  useEffect(() => {
    if (!workspaceId) return
    posthog?.group('workspace', workspaceId)
  }, [posthog, workspaceId])

  useEffect(() => {
    let cancelled = false

    async function syncWorkspaceScope() {
      if (!workspaceId) return

      const { useWorkflowRegistry } = await import('@/stores/workflows/registry/store')

      if (cancelled || useWorkflowRegistry.getState().hydration.workspaceId === workspaceId) {
        return
      }

      useWorkflowRegistry.getState().switchToWorkspace(workspaceId)
    }

    void syncWorkspaceScope()

    return () => {
      cancelled = true
    }
  }, [workspaceId])

  return null
}
