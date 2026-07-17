import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Integrations } from '@/app/workspace/[workspaceId]/integrations/integrations'
import IntegrationsLoading from '@/app/workspace/[workspaceId]/integrations/loading'

export const metadata: Metadata = {
  title: 'Integrations',
}

/**
 * Integrations page entry. `Integrations` reads URL query params via nuqs (which
 * uses `useSearchParams` internally), so it must sit under a Suspense boundary.
 * The fallback renders the real page chrome (background + tab header) so a
 * suspend never shows a blank frame.
 */
export default function IntegrationsPage() {
  return (
    <Suspense fallback={<IntegrationsLoading />}>
      <Integrations />
    </Suspense>
  )
}
