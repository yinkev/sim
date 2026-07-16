'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import { updateOrganizationWhitelabelContract } from '@/lib/api/contracts/organization'
import type { OrganizationWhitelabelSettings } from '@/lib/branding/types'
import { whitelabelKeys } from '@/ee/whitelabeling/hooks/whitelabel-query'
import { organizationKeys } from '@/hooks/queries/organization-keys'

export { useWhitelabelSettings, whitelabelKeys } from '@/ee/whitelabeling/hooks/whitelabel-query'

/** PUT payload — string fields accept null to clear a previously-set value. */
export type WhitelabelSettingsPayload = {
  [K in keyof OrganizationWhitelabelSettings]: OrganizationWhitelabelSettings[K] extends
    | string
    | undefined
    ? string | null
    : OrganizationWhitelabelSettings[K]
}

interface UpdateWhitelabelVariables {
  orgId: string
  settings: WhitelabelSettingsPayload
}

/**
 * Hook to update whitelabel settings for an organization.
 */
export function useUpdateWhitelabelSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orgId, settings }: UpdateWhitelabelVariables) => {
      const result = await requestJson(updateOrganizationWhitelabelContract, {
        params: { id: orgId },
        body: settings,
      })
      return result.data
    },
    onSettled: (_data, _error, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: whitelabelKeys.settings(orgId) })
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(orgId) })
    },
  })
}
