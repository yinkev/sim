'use client'

import type { ReactNode } from 'react'
import type { OrganizationWhitelabelSettings } from '@/lib/branding/types'
import { QueryProvider } from '@/app/_shell/providers/query-provider'
import { WorkspacePermissionsProvider } from '@/app/workspace/[workspaceId]/providers/workspace-permissions-provider'
import { BrandingProvider } from '@/ee/whitelabeling/components/branding-provider'

interface WorkspaceRuntimeProvidersProps {
  children: ReactNode
  initialOrganizationId?: string
  initialOrgSettings?: OrganizationWhitelabelSettings | null
}

/** Query-backed providers activated after the lightweight Home entry. */
export function WorkspaceRuntimeProviders({
  children,
  initialOrganizationId,
  initialOrgSettings,
}: WorkspaceRuntimeProvidersProps) {
  return (
    <QueryProvider>
      <BrandingProvider
        initialOrganizationId={initialOrganizationId}
        initialOrgSettings={initialOrgSettings}
      >
        <WorkspacePermissionsProvider>{children}</WorkspacePermissionsProvider>
      </BrandingProvider>
    </QueryProvider>
  )
}
