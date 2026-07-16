import type { ReactNode } from 'react'

interface BrandingProviderProps {
  children: ReactNode
  initialOrganizationId?: string
  initialOrgSettings?: unknown
}

/** Uses the root instance branding when authentication and organizations are disabled. */
export function BrandingProvider({ children }: BrandingProviderProps) {
  return <>{children}</>
}
