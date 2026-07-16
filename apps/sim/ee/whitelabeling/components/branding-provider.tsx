'use client'

import { createContext, useContext, useMemo } from 'react'
import type { BrandConfig, OrganizationWhitelabelSettings } from '@/lib/branding/types'
import { getBrandConfig } from '@/ee/whitelabeling/branding'
import { useWhitelabelSettings } from '@/ee/whitelabeling/hooks/whitelabel-query'
import { generateOrgThemeCSS, mergeOrgBrandConfig } from '@/ee/whitelabeling/org-branding-utils'
import { useOrganizations } from '@/hooks/queries/organization-list'

interface BrandingContextValue {
  config: BrandConfig
}

const BrandingContext = createContext<BrandingContextValue>({
  config: getBrandConfig(),
})

interface BrandingProviderProps {
  children: React.ReactNode
  initialOrganizationId?: string
  /**
   * Org whitelabel settings fetched server-side from the DB by the workspace layout.
   * Used as the source of truth until the React Query result becomes available,
   * ensuring the correct org logo appears in the initial server HTML — no flash.
   */
  initialOrgSettings?: OrganizationWhitelabelSettings | null
}

/**
 * Provides merged branding (instance env vars + org DB settings) to the workspace.
 * Injects a `<style>` tag with CSS variable overrides when org colors are configured.
 */
export function BrandingProvider({
  children,
  initialOrganizationId,
  initialOrgSettings,
}: BrandingProviderProps) {
  const { data: orgsData } = useOrganizations({ enabled: false })
  const orgId = orgsData?.activeOrganization?.id ?? initialOrganizationId
  const isInitialOrganization = orgId === initialOrganizationId
  const { data: orgSettings } = useWhitelabelSettings(orgId, {
    initialData: isInitialOrganization ? initialOrgSettings : undefined,
  })

  const effectiveOrgSettings =
    orgSettings !== undefined
      ? orgSettings
      : isInitialOrganization
        ? (initialOrgSettings ?? null)
        : null

  const brandConfig = useMemo(
    () => mergeOrgBrandConfig(effectiveOrgSettings, getBrandConfig()),
    [effectiveOrgSettings]
  )

  const themeCSS = useMemo(
    () => (effectiveOrgSettings ? generateOrgThemeCSS(effectiveOrgSettings) : ''),
    [effectiveOrgSettings]
  )

  return (
    <BrandingContext.Provider value={{ config: brandConfig }}>
      {themeCSS && <style>{themeCSS}</style>}
      {children}
    </BrandingContext.Provider>
  )
}

/**
 * Returns the merged brand config (org settings overlaid on instance defaults).
 * Use this inside the workspace instead of `getBrandConfig()`.
 */
export function useOrgBrandConfig(): BrandConfig {
  return useContext(BrandingContext).config
}
