'use client'

import { lazy, type ReactNode, Suspense, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { OrganizationWhitelabelSettings } from '@/lib/branding/types'
import { shouldActivateWorkspaceRuntime } from '@/app/_shell/workspace-route-classification'

const loadWorkspaceRuntimeProviders = () =>
  import('@/app/workspace/[workspaceId]/providers/workspace-runtime-providers')

const LazyWorkspaceRuntimeProviders = lazy(() =>
  loadWorkspaceRuntimeProviders().then(({ WorkspaceRuntimeProviders }) => ({
    default: WorkspaceRuntimeProviders,
  }))
)

interface WorkspaceProviderBoundaryProps {
  children: ReactNode
  initialOrganizationId?: string
  initialOrgSettings?: OrganizationWhitelabelSettings | null
  initialThemeCSS: string
}

function RuntimeFallback({ initialThemeCSS }: { initialThemeCSS: string }) {
  return (
    <>
      {initialThemeCSS && <style>{initialThemeCSS}</style>}
      <div className='h-full w-full' aria-busy='true' />
    </>
  )
}

/** Defers query-backed workspace providers until the first non-Home route. */
export function WorkspaceProviderBoundary({
  children,
  initialOrganizationId,
  initialOrgSettings,
  initialThemeCSS,
}: WorkspaceProviderBoundaryProps) {
  const pathname = usePathname()
  const [runtimeActivated, setRuntimeActivated] = useState(() =>
    shouldActivateWorkspaceRuntime(false, pathname)
  )
  const shouldRenderRuntime = shouldActivateWorkspaceRuntime(runtimeActivated, pathname)

  useEffect(() => {
    if (shouldRenderRuntime && !runtimeActivated) setRuntimeActivated(true)
  }, [runtimeActivated, shouldRenderRuntime])

  useEffect(() => {
    if (shouldRenderRuntime) return
    void loadWorkspaceRuntimeProviders().catch(() => {})
  }, [shouldRenderRuntime])

  if (!shouldRenderRuntime) {
    return (
      <>
        {initialThemeCSS && <style>{initialThemeCSS}</style>}
        {children}
      </>
    )
  }

  return (
    <Suspense fallback={<RuntimeFallback initialThemeCSS={initialThemeCSS} />}>
      <LazyWorkspaceRuntimeProviders
        initialOrganizationId={initialOrganizationId}
        initialOrgSettings={initialOrgSettings}
      >
        {children}
      </LazyWorkspaceRuntimeProviders>
    </Suspense>
  )
}
