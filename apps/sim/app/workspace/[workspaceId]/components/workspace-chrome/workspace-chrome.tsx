'use client'

import { useEffect, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MainWebNavigation } from '@/app/workspace/[workspaceId]/components/workspace-chrome/main-web-navigation'
import { useFullscreenOriginStore } from '@/stores/fullscreen-origin'
import { useSidebarStore } from '@/stores/sidebar/store'

const FULLSCREEN_SUFFIXES = ['/upgrade'] as const

/** Slide timing for the fullscreen sidebar collapse and content shift. */
const SLIDE_TRANSITION =
  'duration-[175ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] motion-reduce:transition-none'

interface WorkspaceChromeProps {
  children: React.ReactNode
  /** Cookie-derived collapse state used until the sidebar store hydrates. */
  initialSidebarCollapsed?: boolean
}

function isFullscreenPath(pathname: string | null): boolean {
  return FULLSCREEN_SUFFIXES.some((s) => pathname?.endsWith(s))
}

function isWorkflowPath(pathname: string | null): boolean {
  return /\/workspace\/[^/]+\/w(?:\/|$)/.test(pathname ?? '')
}

/**
 * Renders a persistent, lightweight main-web shell. Workflow Studio owns the
 * separate component that portals route-scoped navigation into this frame.
 *
 * Leaving a fullscreen route is instant: App Router swaps `children` to the
 * origin page and the fullscreen page is simply unmounted, while the sidebar
 * slides back in. There is no exit fade — the new page just loads in place.
 *
 * Because the chrome observes every pathname transition, it records the page a
 * fullscreen route was launched from into {@link useFullscreenOriginStore}. The
 * route's Back control reads that origin to return deterministically, so any
 * trigger that merely pushes a fullscreen route gets correct return-to-origin
 * without per-call-site wiring.
 *
 * On a direct load of a fullscreen route the wrapper mounts already collapsed,
 * so no slide plays (CSS transitions don't run on mount).
 */
export function WorkspaceChrome({
  children,
  initialSidebarCollapsed = false,
}: WorkspaceChromeProps) {
  const pathname = usePathname()
  const isFullscreen = isFullscreenPath(pathname)
  const workflowPath = isWorkflowPath(pathname)

  const setOrigin = useFullscreenOriginStore((s) => s.setOrigin)

  const storeIsCollapsed = useSidebarStore((s) => s.isCollapsed)
  const hasHydrated = useSidebarStore((s) => s._hasHydrated)
  const syncSidebarWidth = useSidebarStore((s) => s.syncWidth)
  const isCollapsed = hasHydrated ? storeIsCollapsed : initialSidebarCollapsed

  useLayoutEffect(() => {
    void useSidebarStore.persist.rehydrate()
  }, [])

  // Remember the last non-fullscreen page so a fullscreen route's Back control
  // can return there, deterministically and for any trigger.
  useEffect(() => {
    if (pathname && !isFullscreen) setOrigin(pathname)
  }, [pathname, isFullscreen, setOrigin])

  // Re-apply the sidebar width whenever this persistent shell sees a navigation.
  // The blocking script in the document head only runs on full page loads and
  // store rehydration only fires once, so a soft navigation can leave
  // `--sidebar-width` stuck at its `0px` default — collapsing the sidebar to
  // nothing with no reachable control to bring it back. Re-syncing here recovers
  // that state. Gated on hydration so it never clobbers the persisted value with
  // store defaults during the pre-hydration window.
  useEffect(() => {
    if (hasHydrated) syncSidebarWidth()
  }, [pathname, hasHydrated, syncSidebarWidth])

  // Re-clamp the width when the window shrinks below what the persisted width
  // allows, so the sidebar can never grow wider than the viewport permits.
  useEffect(() => {
    let rafId: number | null = null
    const onResize = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        syncSidebarWidth()
      })
    }
    window.addEventListener('resize', onResize)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [syncSidebarWidth])

  return (
    <div className='flex min-h-0 flex-1'>
      <div
        className={`sidebar-shell-outer shrink-0 overflow-hidden transition-[width] ${SLIDE_TRANSITION} ${isFullscreen ? 'w-0' : 'w-[var(--sidebar-width)]'}`}
        data-collapsed={isCollapsed || undefined}
        aria-hidden={isFullscreen || undefined}
        suppressHydrationWarning
      >
        <div
          id='workspace-navigation-root'
          className={`sidebar-shell-inner h-full w-[var(--sidebar-width)] shrink-0 transition-transform ${SLIDE_TRANSITION}${isFullscreen ? ' -translate-x-full' : ''}`}
        >
          {!workflowPath && <MainWebNavigation isCollapsed={isCollapsed} />}
        </div>
      </div>
      <div
        className={`flex min-w-0 flex-1 flex-col p-[8px] transition-[padding] ${SLIDE_TRANSITION}${isFullscreen ? '' : ' pl-0'}`}
      >
        <div className='flex-1 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg)]'>
          {children}
        </div>
      </div>
    </div>
  )
}
