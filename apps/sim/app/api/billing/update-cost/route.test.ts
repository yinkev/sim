/**
 * @vitest-environment node
 */
import { createMockRequest, dbChainMock, dbChainMockFns, resetDbChainMock } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRecordUsage,
  mockRecordCumulativeUsage,
  mockCheckAndBillOverageThreshold,
  mockFeatureFlags,
} = vi.hoisted(() => ({
  mockRecordUsage: vi.fn(),
  mockRecordCumulativeUsage: vi.fn(),
  mockCheckAndBillOverageThreshold: vi.fn(),
  mockFeatureFlags: { isBillingEnabled: true },
}))

vi.mock('@sim/db', () => dbChainMock)

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

vi.mock('@/lib/billing/core/usage-log', () => ({
  recordUsage: mockRecordUsage,
  recordCumulativeUsage: mockRecordCumulativeUsage,
}))

vi.mock('@/lib/billing/threshold-billing', () => ({
  checkAndBillOverageThreshold: mockCheckAndBillOverageThreshold,
}))

vi.mock('@/lib/core/config/env-flags', () => ({
  get isBillingEnabled() {
    return mockFeatureFlags.isBillingEnabled
  },
}))

import { POST } from '@/app/api/billing/update-cost/route'

const callbackHeaders = { 'x-sim-callback-key': 'callback-key' }

describe('POST /api/billing/update-cost — workspaceId attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
    mockRecordUsage.mockResolvedValue(undefined)
    mockRecordCumulativeUsage.mockResolvedValue({ billed: true, delta: 0.5, total: 0.5 })
    mockCheckAndBillOverageThreshold.mockResolvedValue(undefined)
    mockFeatureFlags.isBillingEnabled = true
    dbChainMockFns.limit.mockResolvedValue([{ id: 'ws-1' }])
  })

  it('stamps workspaceId onto recorded usage when provided (no idempotency key)', async () => {
    const res = await POST(
      createMockRequest(
        'POST',
        { userId: 'user-1', cost: 0.5, model: 'gpt', source: 'mcp_copilot', workspaceId: 'ws-1' },
        callbackHeaders
      )
    )
    expect(res.status).toBe(200)
    expect(mockRecordUsage).toHaveBeenCalledTimes(1)
    expect(mockRecordUsage.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      workspaceId: 'ws-1',
    })
  })

  it('records cumulative cost via monotonic top-up when an idempotency key is present', async () => {
    const res = await POST(
      createMockRequest(
        'POST',
        {
          userId: 'user-1',
          cost: 0.4662453,
          model: 'claude-opus-4.8',
          source: 'workspace-chat',
          workspaceId: 'ws-1',
          idempotencyKey: 'msg-1-billing',
          inputTokens: 461371,
          outputTokens: 1686,
        },
        callbackHeaders
      )
    )
    expect(res.status).toBe(200)
    expect(mockRecordUsage).not.toHaveBeenCalled()
    expect(mockRecordCumulativeUsage).toHaveBeenCalledTimes(1)
    expect(mockRecordCumulativeUsage.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      workspaceId: 'ws-1',
      source: 'workspace-chat',
      model: 'claude-opus-4.8',
      cost: 0.4662453,
      eventKey: 'update-cost:msg-1-billing',
    })
    expect(mockCheckAndBillOverageThreshold).toHaveBeenCalledWith('user-1')
  })

  it('returns 409 and skips overage when the cumulative is not higher (duplicate flush)', async () => {
    mockRecordCumulativeUsage.mockResolvedValue({ billed: false, delta: 0, total: 0.4662453 })
    const res = await POST(
      createMockRequest(
        'POST',
        {
          userId: 'user-1',
          cost: 0.4662453,
          model: 'claude-opus-4.8',
          source: 'workspace-chat',
          workspaceId: 'ws-1',
          idempotencyKey: 'msg-1-billing',
        },
        callbackHeaders
      )
    )
    expect(res.status).toBe(409)
    expect(mockCheckAndBillOverageThreshold).not.toHaveBeenCalled()
  })

  it('records unattributed when workspaceId is omitted (headless client)', async () => {
    const res = await POST(
      createMockRequest(
        'POST',
        { userId: 'user-1', cost: 0.5, model: 'gpt', source: 'copilot' },
        callbackHeaders
      )
    )
    expect(res.status).toBe(200)
    expect(dbChainMockFns.limit).not.toHaveBeenCalled()
    expect(mockRecordUsage).toHaveBeenCalledTimes(1)
    expect(mockRecordUsage.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      workspaceId: undefined,
    })
  })

  it('records unattributed when the workspace does not exist in this deployment (self-hosted client)', async () => {
    dbChainMockFns.limit.mockResolvedValue([])
    const res = await POST(
      createMockRequest(
        'POST',
        {
          userId: 'user-1',
          cost: 0.5,
          model: 'claude-opus-4.8',
          source: 'workspace-chat',
          workspaceId: 'self-hosted-ws',
          idempotencyKey: 'msg-1-billing',
        },
        callbackHeaders
      )
    )
    expect(res.status).toBe(200)
    expect(mockRecordCumulativeUsage).toHaveBeenCalledTimes(1)
    expect(mockRecordCumulativeUsage.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      workspaceId: undefined,
      eventKey: 'update-cost:msg-1-billing',
    })
  })

  it('rejects legacy x-api-key on the callback route', async () => {
    const res = await POST(
      createMockRequest(
        'POST',
        { userId: 'user-1', cost: 0.5, model: 'gpt', source: 'copilot' },
        { 'x-api-key': 'internal' }
      )
    )

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({
      success: false,
      error: 'Wrong Mothership service key family for callback route',
    })
    expect(mockRecordUsage).not.toHaveBeenCalled()
  })

  it('rejects missing callback auth', async () => {
    const res = await POST(
      createMockRequest('POST', { userId: 'user-1', cost: 0.5, model: 'gpt', source: 'copilot' })
    )

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      success: false,
      error: 'Mothership callback key required',
    })
    expect(mockRecordUsage).not.toHaveBeenCalled()
  })

  it('rejects missing callback auth even when billing is disabled', async () => {
    mockFeatureFlags.isBillingEnabled = false

    const res = await POST(
      createMockRequest('POST', { userId: 'user-1', cost: 0.5, model: 'gpt', source: 'copilot' })
    )

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      success: false,
      error: 'Mothership callback key required',
    })
    expect(mockRecordUsage).not.toHaveBeenCalled()
    expect(mockRecordCumulativeUsage).not.toHaveBeenCalled()
  })
})
