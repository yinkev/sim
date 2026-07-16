import { describe, expect, it } from 'vitest'
import { organizationKeys as compatibilityOrganizationKeys } from '@/hooks/queries/organization'
import { organizationKeys as leafOrganizationKeys } from '@/hooks/queries/organization-keys'
import { subscriptionKeys as compatibilitySubscriptionKeys } from '@/hooks/queries/subscription'
import { subscriptionKeys as leafSubscriptionKeys } from '@/hooks/queries/subscription-keys'
import { workspaceKeys as compatibilityWorkspaceKeys } from '@/hooks/queries/workspace'
import { workspaceKeys as leafWorkspaceKeys } from '@/hooks/queries/workspace-keys'

describe('credit query key compatibility', () => {
  it('re-exports the exact organization key factory object', () => {
    expect(compatibilityOrganizationKeys).toBe(leafOrganizationKeys)
    expect(compatibilityOrganizationKeys.myMemberCredits('workspace-1')).toEqual([
      'organizations',
      'my-member-credits',
      'workspace-1',
    ])
  })

  it('re-exports the exact subscription key factory object', () => {
    expect(compatibilitySubscriptionKeys).toBe(leafSubscriptionKeys)
    expect(compatibilitySubscriptionKeys.user(false)).toEqual([
      'subscription',
      'user',
      { includeOrg: false },
    ])
    expect(compatibilitySubscriptionKeys.usage()).toEqual(['subscription', 'usage'])
  })

  it('re-exports the exact workspace key factory object', () => {
    expect(compatibilityWorkspaceKeys).toBe(leafWorkspaceKeys)
    expect(compatibilityWorkspaceKeys.settings('workspace-1')).toEqual([
      'workspace',
      'detail',
      'workspace-1',
      'settings',
    ])
  })
})
