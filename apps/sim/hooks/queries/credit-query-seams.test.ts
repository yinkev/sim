import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readQuerySource(fileName: string): string {
  try {
    return readFileSync(new URL(fileName, import.meta.url), 'utf8')
  } catch {
    return ''
  }
}

function readCreditsSource(): string {
  return readFileSync(
    new URL(
      '../../app/workspace/[workspaceId]/home/components/credits-chip/credits-chip.tsx',
      import.meta.url
    ),
    'utf8'
  )
}

describe('credit query seams', () => {
  it('keeps the credits chip independent from broad query modules', () => {
    const creditsChip = readCreditsSource()
    const planView = readQuerySource('plan-view.ts')

    expect(creditsChip).toContain("from '@/hooks/queries/organization-member-credits'")
    expect(creditsChip).toContain("from '@/hooks/queries/subscription-data'")
    expect(creditsChip).toContain("from '@/hooks/queries/workspace-settings-prefetch'")
    expect(creditsChip).not.toContain("from '@/hooks/queries/organization'")
    expect(creditsChip).not.toContain("from '@/hooks/queries/subscription'")
    expect(creditsChip).not.toContain("from '@/hooks/queries/workspace'")
    expect(planView).toContain("from '@/hooks/queries/subscription-data'")
    expect(planView).not.toContain("from '@/hooks/queries/subscription'")
  })

  it('isolates member-credit reads from organization mutations', () => {
    const leaf = readQuerySource('organization-member-credits.ts')
    const compatibilityModule = readQuerySource('organization.ts')

    expect(leaf).toContain('export async function fetchMyMemberCredits')
    expect(leaf).toContain('export function useMyMemberCredits')
    expect(leaf).toContain("from '@/hooks/queries/organization-keys'")
    expect(leaf).toContain("queryKey: organizationKeys.myMemberCredits(workspaceId ?? '')")
    expect(leaf).toContain('queryFn: ({ signal }) => fetchMyMemberCredits')
    expect(leaf).toContain('enabled: Boolean(workspaceId) && enabled')
    expect(leaf).toContain('staleTime: 30 * 1000')
    expect(leaf).not.toMatch(/useMutation|updateOrganization|inviteOrganization/)
    expect(compatibilityModule).toContain(
      "export { useMyMemberCredits } from '@/hooks/queries/organization-member-credits'"
    )
    expect(compatibilityModule).not.toContain('export function useMyMemberCredits')
  })

  it('isolates subscription reads and upgrade prefetch from billing mutations', () => {
    const dataLeaf = readQuerySource('subscription-data.ts')
    const keysLeaf = readQuerySource('subscription-keys.ts')
    const compatibilityModule = readQuerySource('subscription.ts')

    expect(keysLeaf).toContain('export const subscriptionKeys')
    expect(dataLeaf).toContain('export async function fetchSubscriptionData')
    expect(dataLeaf).toContain('export function useSubscriptionData')
    expect(dataLeaf).toContain('export function prefetchUpgradeBillingData')
    expect(dataLeaf).toContain('queryKey: subscriptionKeys.user(includeOrg)')
    expect(dataLeaf).toContain('queryFn: ({ signal }) => fetchSubscriptionData(includeOrg, signal)')
    expect(dataLeaf).toContain('staleTime,')
    expect(dataLeaf).toContain('placeholderData: keepPreviousData')
    expect(dataLeaf).toContain('enabled,')
    expect(dataLeaf).not.toMatch(/useMutation|purchaseCreditsContract|createBillingPortalContract/)
    expect(compatibilityModule).toContain(
      "export { subscriptionKeys } from '@/hooks/queries/subscription-keys'"
    )
    expect(compatibilityModule).toMatch(
      /export \{\s*prefetchSubscriptionData,\s*prefetchUpgradeBillingData,\s*useSubscriptionData,?\s*\} from '@\/hooks\/queries\/subscription-data'/
    )
    expect(compatibilityModule).not.toContain('export function useSubscriptionData')
    expect(compatibilityModule).not.toContain('export const subscriptionKeys')
  })

  it('isolates workspace settings prefetch from workspace mutations', () => {
    const leaf = readQuerySource('workspace-settings-prefetch.ts')
    const compatibilityModule = readQuerySource('workspace.ts')

    expect(leaf).toContain('export async function fetchWorkspaceSettings')
    expect(leaf).toContain('export function prefetchWorkspaceSettings')
    expect(leaf).toContain('queryKey: workspaceKeys.settings(workspaceId)')
    expect(leaf).toContain('queryFn: ({ signal }) => fetchWorkspaceSettings(workspaceId, signal)')
    expect(leaf).toContain('staleTime: 30 * 1000')
    expect(leaf).not.toMatch(/useMutation|updateWorkspaceContract|deleteWorkspaceContract/)
    expect(compatibilityModule).toContain(
      "export { prefetchWorkspaceSettings } from '@/hooks/queries/workspace-settings-prefetch'"
    )
    expect(compatibilityModule).not.toContain('export function prefetchWorkspaceSettings')
  })
})
