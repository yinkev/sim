/**
 * @vitest-environment node
 */
import { createMockRequest } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockVerifyEffectiveSuperUser,
  mockGetUserEntityPermissions,
  mockIsWorkspaceOnEnterprisePlan,
} = vi.hoisted(() => ({
  mockVerifyEffectiveSuperUser: vi.fn(),
  mockGetUserEntityPermissions: vi.fn(),
  mockIsWorkspaceOnEnterprisePlan: vi.fn(),
}))

vi.mock('@/lib/core/config/env', () => ({
  env: {
    SIM_TO_MOTHERSHIP_API_KEY: 'runtime-key',
    MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-key',
    MOTHERSHIP_ADMIN_API_KEY: 'admin-key',
    INTERNAL_API_SECRET: 'internal-secret',
    COPILOT_API_KEY: undefined,
  },
  isTruthy: (value: string | boolean | number | undefined) =>
    typeof value === 'string' ? value.toLowerCase() === 'true' || value === '1' : Boolean(value),
}))

vi.mock('@/lib/permissions/super-user', () => ({
  verifyEffectiveSuperUser: mockVerifyEffectiveSuperUser,
}))

vi.mock('@/lib/workspaces/permissions/utils', () => ({
  getUserEntityPermissions: mockGetUserEntityPermissions,
}))

vi.mock('@/lib/billing/core/subscription', () => ({
  isWorkspaceOnEnterprisePlan: mockIsWorkspaceOnEnterprisePlan,
}))

import { POST } from '@/app/api/copilot/byok/validate/route'

const callbackHeaders = { 'x-sim-callback-key': 'callback-key' }
const body = { workspaceId: 'ws-1', userId: 'user-1' }

describe('POST /api/copilot/byok/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyEffectiveSuperUser.mockResolvedValue({ effectiveSuperUser: false })
    mockGetUserEntityPermissions.mockResolvedValue({ role: 'member' })
    mockIsWorkspaceOnEnterprisePlan.mockResolvedValue(true)
  })

  it('accepts a superuser admin with callback auth', async () => {
    mockVerifyEffectiveSuperUser.mockResolvedValue({ effectiveSuperUser: true })

    const res = await POST(createMockRequest('POST', body, callbackHeaders))

    expect(res.status).toBe(200)
    expect(mockGetUserEntityPermissions).not.toHaveBeenCalled()
    expect(mockIsWorkspaceOnEnterprisePlan).not.toHaveBeenCalled()
  })

  it('accepts a workspace member on an enterprise workspace', async () => {
    const res = await POST(createMockRequest('POST', body, callbackHeaders))

    expect(res.status).toBe(200)
    expect(mockGetUserEntityPermissions).toHaveBeenCalledWith('user-1', 'workspace', 'ws-1')
    expect(mockIsWorkspaceOnEnterprisePlan).toHaveBeenCalledWith('ws-1')
  })

  it('rejects legacy x-api-key on the callback route', async () => {
    const res = await POST(createMockRequest('POST', body, { 'x-api-key': 'internal' }))

    expect(res.status).toBe(403)
    expect(mockVerifyEffectiveSuperUser).not.toHaveBeenCalled()
  })

  it('rejects missing callback auth', async () => {
    const res = await POST(createMockRequest('POST', body))

    expect(res.status).toBe(401)
    expect(mockVerifyEffectiveSuperUser).not.toHaveBeenCalled()
  })

  it('rejects non-members', async () => {
    mockGetUserEntityPermissions.mockResolvedValue(null)

    const res = await POST(createMockRequest('POST', body, callbackHeaders))

    expect(res.status).toBe(403)
    expect(mockIsWorkspaceOnEnterprisePlan).not.toHaveBeenCalled()
  })

  it('rejects non-enterprise workspaces', async () => {
    mockIsWorkspaceOnEnterprisePlan.mockResolvedValue(false)

    const res = await POST(createMockRequest('POST', body, callbackHeaders))

    expect(res.status).toBe(403)
  })
})
