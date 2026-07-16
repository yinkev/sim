'use client'

import { lazy, type ReactNode, Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { isWorkspaceRoute } from '@/app/_shell/workspace-route-classification'

const LazyQueryProvider = lazy(() =>
  import('@/app/_shell/providers/query-provider').then(({ QueryProvider }) => ({
    default: QueryProvider,
  }))
)

/** Leaves ID-scoped workspace routes to their route-owned query boundary. */
export function RootQueryBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  if (isWorkspaceRoute(pathname)) return children

  return (
    <Suspense fallback={null}>
      <LazyQueryProvider>{children}</LazyQueryProvider>
    </Suspense>
  )
}
