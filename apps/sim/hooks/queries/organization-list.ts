'use client'

import { useQuery } from '@tanstack/react-query'
import { organizationKeys } from '@/hooks/queries/organization-keys'

async function fetchOrganizations(_signal?: AbortSignal) {
  const { client } = await import('@/lib/auth/auth-client')
  const [orgsResponse, activeOrgResponse] = await Promise.all([
    client.organization.list(),
    client.organization.getFullOrganization(),
  ])

  return {
    organizations: orgsResponse.data || [],
    activeOrganization: activeOrgResponse.data,
  }
}

interface UseOrganizationsOptions {
  enabled?: boolean
}

export function useOrganizations({ enabled = true }: UseOrganizationsOptions = {}) {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: ({ signal }) => fetchOrganizations(signal),
    enabled,
    staleTime: 30 * 1000,
  })
}
