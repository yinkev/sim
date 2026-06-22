/**
 * @vitest-environment node
 */
import { createMockRequest } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockExecuteWorkflowSubagent } = vi.hoisted(() => ({
  mockExecuteWorkflowSubagent: vi.fn(),
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

vi.mock('@/lib/copilot/subagents/workflow/execute', () => ({
  executeWorkflowSubagent: mockExecuteWorkflowSubagent,
}))

import { POST } from '@/app/api/copilot/subagents/workflow/execute/route'

const callbackHeaders = { 'x-sim-callback-key': 'callback-key' }

const validBody = {
  runId: '11111111-1111-4111-8111-111111111111',
  streamId: 'stream-1',
  chatId: 'chat-1',
  userId: 'user-1',
  workspaceId: 'workspace-1',
  parentToolCallId: 'tool-call-1',
  model: 'claude-opus-4-8',
  provider: 'anthropic',
  depth: 0,
  input: {
    prompt: 'Inspect the workflow and fix the failing block.',
    workflowId: 'workflow-1',
  },
  context: {
    workflowId: 'workflow-1',
    messages: [
      {
        role: 'user',
        content: 'Fix my workflow.',
      },
    ],
    resources: [
      {
        type: 'workflow',
        id: 'workflow-1',
        title: 'Support workflow',
      },
    ],
  },
  limits: {
    maxDepth: 1,
    maxProviderRounds: 8,
    maxChildToolCalls: 30,
  },
}

describe('POST /api/copilot/subagents/workflow/execute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExecuteWorkflowSubagent.mockResolvedValue({
      success: true,
      result: {
        status: 'completed',
        summary: 'Workflow inspected.',
        changedResources: [],
        artifacts: [],
      },
      streamEvents: [],
    })
  })

  it('rejects missing callback auth before parsing the body', async () => {
    const res = await POST(createMockRequest('POST', {}))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: 'callback_auth_failed',
    })
  })

  it('rejects legacy x-api-key before parsing the body', async () => {
    const res = await POST(createMockRequest('POST', {}, { 'x-api-key': 'callback-key' }))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: 'callback_auth_failed',
    })
  })

  it('validates the strict workflow subagent body after callback auth succeeds', async () => {
    const res = await POST(createMockRequest('POST', {}, callbackHeaders))

    expect(res.status).toBe(400)
  })

  it('executes a valid callback request through the workflow subagent engine', async () => {
    const res = await POST(createMockRequest('POST', validBody, callbackHeaders))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      success: true,
      result: {
        status: 'completed',
        summary: 'Workflow inspected.',
        changedResources: [],
        artifacts: [],
      },
      streamEvents: [],
    })
    expect(mockExecuteWorkflowSubagent).toHaveBeenCalledWith(validBody)
  })
})
