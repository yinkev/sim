import type { QueryClient } from '@tanstack/react-query'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import {
  getUserBillingContract,
  getUserUsageLimitContract,
  type SubscriptionApiResponse,
} from '@/lib/api/contracts/subscription'
import { subscriptionKeys } from '@/hooks/queries/subscription-keys'

export type { SubscriptionApiResponse }

export async function fetchSubscriptionData(
  includeOrg = false,
  signal?: AbortSignal
): Promise<SubscriptionApiResponse> {
  return requestJson(getUserBillingContract, {
    query: { context: 'user', includeOrg },
    signal,
  })
}

export async function fetchUsageLimitData(signal?: AbortSignal) {
  return requestJson(getUserUsageLimitContract, {
    query: { context: 'user' },
    signal,
  })
}

interface UseSubscriptionDataOptions {
  /** Include organization membership and role data. */
  includeOrg?: boolean
  /** Whether to enable the query. */
  enabled?: boolean
  /** Override the default five-minute stale time. */
  staleTime?: number
}

export function useSubscriptionData(options: UseSubscriptionDataOptions = {}) {
  const { includeOrg = false, enabled = true, staleTime = 5 * 60 * 1000 } = options

  return useQuery({
    queryKey: subscriptionKeys.user(includeOrg),
    queryFn: ({ signal }) => fetchSubscriptionData(includeOrg, signal),
    staleTime,
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Prefetch personal subscription data before navigation. */
export function prefetchSubscriptionData(queryClient: QueryClient) {
  queryClient.prefetchQuery({
    queryKey: subscriptionKeys.user(false),
    queryFn: ({ signal }) => fetchSubscriptionData(false, signal),
    staleTime: 5 * 60 * 1000,
  })
}

/** Prefetch subscription and usage-limit data required by the Upgrade page. */
export function prefetchUpgradeBillingData(queryClient: QueryClient) {
  queryClient.prefetchQuery({
    queryKey: subscriptionKeys.user(true),
    queryFn: ({ signal }) => fetchSubscriptionData(true, signal),
    staleTime: 5 * 60 * 1000,
  })
  queryClient.prefetchQuery({
    queryKey: subscriptionKeys.usage(),
    queryFn: ({ signal }) => fetchUsageLimitData(signal),
    staleTime: 30 * 1000,
  })
}
