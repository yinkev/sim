/**
 * @vitest-environment node
 */
import { createMockRequest } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFlags, mockDbLimit, mockCheckServerSideUsageLimits, mockCheckOrgMemberUsageLimit } =
  vi.hoisted(() => ({
    mockFlags: { isHosted: true },
    mockDbLimit: vi.fn(),
    mockCheckServerSideUsageLimits: vi.fn(),
    mockCheckOrgMemberUsageLimit: vi.fn(),
  }))

vi.mock('@sim/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mockDbLimit }) }) }),
  },
}))

vi.mock('@/lib/billing/calculations/usage-monitor', () => ({
  checkServerSideUsageLimits: mockCheckServerSideUsageLimits,
  checkOrgMemberUsageLimit: mockCheckOrgMemberUsageLimit,
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

vi.mock('@/lib/copilot/request/otel', () => ({
  withIncomingGoSpan: (
    _headers: unknown,
    _span: unknown,
    _attrs: unknown,
    fn: (span: { setAttribute: () => void; setAttributes: () => void }) => unknown
  ) => fn({ setAttribute: vi.fn(), setAttributes: vi.fn() }),
}))

vi.mock('@/lib/core/config/env-flags', () => ({
  get isHosted() {
    return mockFlags.isHosted
  },
}))

import { POST } from '@/app/api/copilot/api-keys/validate/route'

function request(body: Record<string, unknown>) {
  return createMockRequest('POST', body, { 'x-sim-callback-key': 'callback-key' })
}

describe('POST /api/copilot/api-keys/validate — per-member enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFlags.isHosted = true
    mockDbLimit.mockResolvedValue([{ id: 'user-1' }])
    mockCheckServerSideUsageLimits.mockResolvedValue({
      isExceeded: false,
      currentUsage: 0,
      limit: 100,
    })
    mockCheckOrgMemberUsageLimit.mockResolvedValue({
      isExceeded: false,
      currentUsage: 0,
      limit: null,
    })
  })

  it('returns 402 when the pooled/personal limit is exceeded (existing behavior)', async () => {
    mockCheckServerSideUsageLimits.mockResolvedValue({
      isExceeded: true,
      currentUsage: 200,
      limit: 100,
    })
    const res = await POST(request({ userId: 'user-1', workspaceId: 'ws-1' }))
    expect(res.status).toBe(402)
    expect(mockCheckOrgMemberUsageLimit).not.toHaveBeenCalled()
  })

  it('returns 402 when the per-member org-workspace cap is exceeded', async () => {
    mockCheckOrgMemberUsageLimit.mockResolvedValue({
      isExceeded: true,
      currentUsage: 5,
      limit: 4,
    })
    const res = await POST(request({ userId: 'user-1', workspaceId: 'ws-1' }))
    expect(res.status).toBe(402)
    expect(mockCheckOrgMemberUsageLimit).toHaveBeenCalledWith('user-1', 'ws-1')
  })

  it('returns 200 when under both limits', async () => {
    const res = await POST(request({ userId: 'user-1', workspaceId: 'ws-1' }))
    expect(res.status).toBe(200)
  })

  it('rejects legacy x-api-key on the callback route', async () => {
    const res = await POST(
      createMockRequest(
        'POST',
        { userId: 'user-1', workspaceId: 'ws-1' },
        { 'x-api-key': 'internal' }
      )
    )
    expect(res.status).toBe(403)
    expect(mockCheckServerSideUsageLimits).not.toHaveBeenCalled()
  })

  it('rejects missing callback auth', async () => {
    const res = await POST(createMockRequest('POST', { userId: 'user-1', workspaceId: 'ws-1' }))
    expect(res.status).toBe(401)
    expect(mockCheckServerSideUsageLimits).not.toHaveBeenCalled()
  })

  it('rejects with 400 when workspaceId is omitted (contract-required, fail closed)', async () => {
    const res = await POST(request({ userId: 'user-1' }))
    expect(res.status).toBe(400)
    expect(mockCheckOrgMemberUsageLimit).not.toHaveBeenCalled()
  })

  it('skips the per-member check when not hosted', async () => {
    mockFlags.isHosted = false
    const res = await POST(request({ userId: 'user-1', workspaceId: 'ws-1' }))
    expect(res.status).toBe(200)
    expect(mockCheckOrgMemberUsageLimit).not.toHaveBeenCalled()
  })
})
