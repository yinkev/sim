/**
 * @vitest-environment node
 */
import { dbChainMock, dbChainMockFns, resetDbChainMock } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sim/db', () => dbChainMock)

import { getUserOrganization } from '@/lib/billing/organizations/membership-lookup'

describe('getUserOrganization', () => {
  beforeEach(() => {
    resetDbChainMock()
  })

  it('returns the first organization membership', async () => {
    const membership = {
      organizationId: 'org-1',
      role: 'admin',
      memberId: 'member-1',
    }
    dbChainMockFns.limit.mockResolvedValueOnce([membership])

    await expect(getUserOrganization('user-1')).resolves.toEqual(membership)
  })

  it('returns null when the user has no organization membership', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([])

    await expect(getUserOrganization('user-1')).resolves.toBeNull()
  })
})
