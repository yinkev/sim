'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sidebar } from '@/app/workspace/[workspaceId]/w/components/sidebar/sidebar'
import { useSidebarStore } from '@/stores/sidebar/store'

const WORKSPACE_NAVIGATION_ROOT_ID = 'workspace-navigation-root'

/** Mounts Studio navigation into the persistent shell without a main-web import edge. */
export function WorkflowNavigationPortal() {
  const [navigationRoot, setNavigationRoot] = useState<HTMLElement | null>(null)
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)

  useEffect(() => {
    setNavigationRoot(document.getElementById(WORKSPACE_NAVIGATION_ROOT_ID))
  }, [])

  if (!navigationRoot) return null
  return createPortal(<Sidebar isCollapsed={isCollapsed} />, navigationRoot)
}
