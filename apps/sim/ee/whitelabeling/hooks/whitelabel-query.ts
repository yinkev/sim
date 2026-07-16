'use client'

import { useQuery } from '@tanstack/react-query'
import type { OrganizationWhitelabelSettings } from '@/lib/branding/types'

export const whitelabelKeys = {
  all: ['whitelabel'] as const,
  settingsList: () => [...whitelabelKeys.all, 'settings'] as const,
  settings: (orgId: string) => [...whitelabelKeys.settingsList(), orgId] as const,
}

async function fetchWhitelabelSettings(
  orgId: string,
  signal?: AbortSignal
): Promise<OrganizationWhitelabelSettings> {
  const [{ requestJson }, { getOrganizationWhitelabelContract }] = await Promise.all([
    import('@/lib/api/client/request'),
    import('@/lib/api/contracts/organization'),
  ])
  const { data } = await requestJson(getOrganizationWhitelabelContract, {
    params: { id: orgId },
    signal,
  })
  return data
}

interface UseWhitelabelSettingsOptions {
  initialData?: OrganizationWhitelabelSettings | null
}

export function useWhitelabelSettings(
  orgId: string | undefined,
  { initialData }: UseWhitelabelSettingsOptions = {}
) {
  const isServerSeeded = initialData !== undefined

  return useQuery<OrganizationWhitelabelSettings | null>({
    queryKey: whitelabelKeys.settings(orgId ?? ''),
    queryFn: ({ signal }) => fetchWhitelabelSettings(orgId as string, signal),
    enabled: Boolean(orgId),
    initialData,
    staleTime: isServerSeeded ? Number.POSITIVE_INFINITY : 60 * 1000,
  })
}
