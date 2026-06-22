import {
  adminByokDeleteContract,
  adminByokGetContract,
  adminByokPostContract,
  adminProcessBillingCallbacksContract,
  copilotRuntimeContract,
  explicitAbortContract,
  forkChatContract,
  generateChatTitleContract,
  mothershipExecuteRuntimeContract,
  mothershipRuntimeContract,
  resumeToolsContract,
  streamReplayBatchContract,
  streamReplayContract,
  validateKeyDeleteContract,
  validateKeyGenerateContract,
  validateKeyListContract,
} from '@sim/mothership-contracts/routes'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MothershipEnv } from '@/env'

const {
  mockClaimMothershipRuntimeRun,
  mockCreateMothershipToolCheckpoint,
  mockGetMothershipByokProviderKey,
  mockProcessPendingMothershipBillingUsageCallbacks,
  mockReportMothershipBillingUsage,
  mockValidateMothershipApiKeyEntitlement,
  mockValidateMothershipByokEntitlement,
  mockGetMothershipRunByStream,
  mockGetMothershipResumeCheckpoint,
  mockGetOrSetMothershipResumeEventStartSeq,
  mockMarkMothershipResumeToolResultDelivered,
  mockMarkMothershipRunComplete,
  mockMarkMothershipRunFailed,
  mockMarkMothershipRunPausedForTool,
  mockMarkMothershipRunCancelled,
  mockAppendMothershipRunEvents,
  mockAcknowledgeMothershipChatFork,
  mockDeleteMothershipByokProviderKeys,
  mockExecuteWorkflowSubagentCallback,
  mockDeleteMothershipApiKey,
  mockGenerateMothershipApiKey,
  mockGetLatestMothershipRunEventSeq,
  mockListMothershipApiKeys,
  mockListMothershipByokProviders,
  mockReadMothershipRunEvents,
  mockRecordMothershipResumeToolResults,
  mockUpsertMothershipByokProviderKey,
} = vi.hoisted(() => ({
  mockClaimMothershipRuntimeRun: vi.fn(),
  mockCreateMothershipToolCheckpoint: vi.fn(),
  mockGetMothershipByokProviderKey: vi.fn(),
  mockProcessPendingMothershipBillingUsageCallbacks: vi.fn(),
  mockReportMothershipBillingUsage: vi.fn(),
  mockValidateMothershipApiKeyEntitlement: vi.fn(),
  mockValidateMothershipByokEntitlement: vi.fn(),
  mockGetMothershipRunByStream: vi.fn(),
  mockGetMothershipResumeCheckpoint: vi.fn(),
  mockGetOrSetMothershipResumeEventStartSeq: vi.fn(),
  mockMarkMothershipResumeToolResultDelivered: vi.fn(),
  mockMarkMothershipRunComplete: vi.fn(),
  mockMarkMothershipRunFailed: vi.fn(),
  mockMarkMothershipRunPausedForTool: vi.fn(),
  mockMarkMothershipRunCancelled: vi.fn(),
  mockAppendMothershipRunEvents: vi.fn(),
  mockAcknowledgeMothershipChatFork: vi.fn(),
  mockDeleteMothershipByokProviderKeys: vi.fn(),
  mockExecuteWorkflowSubagentCallback: vi.fn(),
  mockDeleteMothershipApiKey: vi.fn(),
  mockGenerateMothershipApiKey: vi.fn(),
  mockGetLatestMothershipRunEventSeq: vi.fn(),
  mockListMothershipApiKeys: vi.fn(),
  mockListMothershipByokProviders: vi.fn(),
  mockReadMothershipRunEvents: vi.fn(),
  mockRecordMothershipResumeToolResults: vi.fn(),
  mockUpsertMothershipByokProviderKey: vi.fn(),
}))

vi.mock('@/state/chat-store', () => ({
  acknowledgeMothershipChatFork: mockAcknowledgeMothershipChatFork,
}))
vi.mock('@/callbacks', () => ({
  executeWorkflowSubagentCallback: mockExecuteWorkflowSubagentCallback,
  processPendingMothershipBillingUsageCallbacks: mockProcessPendingMothershipBillingUsageCallbacks,
  reportMothershipBillingUsage: mockReportMothershipBillingUsage,
  validateMothershipApiKeyEntitlement: mockValidateMothershipApiKeyEntitlement,
  validateMothershipByokEntitlement: mockValidateMothershipByokEntitlement,
}))
vi.mock('@/state/byok-store', () => ({
  deleteMothershipByokProviderKeys: mockDeleteMothershipByokProviderKeys,
  getMothershipByokProviderKey: mockGetMothershipByokProviderKey,
  listMothershipByokProviders: mockListMothershipByokProviders,
  upsertMothershipByokProviderKey: mockUpsertMothershipByokProviderKey,
}))
vi.mock('@/state/api-key-store', () => ({
  deleteMothershipApiKey: mockDeleteMothershipApiKey,
  generateMothershipApiKey: mockGenerateMothershipApiKey,
  listMothershipApiKeys: mockListMothershipApiKeys,
}))
vi.mock('@/state/run-store', () => ({
  claimMothershipRuntimeRun: mockClaimMothershipRuntimeRun,
  getMothershipRunByStream: mockGetMothershipRunByStream,
  markMothershipRunComplete: mockMarkMothershipRunComplete,
  markMothershipRunFailed: mockMarkMothershipRunFailed,
  markMothershipRunPausedForTool: mockMarkMothershipRunPausedForTool,
  markMothershipRunCancelled: mockMarkMothershipRunCancelled,
}))
vi.mock('@/state/resume-store', () => ({
  createMothershipToolCheckpoint: mockCreateMothershipToolCheckpoint,
  getMothershipResumeCheckpoint: mockGetMothershipResumeCheckpoint,
  getOrSetMothershipResumeEventStartSeq: mockGetOrSetMothershipResumeEventStartSeq,
  markMothershipResumeToolResultDelivered: mockMarkMothershipResumeToolResultDelivered,
  recordMothershipResumeToolResults: mockRecordMothershipResumeToolResults,
}))
vi.mock('@/state/stream-event-store', () => ({
  appendMothershipRunEvents: mockAppendMothershipRunEvents,
  getLatestMothershipRunEventSeq: mockGetLatestMothershipRunEventSeq,
  readMothershipRunEvents: mockReadMothershipRunEvents,
}))

import { createMothershipHandler } from '@/http'
import { createMothershipApp, createMothershipNodeServer, MAX_REQUEST_BODY_BYTES } from '@/server'

const RUNTIME_SECRET = 'runtime-secret-at-least-16'
const ADMIN_SECRET = 'admin-secret-at-least-16'
const RUNTIME_CHAT_ID = '11111111-1111-4111-8111-111111111111'
const RUNTIME_RUN_ID = '22222222-2222-4222-8222-222222222222'
const RUNTIME_PARENT_RUN_ID = '33333333-3333-4333-8333-333333333333'

const TEST_ENV: MothershipEnv = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 6891,
  SIM_TO_MOTHERSHIP_API_KEY: RUNTIME_SECRET,
  MOTHERSHIP_ADMIN_API_KEY: ADMIN_SECRET,
  MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
  SIM_BASE_URL: 'http://sim.local',
  API_ENCRYPTION_KEY: 'b'.repeat(64),
  ENCRYPTION_KEY: 'a'.repeat(64),
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

async function readSseData(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text()
  return text
    .trim()
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk.replace(/^data: /, '')) as Record<string, unknown>)
}

function anthropicSseResponse(frames: string[]): Response {
  return new Response(frames.join('\n\n'), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function openAISseResponse(frames: string[], delimiter = '\n\n'): Response {
  return new Response(frames.join(delimiter), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function validResumeProviderRequest() {
  return {
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    executionId: 'exec-1',
    billing: {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      cumulativeUsage: {},
    },
    request: {
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      stream: true,
      messages: [{ role: 'user', content: 'inspect workflow' }],
    },
    assistantContent: [
      { type: 'text', text: 'I will check.' },
      {
        type: 'tool_use',
        id: 'toolu-1',
        name: 'read_workflow',
        input: { workflowId: 'workflow-1' },
      },
    ],
  }
}

function validOpenAIResumeProviderRequest() {
  return {
    provider: 'openai',
    model: 'gpt-4.1',
    executionId: 'exec-1',
    billing: {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      cumulativeUsage: {
        input_tokens: 5,
        output_tokens: 8,
      },
    },
    request: {
      model: 'gpt-4.1',
      stream: true,
      input: [{ role: 'user', content: 'inspect workflow' }],
      tools: [
        {
          type: 'function',
          name: 'read_workflow',
          description: 'Read a workflow',
          parameters: {
            type: 'object',
            properties: { workflowId: { type: 'string' } },
            required: ['workflowId'],
          },
        },
      ],
    },
    outputItems: [
      {
        type: 'function_call',
        call_id: 'call-1',
        name: 'read_workflow',
        arguments: '{"workflowId":"workflow-1"}',
      },
    ],
  }
}

function validWorkflowSubagentResumeContext() {
  return {
    chatId: RUNTIME_CHAT_ID,
    message: 'hello',
    messageId: 'stream-1',
    userId: 'user-1',
    workflowId: 'workflow-1',
    workflowName: 'Support workflow',
    workspaceId: 'workspace-1',
  }
}

function validOpenAIMultiToolResumeProviderRequest() {
  const request = validOpenAIResumeProviderRequest()
  return {
    ...request,
    request: {
      ...request.request,
      tools: [
        ...request.request.tools,
        {
          type: 'function',
          name: 'search_docs',
          description: 'Search docs',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      ],
    },
    outputItems: [
      ...request.outputItems,
      {
        type: 'function_call',
        call_id: 'call-2',
        name: 'search_docs',
        arguments: '{"query":"checkpoint docs"}',
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClaimMothershipRuntimeRun.mockResolvedValue({
    status: 'ready',
    run: {
      id: RUNTIME_RUN_ID,
      executionId: 'exec-1',
      chatId: RUNTIME_CHAT_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'active',
      completedAt: null,
      error: null,
    },
  })
  mockMarkMothershipRunComplete.mockResolvedValue({
    id: RUNTIME_RUN_ID,
    streamId: 'stream-1',
    userId: 'user-1',
    status: 'complete',
    completedAt: new Date('2026-06-20T00:00:00.000Z'),
    error: null,
  })
  mockMarkMothershipRunPausedForTool.mockResolvedValue({
    id: RUNTIME_RUN_ID,
    streamId: 'stream-1',
    userId: 'user-1',
    status: 'paused_waiting_for_tool',
    completedAt: null,
    error: null,
  })
  mockGetMothershipRunByStream.mockResolvedValue(null)
  mockGetOrSetMothershipResumeEventStartSeq.mockResolvedValue(0)
  mockMarkMothershipRunFailed.mockResolvedValue({
    id: RUNTIME_RUN_ID,
    streamId: 'stream-1',
    userId: 'user-1',
    status: 'error',
    completedAt: new Date('2026-06-20T00:00:00.000Z'),
    error: 'owned_provider_continuation_not_implemented',
  })
  mockMarkMothershipRunCancelled.mockResolvedValue(null)
  mockProcessPendingMothershipBillingUsageCallbacks.mockResolvedValue({
    attempted: 1,
    completed: 1,
    deadLettered: 0,
    leaseLost: 0,
    reaped: 0,
    retryable: 0,
  })
  mockReportMothershipBillingUsage.mockResolvedValue({ status: 'ok' })
  mockValidateMothershipApiKeyEntitlement.mockResolvedValue({ status: 'ok' })
  mockValidateMothershipByokEntitlement.mockResolvedValue({ status: 'ok' })
  mockGetMothershipByokProviderKey.mockResolvedValue(null)
  mockAppendMothershipRunEvents.mockImplementation(async ({ events }) => events)
  mockAcknowledgeMothershipChatFork.mockResolvedValue({ status: 'ready', copied: false })
  mockDeleteMothershipByokProviderKeys.mockResolvedValue({
    workspaceId: 'workspace-1',
    provider: 'anthropic',
  })
  mockDeleteMothershipApiKey.mockResolvedValue({ deleted: true })
  mockGenerateMothershipApiKey.mockResolvedValue({
    id: 'api-key-1',
    apiKey: 'sk-sim-generated',
  })
  mockListMothershipByokProviders.mockResolvedValue([
    {
      provider: 'anthropic',
      configured: true,
      createdBy: 'admin-1',
      createdAt: '2026-06-21T00:00:00.000Z',
      updatedAt: '2026-06-21T00:00:01.000Z',
    },
  ])
  mockListMothershipApiKeys.mockResolvedValue([
    {
      id: 'api-key-1',
      name: 'Default',
      displayKey: 'sk-sim-...ated',
      createdAt: '2026-06-21T00:00:00.000Z',
      lastUsed: null,
    },
  ])
  mockUpsertMothershipByokProviderKey.mockResolvedValue({
    workspaceId: 'workspace-1',
    provider: 'anthropic',
  })
  mockCreateMothershipToolCheckpoint.mockResolvedValue({
    status: 'ready',
    checkpointId: 'checkpoint-1',
    pendingToolCallIds: ['toolu-1'],
  })
  mockGetMothershipResumeCheckpoint.mockResolvedValue({
    checkpointId: 'checkpoint-1',
    runId: RUNTIME_RUN_ID,
    streamId: 'stream-1',
    userId: 'user-1',
    workspaceId: 'workspace-1',
    runStatus: 'paused_waiting_for_tool',
    pendingToolCallId: 'toolu-1',
    conversationSnapshot: {},
    agentState: {},
    providerRequest: validResumeProviderRequest(),
    resumeEventStartSeq: null,
    toolCalls: [],
  })
  mockGetLatestMothershipRunEventSeq.mockResolvedValue(0)
  mockReadMothershipRunEvents.mockResolvedValue([])
  mockMarkMothershipResumeToolResultDelivered.mockResolvedValue({})
  mockRecordMothershipResumeToolResults.mockResolvedValue({ status: 'missing_checkpoint' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mothership HTTP handler', () => {
  it('keeps replay stream and batch contracts response-mode specific', () => {
    const baseQuery = {
      streamId: 'stream-1',
      userId: 'user-1',
      after: '0',
    }

    expect(streamReplayContract.query?.safeParse(baseQuery).success).toBe(true)
    expect(streamReplayContract.query?.safeParse({ ...baseQuery, batch: 'false' }).success).toBe(
      true
    )
    expect(streamReplayContract.query?.safeParse({ ...baseQuery, batch: 'true' }).success).toBe(
      false
    )
    expect(streamReplayBatchContract.query?.safeParse(baseQuery).success).toBe(false)
    expect(
      streamReplayBatchContract.query?.safeParse({ ...baseQuery, batch: 'false' }).success
    ).toBe(false)
    expect(
      streamReplayBatchContract.query?.safeParse({ ...baseQuery, batch: 'true' }).success
    ).toBe(true)
  })

  it('serves unauthenticated health checks with request id propagation', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request('http://mothership.local/health', {
        headers: { 'x-request-id': 'req-health-1' },
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-health-1')
    expect(await readJson(response)).toMatchObject({
      ok: true,
      service: 'mothership',
      status: 'ok',
      requestId: 'req-health-1',
    })
  })

  it('rejects readiness without the runtime key', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(new Request('http://mothership.local/ready'))

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
  })

  it('accepts readiness with runtime auth context', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request('http://mothership.local/ready', {
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-sim-source-env': 'dev',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toMatchObject({
      ok: true,
      status: 'ready',
      auth: {
        family: 'runtime',
        sourceEnv: 'dev',
      },
    })
  })

  it('does not accept an admin key on runtime readiness', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request('http://mothership.local/ready', {
        headers: {
          'x-mothership-runtime-key': ADMIN_SECRET,
        },
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'unknown_service_key',
    })
  })

  it('ignores admin headers on runtime readiness', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request('http://mothership.local/ready', {
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
        },
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
  })

  it('rejects invalid source environment headers', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request('http://mothership.local/ready', {
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-sim-source-env': 'local',
        },
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_auth_headers',
    })
  })

  it('reports not-ready while shutting down', async () => {
    const state = { shuttingDown: true }
    const handler = createMothershipHandler(TEST_ENV, state)
    const response = await handler(
      new Request('http://mothership.local/ready', {
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      ok: false,
      status: 'shutting_down',
    })
  })

  it('authenticates readiness before reporting shutdown state', async () => {
    const state = { shuttingDown: true }
    const handler = createMothershipHandler(TEST_ENV, state)
    const response = await handler(new Request('http://mothership.local/ready'))

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
  })

  it('rejects billing callback processor requests without the admin key before parsing body', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminProcessBillingCallbacksContract.path}`, {
        method: adminProcessBillingCallbacksContract.method,
        body: '{',
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(mockProcessPendingMothershipBillingUsageCallbacks).not.toHaveBeenCalled()
  })

  it('does not accept runtime keys on the billing callback processor route', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminProcessBillingCallbacksContract.path}`, {
        method: adminProcessBillingCallbacksContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({ batchSize: 5 }),
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(mockProcessPendingMothershipBillingUsageCallbacks).not.toHaveBeenCalled()
  })

  it('rejects invalid billing callback processor bodies after admin auth', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminProcessBillingCallbacksContract.path}`, {
        method: adminProcessBillingCallbacksContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({ batchSize: 0 }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockProcessPendingMothershipBillingUsageCallbacks).not.toHaveBeenCalled()
  })

  it('processes pending billing callback outbox events through an admin route', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminProcessBillingCallbacksContract.path}`, {
        method: adminProcessBillingCallbacksContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
          'x-request-id': 'req-process-billing-1',
        },
        body: JSON.stringify({ batchSize: 5 }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toMatchObject({
      success: true,
      requestId: 'req-process-billing-1',
      attempted: 1,
      completed: 1,
      deadLettered: 0,
      leaseLost: 0,
      reaped: 0,
      retryable: 0,
    })
    expect(mockProcessPendingMothershipBillingUsageCallbacks).toHaveBeenCalledWith({
      env: TEST_ENV,
      batchSize: 5,
    })
  })

  it('fails billing callback processor requests with non-clean outcomes when requested', async () => {
    mockProcessPendingMothershipBillingUsageCallbacks.mockResolvedValueOnce({
      attempted: 2,
      completed: 1,
      deadLettered: 0,
      leaseLost: 0,
      reaped: 1,
      retryable: 1,
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminProcessBillingCallbacksContract.path}`, {
        method: adminProcessBillingCallbacksContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
          'x-request-id': 'req-process-billing-non-clean',
        },
        body: JSON.stringify({ batchSize: 5, failOnNonClean: true }),
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      success: false,
      requestId: 'req-process-billing-non-clean',
      code: 'billing_callback_batch_not_clean',
      attempted: 2,
      completed: 1,
      reaped: 1,
      retryable: 1,
    })
  })

  it('allows non-clean billing callback processor responses when failOnNonClean is disabled', async () => {
    mockProcessPendingMothershipBillingUsageCallbacks.mockResolvedValueOnce({
      attempted: 1,
      completed: 0,
      deadLettered: 1,
      leaseLost: 0,
      reaped: 0,
      retryable: 0,
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminProcessBillingCallbacksContract.path}`, {
        method: adminProcessBillingCallbacksContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({ batchSize: 5, failOnNonClean: false }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toMatchObject({
      success: true,
      attempted: 1,
      completed: 0,
      deadLettered: 1,
    })
  })

  it('rejects BYOK admin requests without the admin key', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminByokGetContract.path}?workspaceId=workspace-1`, {
        method: adminByokGetContract.method,
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
  })

  it('does not accept runtime keys on BYOK admin routes', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminByokGetContract.path}?workspaceId=workspace-1`, {
        method: adminByokGetContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
  })

  it('authenticates BYOK admin routes before parsing malformed JSON', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminByokPostContract.path}`, {
        method: adminByokPostContract.method,
        body: '{',
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
  })

  it('lists authenticated BYOK admin provider keys', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminByokGetContract.path}?workspaceId=workspace-1`, {
        method: adminByokGetContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
          'x-sim-source-env': 'dev',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toMatchObject({
      workspaceId: 'workspace-1',
      providers: [
        {
          provider: 'anthropic',
          configured: true,
          createdBy: 'admin-1',
        },
      ],
    })
    expect(mockListMothershipByokProviders).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
    })
  })

  it('upserts authenticated BYOK admin provider keys', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminByokPostContract.path}`, {
        method: adminByokPostContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({
          workspaceId: 'workspace-1',
          provider: 'anthropic',
          apiKey: 'secret',
          createdBy: 'user-1',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toMatchObject({
      success: true,
      workspaceId: 'workspace-1',
      provider: 'anthropic',
    })
    expect(mockUpsertMothershipByokProviderKey).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      provider: 'anthropic',
      apiKey: 'secret',
      encryptionKey: TEST_ENV.ENCRYPTION_KEY,
      createdBy: 'user-1',
    })
  })

  it('deletes authenticated BYOK admin provider keys', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(
        `http://mothership.local${adminByokDeleteContract.path}?workspaceId=workspace-1&provider=anthropic`,
        {
          method: adminByokDeleteContract.method,
          headers: {
            'x-mothership-admin-key': ADMIN_SECRET,
          },
        }
      )
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toMatchObject({
      success: true,
      workspaceId: 'workspace-1',
      provider: 'anthropic',
    })
    expect(mockDeleteMothershipByokProviderKeys).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      provider: 'anthropic',
    })
  })

  it('validates authenticated BYOK admin request bodies', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${adminByokPostContract.path}`, {
        method: adminByokPostContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({
          workspaceId: 'workspace-1',
          provider: '',
          apiKey: 'secret',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
  })

  it('requires provider when deleting BYOK admin provider keys', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(
        `http://mothership.local${adminByokDeleteContract.path}?workspaceId=workspace-1`,
        {
          method: adminByokDeleteContract.method,
          headers: {
            'x-mothership-admin-key': ADMIN_SECRET,
          },
        }
      )
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockDeleteMothershipByokProviderKeys).not.toHaveBeenCalled()
  })

  it('fails closed when BYOK encryption is not configured', async () => {
    const { ENCRYPTION_KEY: _encryptionKey, ...envWithoutEncryption } = TEST_ENV
    const handler = createMothershipHandler(envWithoutEncryption)
    const response = await handler(
      new Request(`http://mothership.local${adminByokPostContract.path}`, {
        method: adminByokPostContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({
          workspaceId: 'workspace-1',
          provider: 'anthropic',
          apiKey: 'secret',
        }),
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'encryption_not_configured',
    })
    expect(mockUpsertMothershipByokProviderKey).not.toHaveBeenCalled()
  })

  it('fails closed when BYOK admin auth is not configured', async () => {
    const { MOTHERSHIP_ADMIN_API_KEY: _adminKey, ...envWithoutAdmin } = TEST_ENV
    const handler = createMothershipHandler(envWithoutAdmin)
    const response = await handler(
      new Request(`http://mothership.local${adminByokGetContract.path}?workspaceId=workspace-1`, {
        method: adminByokGetContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
        },
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'service_auth_not_configured',
    })
  })

  it('authenticates validate-key routes before parsing malformed JSON', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${validateKeyGenerateContract.path}`, {
        method: validateKeyGenerateContract.method,
        body: '{',
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(mockGenerateMothershipApiKey).not.toHaveBeenCalled()
  })

  it('does not accept admin keys on validate-key runtime routes', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${validateKeyListContract.path}`, {
        method: validateKeyListContract.method,
        headers: {
          'x-mothership-admin-key': ADMIN_SECRET,
        },
        body: JSON.stringify({ userId: 'user-1' }),
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(mockListMothershipApiKeys).not.toHaveBeenCalled()
  })

  it('lists owned API keys without returning plaintext key material', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${validateKeyListContract.path}`, {
        method: validateKeyListContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({ userId: 'user-1' }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual([
      {
        id: 'api-key-1',
        name: 'Default',
        displayKey: 'sk-sim-...ated',
        createdAt: '2026-06-21T00:00:00.000Z',
        lastUsed: null,
      },
    ])
    expect(mockListMothershipApiKeys).toHaveBeenCalledWith({
      userId: 'user-1',
      apiEncryptionKey: TEST_ENV.API_ENCRYPTION_KEY,
    })
  })

  it('generates owned API keys with encrypted storage configured', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${validateKeyGenerateContract.path}`, {
        method: validateKeyGenerateContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({ userId: 'user-1', name: 'Default' }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual({
      id: 'api-key-1',
      apiKey: 'sk-sim-generated',
    })
    expect(mockGenerateMothershipApiKey).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Default',
      apiEncryptionKey: TEST_ENV.API_ENCRYPTION_KEY,
    })
  })

  it('fails closed when API key encryption is not configured', async () => {
    const { API_ENCRYPTION_KEY: _apiEncryptionKey, ...envWithoutApiEncryption } = TEST_ENV
    const handler = createMothershipHandler(envWithoutApiEncryption)
    const response = await handler(
      new Request(`http://mothership.local${validateKeyGenerateContract.path}`, {
        method: validateKeyGenerateContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({ userId: 'user-1', name: 'Default' }),
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'api_encryption_not_configured',
    })
    expect(mockGenerateMothershipApiKey).not.toHaveBeenCalled()
  })

  it('deletes owned API keys scoped to the requesting user', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${validateKeyDeleteContract.path}`, {
        method: validateKeyDeleteContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({ userId: 'user-1', apiKeyId: 'api-key-1' }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual({ success: true })
    expect(mockDeleteMothershipApiKey).toHaveBeenCalledWith({
      userId: 'user-1',
      apiKeyId: 'api-key-1',
    })
  })

  it('returns not found when deleting an API key misses the owned store', async () => {
    mockDeleteMothershipApiKey.mockResolvedValueOnce({ deleted: false })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${validateKeyDeleteContract.path}`, {
        method: validateKeyDeleteContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({ userId: 'user-1', apiKeyId: 'api-key-missing' }),
      })
    )

    expect(response.status).toBe(404)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'api_key_not_found',
    })
  })

  it('rejects available-model requests without runtime auth', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(new Request('http://mothership.local/api/get-available-models'))

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
  })

  it('fails closed when the available-model catalog is not configured', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request('http://mothership.local/api/get-available-models', {
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      success: false,
      error: 'Mothership model catalog is not configured',
      models: [],
    })
  })

  it('returns configured available models', async () => {
    const env: MothershipEnv = {
      ...TEST_ENV,
      MOTHERSHIP_AVAILABLE_MODELS_JSON: JSON.stringify([
        {
          id: 'anthropic/claude-opus-4-8',
          friendlyName: 'Claude Opus 4.8',
          provider: 'anthropic',
          leaked: 'do-not-return',
        },
      ]),
    }
    const handler = createMothershipHandler(env)
    const response = await handler(
      new Request('http://mothership.local/api/get-available-models', {
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-models-1',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-models-1')
    expect(await readJson(response)).toEqual({
      success: true,
      models: [
        {
          id: 'anthropic/claude-opus-4-8',
          friendlyName: 'Claude Opus 4.8',
          provider: 'anthropic',
        },
      ],
    })
  })

  it('authenticates title generation before parsing malformed JSON', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${generateChatTitleContract.path}`, {
        method: generateChatTitleContract.method,
        body: '{',
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects invalid title generation bodies before calling the provider', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${generateChatTitleContract.path}`, {
        method: generateChatTitleContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: '',
          model: 'claude-opus-4-8',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails title generation closed when Anthropic credentials are missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${generateChatTitleContract.path}`, {
        method: generateChatTitleContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'Explain the durable Mothership stream replay plan',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
          userId: 'user-1',
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'owned_provider_credentials_missing',
      error: 'Mothership Anthropic credentials are not configured',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails title generation closed with provider-specific CliProxyAPI credentials errors', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_DEFAULT_PROVIDER: 'cliproxyapi',
    })
    const response = await handler(
      new Request(`http://mothership.local${generateChatTitleContract.path}`, {
        method: generateChatTitleContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'Explain the durable Mothership stream replay plan',
          userId: 'user-1',
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'owned_provider_credentials_missing',
      error: 'Mothership CliProxyAPI credentials are not configured',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('generates owned chat titles through Anthropic without leaking provider body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        content: [{ type: 'text', text: '"Durable Stream Replay"' }],
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })
    const response = await handler(
      new Request(`http://mothership.local${generateChatTitleContract.path}`, {
        method: generateChatTitleContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-title-1',
        },
        body: JSON.stringify({
          message: 'Explain the durable Mothership stream replay plan',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
          userId: 'user-1',
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-title-1')
    expect(await readJson(response)).toEqual({ title: 'Durable Stream Replay' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestInit = fetchMock.mock.calls[0]![1] as RequestInit
    expect((requestInit.headers as Record<string, string>)['x-api-key']).toBe('anthropic-secret')
    const requestBody = JSON.parse(requestInit.body as string)
    expect(requestBody).toMatchObject({
      model: 'claude-opus-4-8',
      stream: false,
      max_tokens: 64,
    })
    expect(requestBody.messages[0].content).toContain(
      'Explain the durable Mothership stream replay plan'
    )
  })

  it('generates owned chat titles through CliProxyAPI defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { role: 'assistant', content: '"Proxy Title"' } }],
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_DEFAULT_PROVIDER: 'cliproxyapi',
      MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
      MOTHERSHIP_CLIPROXY_BASE_URL: 'http://localhost:8317',
    })
    const response = await handler(
      new Request(`http://mothership.local${generateChatTitleContract.path}`, {
        method: generateChatTitleContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'Explain the durable Mothership stream replay plan',
          userId: 'user-1',
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readJson(response)).toEqual({ title: 'Proxy Title' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8317/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer proxy-secret',
        }),
      })
    )
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody).toMatchObject({
      model: 'gpt-5.5',
      stream: false,
      max_completion_tokens: 64,
      reasoning_effort: 'high',
    })
    expect(requestBody.messages[0].content).toContain(
      'Explain the durable Mothership stream replay plan'
    )
  })

  it('acknowledges owned chat forks after validating both chat ids', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${forkChatContract.path}`, {
        method: forkChatContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-fork-1',
        },
        body: JSON.stringify({
          sourceChatId: 'source-chat-1',
          newChatId: 'new-chat-1',
          upToMessageId: 'message-1',
          userId: 'user-1',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-fork-1')
    expect(await readJson(response)).toEqual({
      success: true,
      copied: false,
      sourceChatId: 'source-chat-1',
      newChatId: 'new-chat-1',
    })
    expect(mockAcknowledgeMothershipChatFork).toHaveBeenCalledWith({
      sourceChatId: 'source-chat-1',
      newChatId: 'new-chat-1',
      userId: 'user-1',
    })
  })

  it('rejects invalid owned chat fork bodies before touching state', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${forkChatContract.path}`, {
        method: forkChatContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          sourceChatId: 'source-chat-1',
          userId: 'user-1',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockAcknowledgeMothershipChatFork).not.toHaveBeenCalled()
  })

  it('returns not found when owned chat fork cannot verify the source chat', async () => {
    mockAcknowledgeMothershipChatFork.mockResolvedValueOnce({ status: 'source_missing' })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${forkChatContract.path}`, {
        method: forkChatContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          sourceChatId: 'source-chat-1',
          newChatId: 'new-chat-1',
          userId: 'user-1',
        }),
      })
    )

    expect(response.status).toBe(404)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'source_chat_not_found',
    })
  })

  it('returns not found when owned chat fork cannot verify the new chat', async () => {
    mockAcknowledgeMothershipChatFork.mockResolvedValueOnce({ status: 'new_missing' })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${forkChatContract.path}`, {
        method: forkChatContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          sourceChatId: 'source-chat-1',
          newChatId: 'new-chat-1',
          userId: 'user-1',
        }),
      })
    )

    expect(response.status).toBe(404)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'new_chat_not_found',
    })
  })

  it('authenticates stream replay before parsing invalid query params', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${streamReplayContract.path}?streamId=&userId=user-1`, {
        method: streamReplayContract.method,
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(mockGetMothershipRunByStream).not.toHaveBeenCalled()
    expect(mockReadMothershipRunEvents).not.toHaveBeenCalled()
  })

  it('rejects invalid stream replay cursors without touching durable event state', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(
        `http://mothership.local${streamReplayContract.path}?streamId=stream-1&userId=user-1&after=abc`,
        {
          method: streamReplayContract.method,
          headers: {
            'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          },
        }
      )
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_cursor',
    })
    expect(mockReadMothershipRunEvents).not.toHaveBeenCalled()
  })

  it('does not replay events for streams outside the requested user', async () => {
    mockGetMothershipRunByStream.mockResolvedValueOnce(null)
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(
        `http://mothership.local${streamReplayContract.path}?streamId=stream-1&userId=user-1&after=2&batch=true`,
        {
          method: streamReplayContract.method,
          headers: {
            'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          },
        }
      )
    )

    expect(response.status).toBe(404)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'stream_not_found',
    })
    expect(mockGetMothershipRunByStream).toHaveBeenCalledWith({
      streamId: 'stream-1',
      userId: 'user-1',
    })
    expect(mockReadMothershipRunEvents).not.toHaveBeenCalled()
  })

  it('returns durable stream replay batches after the requested cursor', async () => {
    mockGetMothershipRunByStream.mockResolvedValueOnce({
      id: RUNTIME_RUN_ID,
      executionId: 'exec-1',
      chatId: RUNTIME_CHAT_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'error',
      completedAt: new Date('2026-06-20T00:00:00.000Z'),
      error: 'owned_provider_continuation_not_implemented',
    })
    const envelope = {
      v: 1 as const,
      seq: 3,
      ts: '2026-06-20T00:00:00.000Z',
      type: 'error',
      stream: { streamId: 'stream-1', cursor: '3' },
      trace: { requestId: 'req-original' },
      payload: {
        code: 'owned_provider_continuation_not_implemented',
        message: 'Owned Mothership provider continuation is not implemented yet.',
      },
    }
    mockReadMothershipRunEvents.mockResolvedValueOnce([
      {
        id: 'event-1',
        runId: RUNTIME_RUN_ID,
        streamId: 'stream-1',
        seq: 3,
        cursor: '3',
        eventType: 'error',
        requestId: 'req-original',
        envelope,
        createdAt: new Date('2026-06-20T00:00:00.000Z'),
      },
    ])
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(
        `http://mothership.local${streamReplayContract.path}?streamId=stream-1&userId=user-1&after=2&batch=true&limit=50`,
        {
          method: streamReplayContract.method,
          headers: {
            'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
            'x-request-id': 'req-replay-1',
          },
        }
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-replay-1')
    expect(mockReadMothershipRunEvents).toHaveBeenCalledWith({
      streamId: 'stream-1',
      afterSeq: 2,
      limit: 50,
    })
    expect(await readJson(response)).toEqual({
      success: true,
      status: 'error',
      chatId: RUNTIME_CHAT_ID,
      events: [
        {
          eventId: 3,
          streamId: 'stream-1',
          event: envelope,
        },
      ],
    })
  })

  it('streams durable replay events as SSE frames', async () => {
    mockGetMothershipRunByStream.mockResolvedValueOnce({
      id: RUNTIME_RUN_ID,
      executionId: 'exec-1',
      chatId: RUNTIME_CHAT_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'error',
      completedAt: new Date('2026-06-20T00:00:00.000Z'),
      error: 'owned_provider_continuation_not_implemented',
    })
    const envelope = {
      v: 1 as const,
      seq: 4,
      ts: '2026-06-20T00:00:01.000Z',
      type: 'error',
      stream: { streamId: 'stream-1', cursor: '4' },
      trace: { requestId: 'req-original' },
      payload: {
        code: 'owned_provider_continuation_not_implemented',
        message: 'Owned Mothership provider continuation is not implemented yet.',
      },
    }
    mockReadMothershipRunEvents.mockResolvedValueOnce([
      {
        id: 'event-1',
        runId: RUNTIME_RUN_ID,
        streamId: 'stream-1',
        seq: 4,
        cursor: '4',
        eventType: 'error',
        requestId: 'req-original',
        envelope,
        createdAt: new Date('2026-06-20T00:00:01.000Z'),
      },
    ])
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(
        `http://mothership.local${streamReplayContract.path}?streamId=stream-1&userId=user-1&after=3`,
        {
          method: streamReplayContract.method,
          headers: {
            'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
            'x-request-id': 'req-replay-sse-1',
          },
        }
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('x-request-id')).toBe('req-replay-sse-1')
    expect(await readSseData(response)).toEqual([envelope])
  })

  it('authenticates runtime streams before parsing malformed JSON', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        body: '{',
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(mockClaimMothershipRuntimeRun).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
  })

  it('rejects invalid runtime stream bodies without touching state', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: '',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockClaimMothershipRuntimeRun).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
  })

  it('requires durable run identity at the runtime contract boundary', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockClaimMothershipRuntimeRun).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
  })

  it('requires workspaceId at the runtime contract boundary before API-key validation', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockClaimMothershipRuntimeRun).not.toHaveBeenCalled()
  })

  it('rejects blank workspaceId at the runtime contract boundary before API-key validation', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: '   ',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockClaimMothershipRuntimeRun).not.toHaveBeenCalled()
  })

  it('rejects blank parentRunId at the runtime contract boundary before API-key validation', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          parentRunId: '   ',
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockClaimMothershipRuntimeRun).not.toHaveBeenCalled()
  })

  it('rejects API-key entitlement failures before claiming a runtime run', async () => {
    mockValidateMothershipApiKeyEntitlement.mockResolvedValueOnce({
      status: 'rejected',
      statusCode: 402,
      body: null,
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-entitlement-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(402)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'api_key_validation_failed',
      status: 402,
    })
    expect(mockValidateMothershipApiKeyEntitlement).toHaveBeenCalledWith({
      env: TEST_ENV,
      userId: 'user-1',
      workspaceId: 'workspace-1',
      signal: expect.any(AbortSignal),
    })
    expect(mockClaimMothershipRuntimeRun).not.toHaveBeenCalled()
    expect(mockAppendMothershipRunEvents).not.toHaveBeenCalled()
  })

  it('fails closed when API-key callback validation is not configured', async () => {
    mockValidateMothershipApiKeyEntitlement.mockResolvedValueOnce({
      status: 'misconfigured',
      missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY',
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'sim_callback_not_configured',
      missing: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY',
    })
    expect(mockClaimMothershipRuntimeRun).not.toHaveBeenCalled()
  })

  it('rejects owned runtime stream conflicts before writing events', async () => {
    mockClaimMothershipRuntimeRun.mockResolvedValueOnce({
      status: 'stream_conflict',
      run: {
        id: 'run-other',
        executionId: 'exec-other',
        chatId: 'chat-other',
        streamId: 'stream-1',
        userId: 'user-other',
        status: 'active',
        completedAt: null,
        error: null,
      },
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'stream_conflict',
    })
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    expect(mockAppendMothershipRunEvents).not.toHaveBeenCalled()
  })

  it('rejects owned runtime run identity conflicts before writing events', async () => {
    mockClaimMothershipRuntimeRun.mockResolvedValueOnce({
      status: 'run_identity_conflict',
      run: {
        id: 'run-existing',
        executionId: 'exec-existing',
        chatId: RUNTIME_CHAT_ID,
        streamId: 'stream-1',
        userId: 'user-1',
        status: 'active',
        completedAt: null,
        error: null,
      },
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'run_identity_conflict',
    })
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    expect(mockAppendMothershipRunEvents).not.toHaveBeenCalled()
  })

  it('rejects terminal owned runtime streams before opening an SSE body', async () => {
    mockClaimMothershipRuntimeRun.mockResolvedValueOnce({
      status: 'run_terminal',
      run: {
        id: RUNTIME_RUN_ID,
        executionId: 'exec-1',
        chatId: RUNTIME_CHAT_ID,
        streamId: 'stream-1',
        userId: 'user-1',
        status: 'complete',
        completedAt: new Date('2026-06-20T00:00:00.000Z'),
        error: null,
      },
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(response.headers.get('content-type')).not.toBe('text/event-stream')
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'stream_not_resumable',
      status: 'complete',
    })
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    expect(mockAppendMothershipRunEvents).not.toHaveBeenCalled()
  })

  it('returns an explicit credential error for owned Anthropic streams without service credentials', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-runtime-1',
          'x-sim-source-env': 'dev',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          parentRunId: RUNTIME_PARENT_RUN_ID,
          workflowId: 'workflow-1',
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('x-request-id')).toBe('req-runtime-1')
    expect(mockClaimMothershipRuntimeRun).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      executionId: 'exec-1',
      parentRunId: RUNTIME_PARENT_RUN_ID,
      chatId: RUNTIME_CHAT_ID,
      userId: 'user-1',
      workflowId: 'workflow-1',
      workspaceId: 'workspace-1',
      streamId: 'stream-1',
      model: 'claude-opus-4-8',
      provider: 'anthropic',
      requestContext: {
        requestId: 'req-runtime-1',
        route: '/api/copilot',
        authFamily: 'runtime',
        authFingerprint: expect.any(String),
        sourceEnv: 'dev',
      },
    })

    const events = await readSseData(response)
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_credentials_missing',
    })
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[0]!).toBeLessThan(
      mockMarkMothershipRunFailed.mock.invocationCallOrder[0]!
    )
    expect(mockAppendMothershipRunEvents).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      events: [expect.objectContaining({ seq: 1, type: 'error' })],
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 1,
      type: 'error',
      stream: { streamId: 'stream-1', cursor: '1' },
      trace: { requestId: 'req-runtime-1' },
      payload: {
        code: 'owned_provider_credentials_missing',
        message: 'Mothership Anthropic credentials are not configured.',
        provider: 'anthropic',
        data: {
          route: '/api/copilot',
          model: 'claude-opus-4-8',
        },
      },
    })
  })

  it('streams Anthropic text through owned durable runtime envelopes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":3}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}',
          'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":4}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-anthropic-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 1,
      type: 'text',
      stream: { streamId: 'stream-1', cursor: '1' },
      trace: { requestId: 'req-anthropic-1' },
      payload: { channel: 'assistant', text: 'Hello' },
    })
    expect(events[1]).toMatchObject({
      seq: 2,
      type: 'text',
      payload: { channel: 'assistant', text: ' world' },
    })
    expect(events[2]).toMatchObject({
      seq: 3,
      type: 'complete',
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 3,
          output_tokens: 4,
          total_tokens: 7,
          model: 'claude-opus-4-8',
        },
        cost: {
          input: 0.000015,
          output: 0.0001,
          total: 0.000115,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
        MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'claude-opus-4-8',
      inputTokens: 3,
      outputTokens: 4,
      cost: 0.000115,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:anthropic',
    })
    expect(mockReportMothershipBillingUsage.mock.invocationCallOrder[0]!).toBeLessThan(
      mockAppendMothershipRunEvents.mock.invocationCallOrder[2]!
    )
    expect(mockMarkMothershipRunComplete).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[2]!).toBeLessThan(
      mockMarkMothershipRunComplete.mock.invocationCallOrder[0]!
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          'x-api-key': 'anthropic-secret',
          'anthropic-version': '2023-06-01',
        }),
      })
    )
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody).toMatchObject({
      model: 'claude-opus-4-8',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }],
    })
  })

  it('times out owned provider requests and publishes a terminal error', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal
      return new Promise<Response>((_resolve, reject) => {
        const rejectAbort = () => {
          reject(signal?.reason instanceof Error ? signal.reason : new Error('provider aborted'))
        }
        if (signal?.aborted) {
          rejectAbort()
          return
        }
        signal?.addEventListener('abort', rejectAbort, { once: true })
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
      MOTHERSHIP_PROVIDER_REQUEST_TIMEOUT_MS: 1,
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-provider-timeout-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'error',
      trace: { requestId: 'req-provider-timeout-1' },
      payload: {
        code: 'owned_provider_error',
        message: 'Owned Mothership provider request timed out after 1ms',
      },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_error',
    })
  })

  it('includes Anthropic cache usage in owned hosted billing cost', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10,"cache_creation_input_tokens":40,"cache_read_input_tokens":50}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Cached hello"}}',
          'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":15}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events.at(-1)).toMatchObject({
      type: 'complete',
      payload: {
        usage: {
          input_tokens: 10,
          output_tokens: 15,
          total_tokens: 25,
          model: 'claude-opus-4-8',
        },
        cost: {
          input: 0.000325,
          output: 0.000375,
          total: 0.0007,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-8',
        inputTokens: 10,
        outputTokens: 15,
        cost: 0.0007,
      })
    )
  })

  it('returns an explicit credential error for owned OpenAI streams without service credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-missing-credentials-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
          provider: 'openai',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'error',
      payload: {
        code: 'owned_provider_credentials_missing',
        message: 'Mothership OpenAI credentials are not configured.',
        provider: 'openai',
        data: {
          route: '/api/copilot',
          model: 'gpt-4.1',
        },
      },
    })
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_credentials_missing',
    })
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[0]!).toBeLessThan(
      mockMarkMothershipRunFailed.mock.invocationCallOrder[0]!
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('streams OpenAI Responses text through owned durable runtime envelopes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}',
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":" world"}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":3,"output_tokens":4,"total_tokens":7}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
          provider: 'openai',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 1,
      type: 'text',
      stream: { streamId: 'stream-1', cursor: '1' },
      trace: { requestId: 'req-openai-1' },
      payload: { channel: 'assistant', text: 'Hello' },
    })
    expect(events[1]).toMatchObject({
      seq: 2,
      type: 'text',
      payload: { channel: 'assistant', text: ' world' },
    })
    expect(events[2]).toMatchObject({
      seq: 3,
      type: 'complete',
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 3,
          output_tokens: 4,
          total_tokens: 7,
          model: 'gpt-4.1',
        },
        cost: {
          input: 0.000006,
          output: 0.000032,
          total: 0.000038,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
        MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'gpt-4.1',
      inputTokens: 3,
      outputTokens: 4,
      cost: 0.000038,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
    })
    expect(mockReportMothershipBillingUsage.mock.invocationCallOrder[0]!).toBeLessThan(
      mockAppendMothershipRunEvents.mock.invocationCallOrder[2]!
    )
    expect(mockMarkMothershipRunComplete).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[2]!).toBeLessThan(
      mockMarkMothershipRunComplete.mock.invocationCallOrder[0]!
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer openai-secret',
          'content-type': 'application/json',
          'OpenAI-Beta': 'responses=v1',
        }),
      })
    )
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody).toMatchObject({
      model: 'gpt-4.1',
      stream: true,
      input: [{ role: 'user', content: 'hello' }],
    })
  })

  it('streams CliProxyAPI chat completions through owned durable runtime envelopes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse(
          [
            'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"Proxy"},"finish_reason":null}]}',
            'data: {"choices":[{"index":0,"delta":{"content":" answer"},"finish_reason":null}]}',
            'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"prompt_tokens_details":{"cached_tokens":40},"completion_tokens":10,"completion_tokens_details":{"reasoning_tokens":4},"total_tokens":110}}',
            'data: [DONE]',
          ],
          '\r\n\r\n'
        )
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
      MOTHERSHIP_CLIPROXY_BASE_URL: 'http://localhost:8317/v1',
      MOTHERSHIP_CLIPROXY_MAX_COMPLETION_TOKENS: 1234,
      MOTHERSHIP_CLIPROXY_REASONING_EFFORT: 'high',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-cliproxy-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-5.5',
          provider: 'cliproxyapi',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 1,
      type: 'text',
      stream: { streamId: 'stream-1', cursor: '1' },
      trace: { requestId: 'req-cliproxy-1' },
      payload: { channel: 'assistant', text: 'Proxy' },
    })
    expect(events[1]).toMatchObject({
      seq: 2,
      type: 'text',
      payload: { channel: 'assistant', text: ' answer' },
    })
    expect(events[2]).toMatchObject({
      seq: 3,
      type: 'complete',
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 100,
          output_tokens: 10,
          total_tokens: 110,
          model: 'gpt-5.5',
        },
        cost: {
          input: 0.00032,
          output: 0.0003,
          total: 0.00062,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
        MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'gpt-5.5',
      inputTokens: 100,
      outputTokens: 10,
      cost: 0.00062,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:cliproxyapi',
    })
    expect(mockMarkMothershipRunComplete).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8317/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer proxy-secret',
          'content-type': 'application/json',
        }),
      })
    )
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody).toMatchObject({
      model: 'gpt-5.5',
      stream: true,
      max_completion_tokens: 1234,
      stream_options: { include_usage: true },
      reasoning_effort: 'high',
      messages: [{ role: 'user', content: 'hello' }],
    })
  })

  it('routes omitted provider and model through configured CliProxyAPI defaults', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"Default proxy"},"finish_reason":null}]}',
          'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1}}',
          'data: [DONE]',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_DEFAULT_PROVIDER: 'cliproxyapi',
      MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events.at(-1)).toMatchObject({
      type: 'complete',
      payload: {
        usage: {
          model: 'gpt-5.5',
        },
      },
    })
    expect(mockClaimMothershipRuntimeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.5',
        provider: 'cliproxyapi',
      })
    )
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody).toMatchObject({
      model: 'gpt-5.5',
      max_completion_tokens: 4096,
      reasoning_effort: 'high',
    })
  })

  it('fails CliProxyAPI completion closed when billable usage is missing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'data: {"choices":[{"index":0,"delta":{"content":"Proxy answer"},"finish_reason":null}]}',
          'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
          'data: [DONE]',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-5.5',
          provider: 'cliproxyapi',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      payload: expect.objectContaining({
        code: 'owned_provider_usage_missing',
        provider: 'cliproxyapi',
      }),
    })
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_usage_missing',
    })
  })

  it('fails CliProxyAPI completion closed when usage only includes total tokens', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"total_tokens":12}}',
          'data: [DONE]',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-5.5',
          provider: 'cliproxyapi',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readSseData(response)).toEqual([
      expect.objectContaining({
        type: 'error',
        payload: expect.objectContaining({
          code: 'owned_provider_usage_missing',
          provider: 'cliproxyapi',
        }),
      }),
    ])
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
  })

  it('fails CliProxyAPI tool requests closed until chat-completions tool resume is implemented', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-5.5',
          provider: 'cliproxyapi',
          mothershipTools: [
            {
              name: 'read_workflow',
              input_schema: { type: 'object', properties: {} },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readSseData(response)).toEqual([
      expect.objectContaining({
        type: 'error',
        payload: expect.objectContaining({
          code: 'owned_provider_tools_not_supported',
          provider: 'cliproxyapi',
          data: {
            route: '/api/copilot',
            model: 'gpt-5.5',
          },
        }),
      }),
    ])
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_tools_not_supported',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails CliProxyAPI unparseable tool requests closed instead of silently dropping tools', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-5.5',
          provider: 'cliproxyapi',
          integrationTools: [{ unsupported: true }],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await readSseData(response)).toEqual([
      expect.objectContaining({
        type: 'error',
        payload: expect.objectContaining({
          code: 'owned_provider_tools_not_supported',
          provider: 'cliproxyapi',
        }),
      }),
    ])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sanitizes CliProxyAPI provider error details before streaming them to clients', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse(['data: {"error":{"message":"stack trace sk-secret-leak"}}'])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-5.5',
          provider: 'cliproxyapi',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toEqual([
      expect.objectContaining({
        type: 'error',
        payload: expect.objectContaining({
          code: 'owned_provider_error',
          message: 'Owned Mothership CliProxyAPI provider request failed.',
          displayMessage: 'Owned Mothership CliProxyAPI provider request failed.',
        }),
      }),
    ])
    expect(JSON.stringify(events)).not.toContain('sk-secret-leak')
  })

  it('routes supported OpenAI-shaped models through OpenAI even when the provider hint is stale', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"OpenAI answer"}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-stale-provider-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
          provider: 'anthropic',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events.at(-1)).toMatchObject({
      type: 'complete',
      payload: {
        usage: {
          model: 'gpt-4.1',
        },
      },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer openai-secret',
        }),
      })
    )
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4.1',
        idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
      })
    )
  })

  it('applies OpenAI cached-input pricing when usage reports cached tokens', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Cached context used."}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":100,"input_tokens_details":{"cached_tokens":40},"output_tokens":10,"total_tokens":110}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-5.4',
          provider: 'openai',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events.at(-1)).toMatchObject({
      type: 'complete',
      payload: {
        usage: {
          input_tokens: 100,
          output_tokens: 10,
          total_tokens: 110,
          model: 'gpt-5.4',
        },
        cost: {
          input: 0.00016,
          output: 0.00015,
          total: 0.00031,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4',
        inputTokens: 100,
        outputTokens: 10,
        cost: 0.00031,
        idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
      })
    )
  })

  it('uses route billing source and OpenAI idempotency key for workspace chat streams', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hi"}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":6,"total_tokens":11}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${mothershipRuntimeContract.path}`, {
        method: mothershipRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
        }),
      })
    )

    expect(response.status).toBe(200)
    await readSseData(response)
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'workspace-chat',
        idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
      })
    )
  })

  it('returns an OpenAI provider error terminal when the Responses stream fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.failed\ndata: {"type":"response.failed","error":{"message":"upstream failed"}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
          provider: 'openai',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'error',
      payload: {
        code: 'owned_provider_error',
        message: 'upstream failed',
        provider: 'openai',
      },
    })
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_error',
    })
  })

  it('fails closed before billing when an OpenAI function-call item is malformed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_item.done\ndata: {"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call-1","arguments":"{}"}}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":8,"total_tokens":13},"output":[{"type":"function_call","call_id":"call-1","arguments":"{}"}]}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
          provider: 'openai',
          integrationTools: [
            {
              name: 'read_workflow',
              input_schema: {
                type: 'object',
                properties: { workflowId: { type: 'string' } },
                required: ['workflowId'],
              },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'error',
      payload: {
        code: 'owned_provider_error',
        message: 'OpenAI function_call output item is missing call_id or name',
        provider: 'openai',
      },
    })
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(mockCreateMothershipToolCheckpoint).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunPausedForTool).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_error',
    })
  })

  it('persists OpenAI Responses function calls as a durable checkpoint pause', async () => {
    mockCreateMothershipToolCheckpoint.mockResolvedValueOnce({
      status: 'ready',
      checkpointId: 'checkpoint-1',
      pendingToolCallIds: ['call-1'],
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"I will check."}',
          'event: response.output_item.done\ndata: {"type":"response.output_item.done","output_index":1,"item":{"type":"function_call","call_id":"call-1","name":"read_workflow","arguments":"{\\"workflowId\\":\\"workflow-1\\"}"}}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":8,"total_tokens":13},"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"I will check."}]},{"type":"function_call","call_id":"call-1","name":"read_workflow","arguments":"{\\"workflowId\\":\\"workflow-1\\"}"}]}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
          provider: 'openai',
          integrationTools: [
            {
              name: 'read_workflow',
              description: 'Read a workflow',
              input_schema: {
                type: 'object',
                properties: { workflowId: { type: 'string' } },
                required: ['workflowId'],
              },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      seq: 1,
      type: 'text',
      payload: { channel: 'assistant', text: 'I will check.' },
    })
    expect(events[1]).toMatchObject({
      seq: 2,
      type: 'tool',
      payload: {
        phase: 'call',
        toolCallId: 'call-1',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        arguments: { workflowId: 'workflow-1' },
        status: 'executing',
      },
    })
    expect(events[2]).toMatchObject({
      seq: 3,
      type: 'run',
      payload: {
        kind: 'checkpoint_pause',
        checkpointId: 'checkpoint-1',
        executionId: 'exec-1',
        runId: RUNTIME_RUN_ID,
        pendingToolCallIds: ['call-1'],
      },
    })
    expect(mockCreateMothershipToolCheckpoint).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      pendingToolCalls: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          args: { workflowId: 'workflow-1' },
        },
      ],
      conversationSnapshot: {
        input: [{ role: 'user', content: 'hello' }],
        outputItems: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'I will check.' }],
          },
          {
            type: 'function_call',
            call_id: 'call-1',
            name: 'read_workflow',
            arguments: '{"workflowId":"workflow-1"}',
          },
        ],
      },
      agentState: {
        provider: 'openai',
        stopReason: 'tool_call',
      },
      providerRequest: {
        provider: 'openai',
        model: 'gpt-4.1',
        executionId: 'exec-1',
        request: {
          model: 'gpt-4.1',
          stream: true,
          input: [{ role: 'user', content: 'hello' }],
          tools: [
            {
              type: 'function',
              name: 'read_workflow',
              description: 'Read a workflow',
              parameters: {
                type: 'object',
                properties: { workflowId: { type: 'string' } },
                required: ['workflowId'],
              },
            },
          ],
        },
        outputItems: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'I will check.' }],
          },
          {
            type: 'function_call',
            call_id: 'call-1',
            name: 'read_workflow',
            arguments: '{"workflowId":"workflow-1"}',
          },
        ],
        billing: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          source: 'copilot',
          cumulativeUsage: {
            input_tokens: 5,
            output_tokens: 8,
          },
        },
        workflowSubagentContext: {
          chatId: RUNTIME_CHAT_ID,
          message: 'hello',
          messageId: 'stream-1',
          userId: 'user-1',
          workspaceId: 'workspace-1',
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'gpt-4.1',
      inputTokens: 5,
      outputTokens: 8,
      cost: 0.000074,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
    })
    expect(mockReportMothershipBillingUsage.mock.invocationCallOrder[0]!).toBeLessThan(
      mockCreateMothershipToolCheckpoint.mock.invocationCallOrder[0]!
    )
    expect(mockMarkMothershipRunPausedForTool).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[2]!).toBeLessThan(
      mockMarkMothershipRunPausedForTool.mock.invocationCallOrder[0]!
    )
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody).toMatchObject({
      model: 'gpt-4.1',
      stream: true,
      input: [{ role: 'user', content: 'hello' }],
      tools: [
        {
          type: 'function',
          name: 'read_workflow',
          description: 'Read a workflow',
          parameters: {
            type: 'object',
            properties: { workflowId: { type: 'string' } },
            required: ['workflowId'],
          },
        },
      ],
    })
  })

  it('continues OpenAI Responses after a completed workflow subagent callback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        openAISseResponse([
          'event: response.output_item.done\ndata: {"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call-1","name":"workflow","arguments":"{\\"prompt\\":\\"inspect this workflow\\"}"}}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":8,"total_tokens":13},"output":[{"type":"function_call","call_id":"call-1","name":"workflow","arguments":"{\\"prompt\\":\\"inspect this workflow\\"}"}]}}',
        ])
      )
      .mockResolvedValueOnce(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Workflow fixed."}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":7,"output_tokens":9,"total_tokens":16}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockExecuteWorkflowSubagentCallback.mockResolvedValue({
      status: 'ok',
      response: {
        success: true,
        result: {
          status: 'completed',
          summary: 'Updated the workflow.',
          changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
          artifacts: [],
        },
        streamEvents: [
          {
            v: 1,
            seq: 99,
            ts: '2026-06-21T00:00:00.000Z',
            stream: { streamId: 'child-stream', cursor: '99' },
            scope: {
              lane: 'subagent',
              agentId: 'workflow',
              parentToolCallId: 'call-1',
              spanId: 'child-span-1',
            },
            type: 'text',
            payload: { channel: 'assistant', text: 'Inspecting workflow.' },
          },
        ],
      },
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-subagent-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          workflowId: 'workflow-1',
          workflowName: 'Support workflow',
          model: 'gpt-4.1',
          provider: 'openai',
          integrationTools: [
            {
              name: 'workflow',
              description: 'Run the workflow subagent',
              input_schema: {
                type: 'object',
                properties: { prompt: { type: 'string' } },
              },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(5)
    expect(events[0]).toMatchObject({
      type: 'tool',
      trace: { requestId: 'req-openai-subagent-1' },
      payload: {
        phase: 'call',
        toolCallId: 'call-1',
        toolName: 'workflow',
        executor: 'go',
        mode: 'async',
        arguments: { prompt: 'inspect this workflow' },
        status: 'executing',
        ui: { internal: true },
      },
    })
    expect(events[1]).toMatchObject({
      type: 'text',
      seq: 2,
      stream: { streamId: 'stream-1', cursor: '2' },
      trace: { requestId: 'req-openai-subagent-1' },
      scope: {
        lane: 'subagent',
        agentId: 'workflow',
        parentToolCallId: 'call-1',
        spanId: 'child-span-1',
      },
      payload: { channel: 'assistant', text: 'Inspecting workflow.' },
    })
    expect(events[1]).toMatchObject({
      type: 'text',
    })
    expect(events[2]).toMatchObject({
      type: 'tool',
      trace: { requestId: 'req-openai-subagent-1' },
      payload: {
        phase: 'result',
        toolCallId: 'call-1',
        toolName: 'workflow',
        executor: 'go',
        success: true,
        status: 'success',
      },
    })
    expect(events[3]).toMatchObject({
      type: 'text',
      payload: { channel: 'assistant', text: 'Workflow fixed.' },
    })
    expect(events[4]).toMatchObject({
      type: 'complete',
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 12,
          output_tokens: 17,
          total_tokens: 29,
          model: 'gpt-4.1',
        },
      },
    })
    expect(mockExecuteWorkflowSubagentCallback).toHaveBeenCalledWith({
      env: expect.objectContaining({ SIM_BASE_URL: 'http://sim.local' }),
      request: {
        runId: RUNTIME_RUN_ID,
        streamId: 'stream-1',
        chatId: RUNTIME_CHAT_ID,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        parentToolCallId: 'call-1',
        model: 'gpt-4.1',
        provider: 'openai',
        depth: 0,
        input: {
          prompt: 'inspect this workflow',
          workflowId: 'workflow-1',
        },
        context: {
          messages: [{ role: 'user', content: 'hello' }],
          resources: [{ type: 'workflow', id: 'workflow-1', title: 'Support workflow' }],
          workflowId: 'workflow-1',
        },
        limits: {
          maxDepth: 1,
          maxProviderRounds: 8,
          maxChildToolCalls: 30,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenNthCalledWith(1, {
      env: expect.objectContaining({ SIM_BASE_URL: 'http://sim.local' }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'gpt-4.1',
      inputTokens: 5,
      outputTokens: 8,
      cost: 0.000074,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenNthCalledWith(2, {
      env: expect.objectContaining({ SIM_BASE_URL: 'http://sim.local' }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'gpt-4.1',
      inputTokens: 12,
      outputTokens: 17,
      cost: 0.00016,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
    })
    expect(mockCreateMothershipToolCheckpoint).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunPausedForTool).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunComplete).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondRequestBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string)
    expect(secondRequestBody.input).toEqual([
      { role: 'user', content: 'hello' },
      {
        type: 'function_call',
        call_id: 'call-1',
        name: 'workflow',
        arguments: '{"prompt":"inspect this workflow"}',
      },
      {
        type: 'function_call_output',
        call_id: 'call-1',
        output: JSON.stringify({
          status: 'completed',
          summary: 'Updated the workflow.',
          changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
          artifacts: [],
        }),
      },
    ])
  })

  it('fails closed before billing when OpenAI function-call arguments are malformed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_item.done\ndata: {"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call-1","name":"read_workflow","arguments":"{\\"workflowId\\":"}}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":8,"total_tokens":13},"output":[{"type":"function_call","call_id":"call-1","name":"read_workflow","arguments":"{\\"workflowId\\":"}]}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
          provider: 'openai',
          integrationTools: [
            {
              name: 'read_workflow',
              input_schema: {
                type: 'object',
                properties: { workflowId: { type: 'string' } },
                required: ['workflowId'],
              },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'error',
      payload: {
        code: 'owned_provider_error',
        message: 'OpenAI function_call arguments must be valid JSON',
        provider: 'openai',
      },
    })
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(mockCreateMothershipToolCheckpoint).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunPausedForTool).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_error',
    })
  })

  it('continues owned OpenAI Responses checkpoints with function_call_output items', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Workflow looks healthy."}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":11,"output_tokens":5,"total_tokens":16}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: validOpenAIResumeProviderRequest(),
      },
      recordedResults: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-resume-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [{ callId: 'call-1', name: 'read_workflow', data: { ok: true }, success: true }],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(4)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 4,
      type: 'run',
      trace: { requestId: 'req-openai-resume-1' },
      payload: { kind: 'resumed' },
    })
    expect(events[1]).toMatchObject({
      v: 1,
      seq: 5,
      type: 'tool',
      trace: { requestId: 'req-openai-resume-1' },
      payload: {
        phase: 'result',
        toolCallId: 'call-1',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        success: true,
        status: 'success',
        output: { ok: true },
      },
    })
    expect(events[2]).toMatchObject({
      v: 1,
      seq: 6,
      type: 'text',
      trace: { requestId: 'req-openai-resume-1' },
      payload: {
        channel: 'assistant',
        text: 'Workflow looks healthy.',
      },
    })
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'complete',
      trace: { requestId: 'req-openai-resume-1' },
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 16,
          output_tokens: 13,
          total_tokens: 29,
          model: 'gpt-4.1',
        },
        cost: {
          input: 0.000032,
          output: 0.000104,
          total: 0.000136,
        },
      },
    })
    expect(mockMarkMothershipResumeToolResultDelivered).toHaveBeenCalledWith({
      checkpointId: 'checkpoint-1',
      toolCallId: 'call-1',
    })
    expect(mockMarkMothershipRunComplete).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockMarkMothershipResumeToolResultDelivered.mock.invocationCallOrder[0]!).toBeLessThan(
      mockMarkMothershipRunComplete.mock.invocationCallOrder[0]!
    )
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[3]!).toBeLessThan(
      mockMarkMothershipRunComplete.mock.invocationCallOrder[0]!
    )
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'gpt-4.1',
      inputTokens: 16,
      outputTokens: 13,
      cost: 0.000136,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer openai-secret',
        }),
      })
    )
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody.input).toEqual([
      { role: 'user', content: 'inspect workflow' },
      {
        type: 'function_call',
        call_id: 'call-1',
        name: 'read_workflow',
        arguments: '{"workflowId":"workflow-1"}',
      },
      {
        type: 'function_call_output',
        call_id: 'call-1',
        output: '{"ok":true}',
      },
    ])
  })

  it('continues OpenAI resume streams through a workflow subagent callback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        openAISseResponse([
          'event: response.output_item.done\ndata: {"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call-workflow-2","name":"workflow","arguments":"{\\"prompt\\":\\"fix this resumed workflow\\"}"}}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":7,"output_tokens":6,"total_tokens":13},"output":[{"type":"function_call","call_id":"call-workflow-2","name":"workflow","arguments":"{\\"prompt\\":\\"fix this resumed workflow\\"}"}]}}',
        ])
      )
      .mockResolvedValueOnce(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Workflow fixed after resume."}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":3,"output_tokens":4,"total_tokens":7}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockExecuteWorkflowSubagentCallback.mockResolvedValue({
      status: 'ok',
      response: {
        success: true,
        result: {
          status: 'completed',
          summary: 'Updated the resumed workflow.',
          changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
          artifacts: [],
        },
        streamEvents: [
          {
            v: 1,
            seq: 99,
            ts: '2026-06-21T00:00:00.000Z',
            stream: { streamId: 'child-stream', cursor: '99' },
            scope: {
              lane: 'subagent',
              agentId: 'workflow',
              parentToolCallId: 'call-workflow-2',
              spanId: 'child-span-1',
            },
            type: 'text',
            payload: { channel: 'assistant', text: 'Inspecting resumed workflow.' },
          },
        ],
      },
    })
    const baseProviderRequest = validOpenAIResumeProviderRequest()
    const providerRequest = {
      ...baseProviderRequest,
      workflowSubagentContext: validWorkflowSubagentResumeContext(),
      request: {
        ...baseProviderRequest.request,
        tools: [
          ...baseProviderRequest.request.tools,
          {
            type: 'function',
            name: 'workflow',
            description: 'Run the workflow subagent',
            parameters: {
              type: 'object',
              properties: { prompt: { type: 'string' } },
            },
          },
        ],
      },
    }
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest,
      },
      recordedResults: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-resume-subagent-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'call-1', name: 'read_workflow', data: { ok: true }, success: true }],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(7)
    expect(events[0]).toMatchObject({
      type: 'run',
      payload: { kind: 'resumed' },
    })
    expect(events[1]).toMatchObject({
      type: 'tool',
      payload: {
        phase: 'result',
        toolCallId: 'call-1',
        toolName: 'read_workflow',
        executor: 'sim',
        success: true,
        status: 'success',
      },
    })
    expect(events[2]).toMatchObject({
      type: 'tool',
      payload: {
        phase: 'call',
        toolCallId: 'call-workflow-2',
        toolName: 'workflow',
        executor: 'go',
        arguments: { prompt: 'fix this resumed workflow' },
        status: 'executing',
      },
    })
    expect(events[3]).toMatchObject({
      type: 'text',
      scope: {
        lane: 'subagent',
        agentId: 'workflow',
        parentToolCallId: 'call-workflow-2',
        spanId: 'child-span-1',
      },
      payload: { channel: 'assistant', text: 'Inspecting resumed workflow.' },
    })
    expect(events[4]).toMatchObject({
      type: 'tool',
      payload: {
        phase: 'result',
        toolCallId: 'call-workflow-2',
        toolName: 'workflow',
        executor: 'go',
        success: true,
        status: 'success',
        output: {
          status: 'completed',
          summary: 'Updated the resumed workflow.',
          changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
          artifacts: [],
        },
      },
    })
    expect(events[4].payload).not.toHaveProperty('ui')
    expect(events[5]).toMatchObject({
      type: 'text',
      payload: { channel: 'assistant', text: 'Workflow fixed after resume.' },
    })
    expect(events[6]).toMatchObject({
      type: 'complete',
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 15,
          output_tokens: 18,
          total_tokens: 33,
          model: 'gpt-4.1',
        },
      },
    })
    expect(mockExecuteWorkflowSubagentCallback).toHaveBeenCalledWith({
      env: expect.objectContaining({ SIM_BASE_URL: 'http://sim.local' }),
      request: {
        runId: RUNTIME_RUN_ID,
        streamId: 'stream-1',
        chatId: RUNTIME_CHAT_ID,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        parentToolCallId: 'call-workflow-2',
        model: 'gpt-4.1',
        provider: 'openai',
        depth: 0,
        input: {
          prompt: 'fix this resumed workflow',
          workflowId: 'workflow-1',
        },
        context: {
          messages: [{ role: 'user', content: 'hello' }],
          resources: [{ type: 'workflow', id: 'workflow-1', title: 'Support workflow' }],
          workflowId: 'workflow-1',
        },
        limits: {
          maxDepth: 1,
          maxProviderRounds: 8,
          maxChildToolCalls: 30,
        },
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const subagentContinuationBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string)
    expect(subagentContinuationBody.input.at(-1)).toEqual({
      type: 'function_call_output',
      call_id: 'call-workflow-2',
      output: JSON.stringify({
        status: 'completed',
        summary: 'Updated the resumed workflow.',
        changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
        artifacts: [],
      }),
    })
  })

  it('keeps OpenAI resume runs retryable when the Responses stream is truncated', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"partial"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: validOpenAIResumeProviderRequest(),
      },
      recordedResults: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-resume-retry-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [{ callId: 'call-1', name: 'read_workflow', data: { ok: true }, success: true }],
        }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.text()).rejects.toThrow(
      'OpenAI Responses stream ended before response.completed'
    )
    expect(mockMarkMothershipRunPausedForTool).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockMarkMothershipResumeToolResultDelivered).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
  })

  it('pauses again when an owned OpenAI resume returns another function call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_item.added\ndata: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"call-2","name":"read_workflow"}}',
          'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\\"workflowId\\":"}',
          'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"\\"workflow-2\\"}"}',
          'event: response.function_call_arguments.done\ndata: {"type":"response.function_call_arguments.done","output_index":0,"arguments":"{\\"workflowId\\":\\"workflow-2\\"}"}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":13,"output_tokens":6,"total_tokens":19}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockCreateMothershipToolCheckpoint.mockResolvedValueOnce({
      status: 'ready',
      checkpointId: 'checkpoint-2',
      pendingToolCallIds: ['call-2'],
    })
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: validOpenAIResumeProviderRequest(),
      },
      recordedResults: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-resume-chain-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [{ callId: 'call-1', name: 'read_workflow', data: { ok: true }, success: true }],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(4)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 4,
      type: 'run',
      trace: { requestId: 'req-openai-resume-chain-1' },
      payload: { kind: 'resumed' },
    })
    expect(events[1]).toMatchObject({
      v: 1,
      seq: 5,
      type: 'tool',
      trace: { requestId: 'req-openai-resume-chain-1' },
      payload: {
        phase: 'result',
        toolCallId: 'call-1',
        toolName: 'read_workflow',
        success: true,
        status: 'success',
        output: { ok: true },
      },
    })
    expect(events[2]).toMatchObject({
      v: 1,
      seq: 6,
      type: 'tool',
      trace: { requestId: 'req-openai-resume-chain-1' },
      payload: {
        phase: 'call',
        toolCallId: 'call-2',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        arguments: { workflowId: 'workflow-2' },
        status: 'executing',
      },
    })
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'run',
      trace: { requestId: 'req-openai-resume-chain-1' },
      payload: {
        kind: 'checkpoint_pause',
        checkpointId: 'checkpoint-2',
        executionId: 'exec-1',
        runId: RUNTIME_RUN_ID,
        pendingToolCallIds: ['call-2'],
      },
    })
    expect(mockCreateMothershipToolCheckpoint).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      pendingToolCalls: [
        {
          toolCallId: 'call-2',
          toolName: 'read_workflow',
          args: { workflowId: 'workflow-2' },
        },
      ],
      conversationSnapshot: {
        input: [
          { role: 'user', content: 'inspect workflow' },
          {
            type: 'function_call',
            call_id: 'call-1',
            name: 'read_workflow',
            arguments: '{"workflowId":"workflow-1"}',
          },
          {
            type: 'function_call_output',
            call_id: 'call-1',
            output: '{"ok":true}',
          },
        ],
        outputItems: [
          {
            type: 'function_call',
            call_id: 'call-2',
            name: 'read_workflow',
            arguments: '{"workflowId":"workflow-2"}',
          },
        ],
      },
      agentState: {
        provider: 'openai',
        stopReason: 'tool_call',
      },
      providerRequest: expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4.1',
        executionId: 'exec-1',
        billing: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          source: 'copilot',
          cumulativeUsage: {
            input_tokens: 18,
            output_tokens: 14,
          },
        },
        outputItems: [
          {
            type: 'function_call',
            call_id: 'call-2',
            name: 'read_workflow',
            arguments: '{"workflowId":"workflow-2"}',
          },
        ],
      }),
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'gpt-4.1',
      inputTokens: 18,
      outputTokens: 14,
      cost: 0.000148,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
    })
    expect(mockMarkMothershipRunPausedForTool).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockMarkMothershipResumeToolResultDelivered).toHaveBeenCalledWith({
      checkpointId: 'checkpoint-1',
      toolCallId: 'call-1',
    })
    expect(mockMarkMothershipResumeToolResultDelivered.mock.invocationCallOrder[0]!).toBeLessThan(
      mockMarkMothershipRunPausedForTool.mock.invocationCallOrder[0]!
    )
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody.input).toEqual([
      { role: 'user', content: 'inspect workflow' },
      {
        type: 'function_call',
        call_id: 'call-1',
        name: 'read_workflow',
        arguments: '{"workflowId":"workflow-1"}',
      },
      {
        type: 'function_call_output',
        call_id: 'call-1',
        output: '{"ok":true}',
      },
    ])
  })

  it('continues owned OpenAI streams with failed resume tool results and bills cumulatively', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"I handled the failure."}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":11,"output_tokens":5,"total_tokens":16}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: validOpenAIResumeProviderRequest(),
      },
      recordedResults: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          status: 'failed',
          result: { error: 'Tool failed loudly' },
          error: 'Tool failed loudly',
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-resume-failed-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [
            {
              callId: 'call-1',
              name: 'read_workflow',
              data: { error: 'Tool failed loudly' },
              success: false,
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(4)
    expect(events[1]).toMatchObject({
      v: 1,
      seq: 5,
      type: 'tool',
      trace: { requestId: 'req-openai-resume-failed-1' },
      payload: {
        phase: 'result',
        toolCallId: 'call-1',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        success: false,
        status: 'error',
        error: 'Tool failed loudly',
      },
    })
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'complete',
      trace: { requestId: 'req-openai-resume-failed-1' },
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 16,
          output_tokens: 13,
          total_tokens: 29,
          model: 'gpt-4.1',
        },
        cost: {
          input: 0.000032,
          output: 0.000104,
          total: 0.000136,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'gpt-4.1',
      inputTokens: 16,
      outputTokens: 13,
      cost: 0.000136,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
    })
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody.input.at(-1)).toEqual({
      type: 'function_call_output',
      call_id: 'call-1',
      output: 'Tool failed loudly',
    })
  })

  it('continues owned OpenAI streams with cancelled resume tool results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Tool cancellation noted."}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":9,"output_tokens":4,"total_tokens":13}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: validOpenAIResumeProviderRequest(),
      },
      recordedResults: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          status: 'cancelled',
          result: { cancelled: true },
          error: 'Tool cancelled',
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-resume-cancelled-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [
            {
              callId: 'call-1',
              name: 'read_workflow',
              data: { cancelled: true },
              success: false,
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(4)
    expect(events[1]).toMatchObject({
      v: 1,
      seq: 5,
      type: 'tool',
      trace: { requestId: 'req-openai-resume-cancelled-1' },
      payload: {
        phase: 'result',
        toolCallId: 'call-1',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        success: false,
        status: 'cancelled',
        error: 'Tool cancelled',
        output: { cancelled: true },
      },
    })
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'complete',
      trace: { requestId: 'req-openai-resume-cancelled-1' },
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 14,
          output_tokens: 12,
          total_tokens: 26,
          model: 'gpt-4.1',
        },
        cost: {
          input: 0.000028,
          output: 0.000096,
          total: 0.000124,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'gpt-4.1',
      inputTokens: 14,
      outputTokens: 12,
      cost: 0.000124,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:openai',
    })
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody.input.at(-1)).toEqual({
      type: 'function_call_output',
      call_id: 'call-1',
      output: 'Tool cancelled',
    })
  })

  it('preserves multi-tool OpenAI resume ordering in events and function_call_output items', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Both tools are complete."}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":20,"output_tokens":7,"total_tokens":27}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: validOpenAIMultiToolResumeProviderRequest(),
      },
      recordedResults: [
        {
          toolCallId: 'call-2',
          toolName: 'search_docs',
          status: 'completed',
          result: { matches: 2 },
          error: null,
        },
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-resume-multi-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [
            { callId: 'call-2', name: 'search_docs', data: { matches: 2 }, success: true },
            { callId: 'call-1', name: 'read_workflow', data: { ok: true }, success: true },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(5)
    expect(events.map((event) => event.type)).toEqual(['run', 'tool', 'tool', 'text', 'complete'])
    expect(events[1]).toMatchObject({
      seq: 5,
      payload: {
        toolCallId: 'call-1',
        status: 'success',
        output: { ok: true },
      },
    })
    expect(events[2]).toMatchObject({
      seq: 6,
      payload: {
        toolCallId: 'call-2',
        status: 'success',
        output: { matches: 2 },
      },
    })
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody.input).toEqual([
      { role: 'user', content: 'inspect workflow' },
      {
        type: 'function_call',
        call_id: 'call-1',
        name: 'read_workflow',
        arguments: '{"workflowId":"workflow-1"}',
      },
      {
        type: 'function_call',
        call_id: 'call-2',
        name: 'search_docs',
        arguments: '{"query":"checkpoint docs"}',
      },
      {
        type: 'function_call_output',
        call_id: 'call-1',
        output: '{"ok":true}',
      },
      {
        type: 'function_call_output',
        call_id: 'call-2',
        output: '{"matches":2}',
      },
    ])
  })

  it('persists BYOK credential source when an initial BYOK OpenAI stream pauses for tools', async () => {
    mockCreateMothershipToolCheckpoint.mockResolvedValueOnce({
      status: 'ready',
      checkpointId: 'checkpoint-1',
      pendingToolCallIds: ['call-1'],
    })
    mockGetMothershipByokProviderKey.mockResolvedValueOnce({
      workspaceId: 'workspace-1',
      provider: 'openai',
      apiKey: 'byok-openai-secret',
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_item.done\ndata: {"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call-1","name":"read_workflow","arguments":"{\\"workflowId\\":\\"workflow-1\\"}"}}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":8,"total_tokens":13}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'hosted-openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${mothershipRuntimeContract.path}`, {
        method: mothershipRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-byok-tool-1',
        },
        body: JSON.stringify({
          message: 'inspect workflow',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
          provider: 'openai',
          enterpriseByokEligible: true,
          integrationTools: [
            {
              name: 'read_workflow',
              description: 'Read a workflow',
              input_schema: {
                type: 'object',
                properties: { workflowId: { type: 'string' } },
                required: ['workflowId'],
              },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      type: 'run',
      trace: { requestId: 'req-openai-byok-tool-1' },
      payload: {
        kind: 'checkpoint_pause',
        checkpointId: 'checkpoint-1',
        pendingToolCallIds: ['call-1'],
      },
    })
    expect(mockCreateMothershipToolCheckpoint).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      pendingToolCalls: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          args: { workflowId: 'workflow-1' },
        },
      ],
      conversationSnapshot: {
        input: [{ role: 'user', content: 'inspect workflow' }],
        outputItems: [
          {
            type: 'function_call',
            call_id: 'call-1',
            name: 'read_workflow',
            arguments: '{"workflowId":"workflow-1"}',
          },
        ],
      },
      agentState: {
        provider: 'openai',
        stopReason: 'tool_call',
      },
      providerRequest: expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4.1',
        executionId: 'exec-1',
        billing: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          source: 'workspace-chat',
          credentialSource: 'byok',
          cumulativeUsage: {
            input_tokens: 5,
            output_tokens: 8,
          },
        },
      }),
    })
    expect(mockValidateMothershipByokEntitlement).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      signal: expect.any(AbortSignal),
    })
    expect(mockGetMothershipByokProviderKey).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      provider: 'openai',
      encryptionKey: TEST_ENV.ENCRYPTION_KEY,
    })
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer byok-openai-secret',
        }),
      })
    )
  })

  it('resumes BYOK OpenAI checkpoints with BYOK credentials and zero hosted billing', async () => {
    mockGetMothershipByokProviderKey.mockResolvedValueOnce({
      workspaceId: 'workspace-1',
      provider: 'openai',
      apiKey: 'byok-openai-secret',
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Workflow still looks healthy."}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":11,"output_tokens":5,"total_tokens":16}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const providerRequest = validOpenAIResumeProviderRequest()
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: {
          ...providerRequest,
          billing: {
            ...providerRequest.billing,
            credentialSource: 'byok',
          },
        },
      },
      recordedResults: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'hosted-openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-resume-byok-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [{ callId: 'call-1', name: 'read_workflow', data: { ok: true }, success: true }],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(4)
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'complete',
      trace: { requestId: 'req-openai-resume-byok-1' },
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 16,
          output_tokens: 13,
          total_tokens: 29,
          model: 'gpt-4.1',
        },
        cost: {
          input: 0,
          output: 0,
          total: 0,
        },
      },
    })
    expect(mockGetMothershipByokProviderKey).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      provider: 'openai',
      encryptionKey: TEST_ENV.ENCRYPTION_KEY,
    })
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer byok-openai-secret',
        }),
      })
    )
  })

  it('fails closed on BYOK OpenAI resume rejection without falling back to hosted credentials', async () => {
    mockValidateMothershipByokEntitlement.mockResolvedValueOnce({
      status: 'rejected',
      statusCode: 403,
      body: null,
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const providerRequest = validOpenAIResumeProviderRequest()
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: {
          ...providerRequest,
          billing: {
            ...providerRequest.billing,
            credentialSource: 'byok',
          },
        },
      },
      recordedResults: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'hosted-openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-resume-byok-rejected-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [{ callId: 'call-1', name: 'read_workflow', data: { ok: true }, success: true }],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 4,
      type: 'error',
      trace: { requestId: 'req-openai-resume-byok-rejected-1' },
      payload: {
        code: 'owned_provider_error',
        message: 'Mothership BYOK callback failed with status 403',
      },
    })
    expect(mockGetMothershipByokProviderKey).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunPausedForTool).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_error',
    })
  })

  it('assembles mixed OpenAI item_id and output_index arguments before checkpointing', async () => {
    mockCreateMothershipToolCheckpoint.mockResolvedValueOnce({
      status: 'ready',
      checkpointId: 'checkpoint-1',
      pendingToolCallIds: ['call-1', 'call-2'],
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        openAISseResponse([
          'event: response.output_item.added\ndata: {"type":"response.output_item.added","output_index":0,"item":{"id":"fc-item-1","type":"function_call","call_id":"call-1","name":"read_workflow"}}',
          'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","item_id":"fc-item-1","delta":"{\\"workflowId\\":\\"workflow-1\\"}"}',
          'event: response.output_item.added\ndata: {"type":"response.output_item.added","output_index":1,"item":{"type":"function_call","call_id":"call-2","name":"search_docs"}}',
          'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":1,"delta":"{\\"query\\":\\"checkpoint docs\\"}"}',
          'event: response.function_call_arguments.done\ndata: {"type":"response.function_call_arguments.done","item_id":"fc-item-1","arguments":"{\\"workflowId\\":\\"workflow-1\\"}"}',
          'event: response.function_call_arguments.done\ndata: {"type":"response.function_call_arguments.done","output_index":1,"arguments":"{\\"query\\":\\"checkpoint docs\\"}"}',
          'event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":7,"output_tokens":9,"total_tokens":16}}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-openai-mixed-items-1',
        },
        body: JSON.stringify({
          message: 'inspect workflow',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gpt-4.1',
          provider: 'openai',
          integrationTools: [
            {
              name: 'read_workflow',
              description: 'Read a workflow',
              input_schema: {
                type: 'object',
                properties: { workflowId: { type: 'string' } },
                required: ['workflowId'],
              },
            },
            {
              name: 'search_docs',
              description: 'Search docs',
              input_schema: {
                type: 'object',
                properties: { query: { type: 'string' } },
                required: ['query'],
              },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      seq: 1,
      type: 'tool',
      payload: {
        phase: 'call',
        toolCallId: 'call-1',
        toolName: 'read_workflow',
        arguments: { workflowId: 'workflow-1' },
      },
    })
    expect(events[1]).toMatchObject({
      seq: 2,
      type: 'tool',
      payload: {
        phase: 'call',
        toolCallId: 'call-2',
        toolName: 'search_docs',
        arguments: { query: 'checkpoint docs' },
      },
    })
    expect(events[2]).toMatchObject({
      seq: 3,
      type: 'run',
      payload: {
        kind: 'checkpoint_pause',
        checkpointId: 'checkpoint-1',
        pendingToolCallIds: ['call-1', 'call-2'],
      },
    })
    expect(mockCreateMothershipToolCheckpoint).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      pendingToolCalls: [
        {
          toolCallId: 'call-1',
          toolName: 'read_workflow',
          args: { workflowId: 'workflow-1' },
        },
        {
          toolCallId: 'call-2',
          toolName: 'search_docs',
          args: { query: 'checkpoint docs' },
        },
      ],
      conversationSnapshot: {
        input: [{ role: 'user', content: 'inspect workflow' }],
        outputItems: [
          {
            id: 'fc-item-1',
            type: 'function_call',
            call_id: 'call-1',
            name: 'read_workflow',
            arguments: '{"workflowId":"workflow-1"}',
          },
          {
            type: 'function_call',
            call_id: 'call-2',
            name: 'search_docs',
            arguments: '{"query":"checkpoint docs"}',
          },
        ],
      },
      agentState: {
        provider: 'openai',
        stopReason: 'tool_call',
      },
      providerRequest: expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4.1',
        executionId: 'exec-1',
        outputItems: [
          {
            id: 'fc-item-1',
            type: 'function_call',
            call_id: 'call-1',
            name: 'read_workflow',
            arguments: '{"workflowId":"workflow-1"}',
          },
          {
            type: 'function_call',
            call_id: 'call-2',
            name: 'search_docs',
            arguments: '{"query":"checkpoint docs"}',
          },
        ],
      }),
    })
  })

  it('uses a workspace BYOK Anthropic key only after Sim authorizes BYOK', async () => {
    mockGetMothershipByokProviderKey.mockResolvedValueOnce({
      workspaceId: 'workspace-1',
      provider: 'anthropic',
      apiKey: 'byok-anthropic-secret',
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":3}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello BYOK"}}',
          'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":4}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'hosted-anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${mothershipRuntimeContract.path}`, {
        method: mothershipRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-byok-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
          enterpriseByokEligible: true,
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      type: 'complete',
      payload: {
        usage: {
          input_tokens: 3,
          output_tokens: 4,
          total_tokens: 7,
          model: 'claude-opus-4-8',
        },
        cost: {
          input: 0,
          output: 0,
          total: 0,
        },
      },
    })
    expect(mockValidateMothershipByokEntitlement).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
        MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      signal: expect.any(AbortSignal),
    })
    expect(mockGetMothershipByokProviderKey).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      provider: 'anthropic',
      encryptionKey: TEST_ENV.ENCRYPTION_KEY,
    })
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'byok-anthropic-secret',
        }),
      })
    )
  })

  it('falls back to the hosted Anthropic key when initial BYOK validation is rejected', async () => {
    mockValidateMothershipByokEntitlement.mockResolvedValueOnce({
      status: 'rejected',
      statusCode: 403,
      body: null,
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":3}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello hosted"}}',
          'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":4}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'hosted-anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${mothershipRuntimeContract.path}`, {
        method: mothershipRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
          enterpriseByokEligible: true,
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events[1]).toMatchObject({
      type: 'complete',
      payload: {
        cost: {
          input: 0.000015,
          output: 0.0001,
          total: 0.000115,
        },
      },
    })
    expect(mockGetMothershipByokProviderKey).not.toHaveBeenCalled()
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'workspace-chat',
      model: 'claude-opus-4-8',
      inputTokens: 3,
      outputTokens: 4,
      cost: 0.000115,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:anthropic',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'hosted-anthropic-secret',
        }),
      })
    )
  })

  it('persists BYOK credential source when an initial BYOK Anthropic stream pauses for tools', async () => {
    mockGetMothershipByokProviderKey.mockResolvedValueOnce({
      workspaceId: 'workspace-1',
      provider: 'anthropic',
      apiKey: 'byok-anthropic-secret',
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":5}}}',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu-1","name":"read_workflow","input":{}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"workflowId\\": \\"workflow-1\\"}"}}',
          'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":8}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'hosted-anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${mothershipRuntimeContract.path}`, {
        method: mothershipRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-byok-tool-use-1',
        },
        body: JSON.stringify({
          message: 'inspect workflow',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
          enterpriseByokEligible: true,
          integrationTools: [
            {
              name: 'read_workflow',
              description: 'Read a workflow',
              input_schema: {
                type: 'object',
                properties: { workflowId: { type: 'string' } },
                required: ['workflowId'],
              },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      type: 'run',
      payload: {
        kind: 'checkpoint_pause',
        checkpointId: 'checkpoint-1',
        pendingToolCallIds: ['toolu-1'],
      },
    })
    expect(mockCreateMothershipToolCheckpoint).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      pendingToolCalls: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          args: { workflowId: 'workflow-1' },
        },
      ],
      conversationSnapshot: expect.objectContaining({
        messages: [{ role: 'user', content: 'inspect workflow' }],
      }),
      agentState: {
        provider: 'anthropic',
        stopReason: 'tool_use',
      },
      providerRequest: expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-opus-4-8',
        executionId: 'exec-1',
        billing: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          source: 'workspace-chat',
          credentialSource: 'byok',
          cumulativeUsage: {
            input_tokens: 5,
            output_tokens: 8,
          },
        },
      }),
    })
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'byok-anthropic-secret',
        }),
      })
    )
  })

  it('fails closed before completing an Anthropic stream when billing callback fails', async () => {
    mockReportMothershipBillingUsage.mockResolvedValueOnce({
      status: 'rejected',
      statusCode: 500,
      body: { error: 'billing down' },
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":3}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
          'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":4}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      type: 'error',
      payload: {
        code: 'owned_provider_error',
        message: 'Mothership billing callback failed with status 500',
      },
    })
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_error',
    })
  })

  it('persists Anthropic tool use as a durable checkpoint pause', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":5}}}',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"I will check."}}',
          'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
          'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu-1","name":"read_workflow","input":{}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"workflowId\\":"}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \\"workflow-1\\"}"}}',
          'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":8}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-tool-use-1',
        },
        body: JSON.stringify({
          message: 'inspect workflow',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
          integrationTools: [
            {
              name: 'read_workflow',
              description: 'Read a workflow',
              input_schema: {
                type: 'object',
                properties: { workflowId: { type: 'string' } },
                required: ['workflowId'],
              },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      seq: 1,
      type: 'text',
      payload: { channel: 'assistant', text: 'I will check.' },
    })
    expect(events[1]).toMatchObject({
      seq: 2,
      type: 'tool',
      payload: {
        phase: 'call',
        toolCallId: 'toolu-1',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        arguments: { workflowId: 'workflow-1' },
        status: 'executing',
      },
    })
    expect(events[2]).toMatchObject({
      seq: 3,
      type: 'run',
      payload: {
        kind: 'checkpoint_pause',
        checkpointId: 'checkpoint-1',
        executionId: 'exec-1',
        runId: RUNTIME_RUN_ID,
        pendingToolCallIds: ['toolu-1'],
      },
    })
    expect(mockCreateMothershipToolCheckpoint).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      pendingToolCalls: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          args: { workflowId: 'workflow-1' },
        },
      ],
      conversationSnapshot: {
        messages: [{ role: 'user', content: 'inspect workflow' }],
        assistantContent: [
          { type: 'text', text: 'I will check.' },
          {
            type: 'tool_use',
            id: 'toolu-1',
            name: 'read_workflow',
            input: { workflowId: 'workflow-1' },
          },
        ],
      },
      agentState: {
        provider: 'anthropic',
        stopReason: 'tool_use',
      },
      providerRequest: expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-opus-4-8',
        executionId: 'exec-1',
        billing: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          source: 'copilot',
          credentialSource: 'hosted',
          cumulativeUsage: {
            input_tokens: 5,
            output_tokens: 8,
          },
        },
        assistantContent: [
          { type: 'text', text: 'I will check.' },
          {
            type: 'tool_use',
            id: 'toolu-1',
            name: 'read_workflow',
            input: { workflowId: 'workflow-1' },
          },
        ],
      }),
    })
    expect(mockMarkMothershipRunPausedForTool).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[2]!).toBeLessThan(
      mockMarkMothershipRunPausedForTool.mock.invocationCallOrder[0]!
    )
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'claude-opus-4-8',
      inputTokens: 5,
      outputTokens: 8,
      cost: 0.000225,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:anthropic',
    })
    expect(mockReportMothershipBillingUsage.mock.invocationCallOrder[0]!).toBeLessThan(
      mockCreateMothershipToolCheckpoint.mock.invocationCallOrder[0]!
    )

    const providerRequest = mockCreateMothershipToolCheckpoint.mock.calls[0]![0].providerRequest
    expect(providerRequest.request).toMatchObject({
      model: 'claude-opus-4-8',
      stream: true,
      messages: [{ role: 'user', content: 'inspect workflow' }],
      tools: [
        {
          name: 'read_workflow',
          description: 'Read a workflow',
          input_schema: {
            type: 'object',
            properties: { workflowId: { type: 'string' } },
            required: ['workflowId'],
          },
        },
      ],
    })
  })

  it('continues Anthropic after a completed workflow subagent callback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":5}}}',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu-1","name":"workflow","input":{}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"prompt\\":"}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":" \\"inspect this workflow\\"}"}}',
          'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":8}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
      .mockResolvedValueOnce(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":7}}}',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Workflow fixed."}}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":9}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockExecuteWorkflowSubagentCallback.mockResolvedValue({
      status: 'ok',
      response: {
        success: true,
        result: {
          status: 'completed',
          summary: 'Updated the workflow.',
          changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
          artifacts: [],
        },
        streamEvents: [
          {
            v: 1,
            seq: 42,
            ts: '2026-06-21T00:00:00.000Z',
            stream: { streamId: 'child-stream', cursor: '42' },
            scope: {
              lane: 'subagent',
              agentId: 'workflow',
              parentToolCallId: 'toolu-1',
              spanId: 'child-span-1',
            },
            type: 'text',
            payload: { channel: 'assistant', text: 'Inspecting workflow.' },
          },
        ],
      },
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-anthropic-subagent-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          workflowId: 'workflow-1',
          workflowName: 'Support workflow',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
          integrationTools: [
            {
              name: 'workflow',
              description: 'Run the workflow subagent',
              input_schema: {
                type: 'object',
                properties: { prompt: { type: 'string' } },
              },
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(5)
    expect(events[0]).toMatchObject({
      type: 'tool',
      trace: { requestId: 'req-anthropic-subagent-1' },
      payload: {
        phase: 'call',
        toolCallId: 'toolu-1',
        toolName: 'workflow',
        executor: 'go',
        mode: 'async',
        arguments: { prompt: 'inspect this workflow' },
        status: 'executing',
        ui: { internal: true },
      },
    })
    expect(events[1]).toMatchObject({
      type: 'text',
      seq: 2,
      stream: { streamId: 'stream-1', cursor: '2' },
      trace: { requestId: 'req-anthropic-subagent-1' },
      scope: {
        lane: 'subagent',
        agentId: 'workflow',
        parentToolCallId: 'toolu-1',
        spanId: 'child-span-1',
      },
      payload: { channel: 'assistant', text: 'Inspecting workflow.' },
    })
    expect(events[2]).toMatchObject({
      type: 'tool',
      trace: { requestId: 'req-anthropic-subagent-1' },
      payload: {
        phase: 'result',
        toolCallId: 'toolu-1',
        toolName: 'workflow',
        executor: 'go',
        success: true,
        status: 'success',
      },
    })
    expect(events[3]).toMatchObject({
      type: 'text',
      payload: { channel: 'assistant', text: 'Workflow fixed.' },
    })
    expect(events[4]).toMatchObject({
      type: 'complete',
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 12,
          output_tokens: 17,
          total_tokens: 29,
          model: 'claude-opus-4-8',
        },
      },
    })
    expect(mockExecuteWorkflowSubagentCallback).toHaveBeenCalledWith({
      env: expect.objectContaining({ SIM_BASE_URL: 'http://sim.local' }),
      request: {
        runId: RUNTIME_RUN_ID,
        streamId: 'stream-1',
        chatId: RUNTIME_CHAT_ID,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        parentToolCallId: 'toolu-1',
        model: 'claude-opus-4-8',
        provider: 'anthropic',
        depth: 0,
        input: {
          prompt: 'inspect this workflow',
          workflowId: 'workflow-1',
        },
        context: {
          messages: [{ role: 'user', content: 'hello' }],
          resources: [{ type: 'workflow', id: 'workflow-1', title: 'Support workflow' }],
          workflowId: 'workflow-1',
        },
        limits: {
          maxDepth: 1,
          maxProviderRounds: 8,
          maxChildToolCalls: 30,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenNthCalledWith(1, {
      env: expect.objectContaining({ SIM_BASE_URL: 'http://sim.local' }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'claude-opus-4-8',
      inputTokens: 5,
      outputTokens: 8,
      cost: 0.000225,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:anthropic',
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenNthCalledWith(2, {
      env: expect.objectContaining({ SIM_BASE_URL: 'http://sim.local' }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'claude-opus-4-8',
      inputTokens: 12,
      outputTokens: 17,
      cost: 0.000485,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:anthropic',
    })
    expect(mockCreateMothershipToolCheckpoint).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunPausedForTool).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunComplete).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondRequestBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string)
    expect(secondRequestBody.messages).toEqual([
      { role: 'user', content: 'hello' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu-1',
            name: 'workflow',
            input: { prompt: 'inspect this workflow' },
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-1',
            content: JSON.stringify({
              status: 'completed',
              summary: 'Updated the workflow.',
              changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
              artifacts: [],
            }),
          },
        ],
      },
    ])
  })

  it('fails closed when Anthropic stream ends before message_stop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-anthropic-truncated-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_error',
    })
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[1]!).toBeLessThan(
      mockMarkMothershipRunFailed.mock.invocationCallOrder[0]!
    )
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      type: 'text',
      payload: { channel: 'assistant', text: 'partial' },
    })
    expect(events[1]).toMatchObject({
      type: 'error',
      payload: {
        code: 'owned_provider_error',
        message: 'Anthropic stream ended before message_stop',
      },
    })
  })

  it('fails closed when Anthropic streams an error event', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"provider overloaded"}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-anthropic-error-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'claude-opus-4-8',
          provider: 'anthropic',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_error',
    })
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[0]!).toBeLessThan(
      mockMarkMothershipRunFailed.mock.invocationCallOrder[0]!
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'error',
      trace: { requestId: 'req-anthropic-error-1' },
      payload: {
        code: 'owned_provider_error',
        message: 'provider overloaded',
        provider: 'anthropic',
        data: {
          route: '/api/copilot',
          model: 'claude-opus-4-8',
        },
      },
    })
  })

  it('keeps unsupported providers on the honest unsupported runtime terminal', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${copilotRuntimeContract.path}`, {
        method: copilotRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-unsupported-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
          model: 'gemini-3-pro',
          provider: 'google',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_continuation_not_implemented',
    })
    expect(mockAppendMothershipRunEvents.mock.invocationCallOrder[0]!).toBeLessThan(
      mockMarkMothershipRunFailed.mock.invocationCallOrder[0]!
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'error',
      trace: { requestId: 'req-unsupported-1' },
      payload: {
        code: 'owned_provider_continuation_not_implemented',
        provider: 'google',
        data: {
          route: '/api/copilot',
          model: 'gemini-3-pro',
        },
      },
    })
  })

  it('routes /api/mothership through the same owned runtime stream kernel', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${mothershipRuntimeContract.path}`, {
        method: mothershipRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-mothership-runtime-1',
        },
        body: JSON.stringify({
          message: 'hello',
          userId: 'user-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'error',
      stream: { streamId: 'stream-1', cursor: '1' },
      trace: { requestId: 'req-mothership-runtime-1' },
      payload: {
        code: 'owned_provider_credentials_missing',
        data: {
          route: '/api/mothership',
          model: 'claude-opus-4-8',
        },
      },
    })
  })

  it('routes /api/mothership/execute messages through the owned provider kernel', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"scheduled answer"}}',
          'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":2}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${mothershipExecuteRuntimeContract.path}`, {
        method: mothershipExecuteRuntimeContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-execute-runtime-1',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'run scheduled task' }],
          userId: 'user-1',
          workspaceId: 'workspace-1',
          messageId: 'stream-1',
          chatId: RUNTIME_CHAT_ID,
          executionId: 'exec-1',
          runId: RUNTIME_RUN_ID,
          model: 'claude-opus-4-8',
          provider: 'anthropic',
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      type: 'text',
      trace: { requestId: 'req-execute-runtime-1' },
      payload: { channel: 'assistant', text: 'scheduled answer' },
    })
    expect(events[1]).toMatchObject({
      type: 'complete',
      payload: {
        status: 'complete',
        usage: {
          output_tokens: 2,
          model: 'claude-opus-4-8',
        },
      },
    })
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody.messages).toEqual([{ role: 'user', content: 'run scheduled task' }])
  })

  it('rejects explicit-abort requests without runtime auth', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${explicitAbortContract.path}`, {
        method: explicitAbortContract.method,
        body: JSON.stringify({
          messageId: 'stream-1',
          userId: 'user-1',
        }),
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(mockMarkMothershipRunCancelled).not.toHaveBeenCalled()
    expect(mockGetMothershipRunByStream).not.toHaveBeenCalled()
  })

  it('authenticates explicit-abort before parsing malformed JSON', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${explicitAbortContract.path}`, {
        method: explicitAbortContract.method,
        body: '{',
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(mockMarkMothershipRunCancelled).not.toHaveBeenCalled()
    expect(mockGetMothershipRunByStream).not.toHaveBeenCalled()
  })

  it('marks an abortable stream cancelled', async () => {
    mockMarkMothershipRunCancelled.mockResolvedValue({
      id: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'cancelled',
      completedAt: new Date('2026-06-20T00:00:00.000Z'),
      error: 'explicit_abort',
    })
    const handler = createMothershipHandler(TEST_ENV)

    const response = await handler(
      new Request(`http://mothership.local${explicitAbortContract.path}`, {
        method: explicitAbortContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-abort-1',
        },
        body: JSON.stringify({
          messageId: 'stream-1',
          userId: 'user-1',
          chatId: RUNTIME_CHAT_ID,
          workspaceId: 'workspace-1',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-abort-1')
    expect(await readJson(response)).toEqual({ success: true })
    expect(mockMarkMothershipRunCancelled).toHaveBeenCalledWith({
      streamId: 'stream-1',
      userId: 'user-1',
      reason: 'explicit_abort',
    })
    expect(mockGetMothershipRunByStream).not.toHaveBeenCalled()
  })

  it('returns not found when explicit-abort targets an unknown stream', async () => {
    const handler = createMothershipHandler(TEST_ENV)

    const response = await handler(
      new Request(`http://mothership.local${explicitAbortContract.path}`, {
        method: explicitAbortContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          messageId: 'stream-missing',
          userId: 'user-1',
        }),
      })
    )

    expect(response.status).toBe(404)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'stream_not_found',
    })
    expect(mockMarkMothershipRunCancelled).toHaveBeenCalledWith({
      streamId: 'stream-missing',
      userId: 'user-1',
      reason: 'explicit_abort',
    })
    expect(mockGetMothershipRunByStream).toHaveBeenCalledWith({
      streamId: 'stream-missing',
      userId: 'user-1',
    })
  })

  it('returns conflict when explicit-abort targets a terminal stream', async () => {
    mockGetMothershipRunByStream.mockResolvedValue({
      id: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      status: 'complete',
      completedAt: new Date('2026-06-20T00:00:00.000Z'),
      error: null,
    })
    const handler = createMothershipHandler(TEST_ENV)

    const response = await handler(
      new Request(`http://mothership.local${explicitAbortContract.path}`, {
        method: explicitAbortContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          messageId: 'stream-1',
          userId: 'user-1',
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'stream_not_abortable',
      status: 'complete',
    })
  })

  it('rejects invalid explicit-abort bodies without touching state', async () => {
    const handler = createMothershipHandler(TEST_ENV)

    const response = await handler(
      new Request(`http://mothership.local${explicitAbortContract.path}`, {
        method: explicitAbortContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          messageId: '',
          userId: 'user-1',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockMarkMothershipRunCancelled).not.toHaveBeenCalled()
    expect(mockGetMothershipRunByStream).not.toHaveBeenCalled()
  })

  it('rejects malformed explicit-abort JSON without touching state', async () => {
    const handler = createMothershipHandler(TEST_ENV)

    const response = await handler(
      new Request(`http://mothership.local${explicitAbortContract.path}`, {
        method: explicitAbortContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: '{',
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_json_body',
    })
    expect(mockMarkMothershipRunCancelled).not.toHaveBeenCalled()
    expect(mockGetMothershipRunByStream).not.toHaveBeenCalled()
  })

  it('authenticates resume before parsing malformed JSON', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        body: '{',
      })
    )

    expect(response.status).toBe(401)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'missing_service_key',
    })
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects invalid resume bodies without touching state', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: '', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'invalid_request',
    })
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('returns not found when resume targets a missing checkpoint', async () => {
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce(null)
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-missing',
          userId: 'user-1',
          results: [{ callId: 'tool-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(404)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'checkpoint_not_found',
    })
    expect(mockGetMothershipResumeCheckpoint).toHaveBeenCalledWith({
      streamId: 'stream-1',
      checkpointId: 'checkpoint-missing',
      userId: 'user-1',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects resume entitlement failures before recording tool results', async () => {
    mockValidateMothershipApiKeyEntitlement.mockResolvedValueOnce({
      status: 'rejected',
      statusCode: 402,
      body: null,
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-resume-entitlement-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          workspaceId: 'workspace-1',
          results: [{ callId: 'toolu-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(402)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'api_key_validation_failed',
      status: 402,
    })
    expect(mockValidateMothershipApiKeyEntitlement).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      signal: expect.any(AbortSignal),
    })
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
    expect(mockGetLatestMothershipRunEventSeq).not.toHaveBeenCalled()
  })

  it('rejects resume requests when caller workspace conflicts with durable run workspace', async () => {
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          workspaceId: 'spoofed-workspace',
          results: [{ callId: 'toolu-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'resume_workspace_conflict',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects non-resumable checkpoints before entitlement callbacks or result writes', async () => {
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce({
      checkpointId: 'checkpoint-1',
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      runStatus: 'complete',
      pendingToolCallId: 'toolu-1',
      conversationSnapshot: {},
      agentState: {},
      providerRequest: {
        billing: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          source: 'copilot',
          cumulativeUsage: {},
        },
      },
      resumeEventStartSeq: null,
      toolCalls: [],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'toolu-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'run_not_resumable',
      status: 'complete',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects duplicate resume producers while a checkpoint is already resuming', async () => {
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce({
      checkpointId: 'checkpoint-1',
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      runStatus: 'resuming',
      pendingToolCallId: 'toolu-1',
      conversationSnapshot: {},
      agentState: {},
      providerRequest: validResumeProviderRequest(),
      resumeEventStartSeq: 3,
      toolCalls: [],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'toolu-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'run_not_resumable',
      status: 'resuming',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects resume requests without a durable workspace even when request supplies one', async () => {
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce({
      checkpointId: 'checkpoint-1',
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      workspaceId: null,
      runStatus: 'paused_waiting_for_tool',
      pendingToolCallId: 'toolu-1',
      conversationSnapshot: {},
      agentState: {},
      providerRequest: validResumeProviderRequest(),
      resumeEventStartSeq: null,
      toolCalls: [],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          workspaceId: 'spoofed-workspace',
          results: [{ callId: 'toolu-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'resume_workspace_required',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects malformed resume provider requests before entitlement callbacks or result writes', async () => {
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce({
      checkpointId: 'checkpoint-1',
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      runStatus: 'paused_waiting_for_tool',
      pendingToolCallId: 'toolu-1',
      conversationSnapshot: {},
      agentState: {},
      providerRequest: {},
      resumeEventStartSeq: null,
      toolCalls: [],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'toolu-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'owned_provider_resume_request_missing',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects malformed stored workflow subagent context before entitlement callbacks or result writes', async () => {
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce({
      checkpointId: 'checkpoint-1',
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      runStatus: 'paused_waiting_for_tool',
      pendingToolCallId: 'call-1',
      conversationSnapshot: {},
      agentState: {},
      providerRequest: {
        ...validOpenAIResumeProviderRequest(),
        workflowSubagentContext: {
          chatId: RUNTIME_CHAT_ID,
          message: 'hello',
        },
      },
      resumeEventStartSeq: null,
      toolCalls: [],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'call-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'owned_provider_resume_request_missing',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
    expect(mockExecuteWorkflowSubagentCallback).not.toHaveBeenCalled()
  })

  it('rejects malformed OpenAI resume provider requests before entitlement callbacks or result writes', async () => {
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce({
      checkpointId: 'checkpoint-1',
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      runStatus: 'paused_waiting_for_tool',
      pendingToolCallId: 'call-1',
      conversationSnapshot: {},
      agentState: {},
      providerRequest: {
        provider: 'openai',
        model: 'gpt-4.1',
        executionId: 'exec-1',
        request: {
          model: 'gpt-4.1',
          stream: true,
          input: [{ role: 'user', content: 'inspect workflow' }],
        },
        outputItems: [],
      },
      resumeEventStartSeq: null,
      toolCalls: [],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'call-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'owned_provider_resume_request_missing',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects OpenAI resume provider requests without matching tool definitions before writes', async () => {
    const providerRequest = {
      ...validOpenAIResumeProviderRequest(),
      request: {
        model: 'gpt-4.1',
        stream: true,
        input: [{ role: 'user', content: 'inspect workflow' }],
      },
    }
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce({
      checkpointId: 'checkpoint-1',
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      runStatus: 'paused_waiting_for_tool',
      pendingToolCallId: 'call-1',
      conversationSnapshot: {},
      agentState: {},
      providerRequest,
      resumeEventStartSeq: null,
      toolCalls: [],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'call-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'owned_provider_resume_request_missing',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects OpenAI resume provider requests with model drift before writes', async () => {
    const providerRequest = validOpenAIResumeProviderRequest()
    providerRequest.request = {
      ...providerRequest.request,
      model: 'gpt-4o',
    }
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce({
      checkpointId: 'checkpoint-1',
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      runStatus: 'paused_waiting_for_tool',
      pendingToolCallId: 'call-1',
      conversationSnapshot: {},
      agentState: {},
      providerRequest,
      resumeEventStartSeq: null,
      toolCalls: [],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'call-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'owned_provider_resume_request_missing',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects OpenAI resume provider requests with unpriced models before writes', async () => {
    const providerRequest = validOpenAIResumeProviderRequest()
    providerRequest.model = 'gpt-unpriced'
    providerRequest.request = {
      ...providerRequest.request,
      model: 'gpt-unpriced',
    }
    mockGetMothershipResumeCheckpoint.mockResolvedValueOnce({
      checkpointId: 'checkpoint-1',
      runId: RUNTIME_RUN_ID,
      streamId: 'stream-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      runStatus: 'paused_waiting_for_tool',
      pendingToolCallId: 'call-1',
      conversationSnapshot: {},
      agentState: {},
      providerRequest,
      resumeEventStartSeq: null,
      toolCalls: [],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'call-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'owned_provider_resume_request_missing',
    })
    expect(mockValidateMothershipApiKeyEntitlement).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects resume requests when entitlement callback is misconfigured before writes', async () => {
    mockValidateMothershipApiKeyEntitlement.mockResolvedValueOnce({
      status: 'misconfigured',
      missing: ['SIM_BASE_URL'],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'toolu-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(503)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'sim_callback_not_configured',
      missing: ['SIM_BASE_URL'],
    })
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('rejects resume requests when entitlement callback errors before writes', async () => {
    mockValidateMothershipApiKeyEntitlement.mockResolvedValueOnce({
      status: 'callback_error',
      error: new Error('callback down'),
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'toolu-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(502)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'api_key_validation_callback_failed',
    })
    expect(mockRecordMothershipResumeToolResults).not.toHaveBeenCalled()
  })

  it('returns conflict when resume results conflict with durable state', async () => {
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'result_conflict',
      checkpoint: {},
      toolCallIds: ['tool-1'],
    })
    const handler = createMothershipHandler(TEST_ENV)
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [{ callId: 'tool-1', name: 'read_workflow', success: true }],
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(await readJson(response)).toMatchObject({
      success: false,
      code: 'result_conflict',
      toolCallIds: ['tool-1'],
    })
  })

  it('continues owned Anthropic streams after recording resume tool results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":11}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Workflow looks healthy."}}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: {
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          executionId: 'exec-1',
          billing: {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            source: 'copilot',
            cumulativeUsage: {
              input_tokens: 5,
              output_tokens: 8,
            },
          },
          request: {
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            stream: true,
            messages: [{ role: 'user', content: 'inspect workflow' }],
            tools: [
              {
                name: 'read_workflow',
                description: 'Read a workflow',
                input_schema: {
                  type: 'object',
                  properties: { workflowId: { type: 'string' } },
                  required: ['workflowId'],
                },
              },
            ],
          },
          assistantContent: [
            { type: 'text', text: 'I will check.' },
            {
              type: 'tool_use',
              id: 'toolu-1',
              name: 'read_workflow',
              input: { workflowId: 'workflow-1' },
            },
          ],
        },
      },
      recordedResults: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-resume-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [
            { callId: 'toolu-1', name: 'read_workflow', data: { ok: true }, success: true },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('x-request-id')).toBe('req-resume-1')
    expect(mockGetLatestMothershipRunEventSeq).not.toHaveBeenCalled()
    expect(mockGetOrSetMothershipResumeEventStartSeq).not.toHaveBeenCalled()
    expect(mockRecordMothershipResumeToolResults).toHaveBeenCalledWith({
      streamId: 'stream-1',
      checkpointId: 'checkpoint-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      results: [{ callId: 'toolu-1', name: 'read_workflow', data: { ok: true }, success: true }],
    })
    const events = await readSseData(response)
    expect(mockMarkMothershipResumeToolResultDelivered).toHaveBeenCalledWith({
      checkpointId: 'checkpoint-1',
      toolCallId: 'toolu-1',
    })
    expect(events).toHaveLength(4)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 4,
      type: 'run',
      stream: { streamId: 'stream-1', cursor: '4' },
      trace: { requestId: 'req-resume-1' },
      payload: { kind: 'resumed' },
    })
    expect(events[1]).toMatchObject({
      v: 1,
      seq: 5,
      type: 'tool',
      stream: { streamId: 'stream-1', cursor: '5' },
      trace: { requestId: 'req-resume-1' },
      payload: {
        phase: 'result',
        toolCallId: 'toolu-1',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        success: true,
        status: 'success',
        output: { ok: true },
      },
    })
    expect(mockMarkMothershipResumeToolResultDelivered).toHaveBeenCalledWith({
      checkpointId: 'checkpoint-1',
      toolCallId: 'toolu-1',
    })
    expect(events[2]).toMatchObject({
      v: 1,
      seq: 6,
      type: 'text',
      stream: { streamId: 'stream-1', cursor: '6' },
      trace: { requestId: 'req-resume-1' },
      payload: {
        channel: 'assistant',
        text: 'Workflow looks healthy.',
      },
    })
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'complete',
      stream: { streamId: 'stream-1', cursor: '7' },
      trace: { requestId: 'req-resume-1' },
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 16,
          output_tokens: 13,
          total_tokens: 29,
          model: 'claude-opus-4-8',
        },
        cost: {
          input: 0.00008,
          output: 0.000325,
          total: 0.000405,
        },
      },
    })
    expect(mockMarkMothershipRunComplete).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockMarkMothershipResumeToolResultDelivered.mock.invocationCallOrder[0]!).toBeLessThan(
      mockMarkMothershipRunComplete.mock.invocationCallOrder[0]!
    )
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'claude-opus-4-8',
      inputTokens: 16,
      outputTokens: 13,
      cost: 0.000405,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:anthropic',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody.messages).toEqual([
      { role: 'user', content: 'inspect workflow' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will check.' },
          {
            type: 'tool_use',
            id: 'toolu-1',
            name: 'read_workflow',
            input: { workflowId: 'workflow-1' },
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu-1',
            content: '{"ok":true}',
          },
        ],
      },
    ])
  })

  it('continues Anthropic resume streams through a workflow subagent callback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":7}}}',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu-workflow-2","name":"workflow","input":{}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"prompt\\": \\"fix this resumed workflow\\"}"}}',
          'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":6}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
      .mockResolvedValueOnce(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":3}}}',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Workflow fixed after resume."}}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":4}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockExecuteWorkflowSubagentCallback.mockResolvedValue({
      status: 'ok',
      response: {
        success: true,
        result: {
          status: 'completed',
          summary: 'Updated the resumed workflow.',
          changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
          artifacts: [],
        },
        streamEvents: [
          {
            v: 1,
            seq: 42,
            ts: '2026-06-21T00:00:00.000Z',
            stream: { streamId: 'child-stream', cursor: '42' },
            scope: {
              lane: 'subagent',
              agentId: 'workflow',
              parentToolCallId: 'toolu-workflow-2',
              spanId: 'child-span-1',
            },
            type: 'text',
            payload: { channel: 'assistant', text: 'Inspecting resumed workflow.' },
          },
        ],
      },
    })
    const storedProviderRequest = validResumeProviderRequest()
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: {
          ...storedProviderRequest,
          workflowSubagentContext: validWorkflowSubagentResumeContext(),
          request: {
            ...storedProviderRequest.request,
            tools: [
              {
                name: 'read_workflow',
                description: 'Read a workflow',
                input_schema: {
                  type: 'object',
                  properties: { workflowId: { type: 'string' } },
                  required: ['workflowId'],
                },
              },
              {
                name: 'workflow',
                description: 'Run the workflow subagent',
                input_schema: {
                  type: 'object',
                  properties: { prompt: { type: 'string' } },
                },
              },
            ],
          },
        },
      },
      recordedResults: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-resume-subagent-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [
            { callId: 'toolu-1', name: 'read_workflow', data: { ok: true }, success: true },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(7)
    expect(events[0]).toMatchObject({
      type: 'run',
      payload: { kind: 'resumed' },
    })
    expect(events[1]).toMatchObject({
      type: 'tool',
      payload: {
        phase: 'result',
        toolCallId: 'toolu-1',
        toolName: 'read_workflow',
        executor: 'sim',
        success: true,
        status: 'success',
      },
    })
    expect(events[2]).toMatchObject({
      type: 'tool',
      payload: {
        phase: 'call',
        toolCallId: 'toolu-workflow-2',
        toolName: 'workflow',
        executor: 'go',
        arguments: { prompt: 'fix this resumed workflow' },
        status: 'executing',
      },
    })
    expect(events[3]).toMatchObject({
      type: 'text',
      scope: {
        lane: 'subagent',
        agentId: 'workflow',
        parentToolCallId: 'toolu-workflow-2',
        spanId: 'child-span-1',
      },
      payload: { channel: 'assistant', text: 'Inspecting resumed workflow.' },
    })
    expect(events[4]).toMatchObject({
      type: 'tool',
      payload: {
        phase: 'result',
        toolCallId: 'toolu-workflow-2',
        toolName: 'workflow',
        executor: 'go',
        success: true,
        status: 'success',
        output: {
          status: 'completed',
          summary: 'Updated the resumed workflow.',
          changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
          artifacts: [],
        },
      },
    })
    expect(events[4].payload).not.toHaveProperty('ui')
    expect(events[5]).toMatchObject({
      type: 'text',
      payload: { channel: 'assistant', text: 'Workflow fixed after resume.' },
    })
    expect(events[6]).toMatchObject({
      type: 'complete',
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 10,
          output_tokens: 10,
          total_tokens: 20,
          model: 'claude-opus-4-8',
        },
      },
    })
    expect(mockExecuteWorkflowSubagentCallback).toHaveBeenCalledWith({
      env: expect.objectContaining({ SIM_BASE_URL: 'http://sim.local' }),
      request: {
        runId: RUNTIME_RUN_ID,
        streamId: 'stream-1',
        chatId: RUNTIME_CHAT_ID,
        userId: 'user-1',
        workspaceId: 'workspace-1',
        parentToolCallId: 'toolu-workflow-2',
        model: 'claude-opus-4-8',
        provider: 'anthropic',
        depth: 0,
        input: {
          prompt: 'fix this resumed workflow',
          workflowId: 'workflow-1',
        },
        context: {
          messages: [{ role: 'user', content: 'hello' }],
          resources: [{ type: 'workflow', id: 'workflow-1', title: 'Support workflow' }],
          workflowId: 'workflow-1',
        },
        limits: {
          maxDepth: 1,
          maxProviderRounds: 8,
          maxChildToolCalls: 30,
        },
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const subagentContinuationBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string)
    expect(subagentContinuationBody.messages.at(-1)).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu-workflow-2',
          content: JSON.stringify({
            status: 'completed',
            summary: 'Updated the resumed workflow.',
            changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
            artifacts: [],
          }),
        },
      ],
    })
  })

  it('does not start provider work when reserved resume sequence append conflicts', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mockAppendMothershipRunEvents.mockRejectedValueOnce(new Error('resume sequence conflict'))
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: validResumeProviderRequest(),
      },
      recordedResults: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [
            { callId: 'toolu-1', name: 'read_workflow', data: { ok: true }, success: true },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.text()).rejects.toThrow('resume sequence conflict')
    expect(mockMarkMothershipRunPausedForTool).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
  })

  it('keeps resume runs retryable when provider stream fails with retry flag', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":11}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"partial"}}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: validResumeProviderRequest(),
      },
      recordedResults: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-resume-retry-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [
            { callId: 'toolu-1', name: 'read_workflow', data: { ok: true }, success: true },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.text()).rejects.toThrow('Anthropic stream ended before message_stop')
    expect(mockMarkMothershipRunPausedForTool).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockMarkMothershipResumeToolResultDelivered).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
  })

  it('resumes BYOK Anthropic checkpoints with BYOK credentials and zero hosted billing', async () => {
    mockGetMothershipByokProviderKey.mockResolvedValueOnce({
      workspaceId: 'workspace-1',
      provider: 'anthropic',
      apiKey: 'byok-anthropic-secret',
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":11}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Workflow still looks healthy."}}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: {
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          executionId: 'exec-1',
          billing: {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            source: 'copilot',
            credentialSource: 'byok',
            cumulativeUsage: {
              input_tokens: 5,
              output_tokens: 8,
            },
          },
          request: {
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            stream: true,
            messages: [{ role: 'user', content: 'inspect workflow' }],
            tools: [
              {
                name: 'read_workflow',
                description: 'Read a workflow',
                input_schema: {
                  type: 'object',
                  properties: { workflowId: { type: 'string' } },
                  required: ['workflowId'],
                },
              },
            ],
          },
          assistantContent: [
            { type: 'text', text: 'I will check.' },
            {
              type: 'tool_use',
              id: 'toolu-1',
              name: 'read_workflow',
              input: { workflowId: 'workflow-1' },
            },
          ],
        },
      },
      recordedResults: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler(TEST_ENV)

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-resume-byok-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [
            { callId: 'toolu-1', name: 'read_workflow', data: { ok: true }, success: true },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(4)
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'complete',
      stream: { streamId: 'stream-1', cursor: '7' },
      trace: { requestId: 'req-resume-byok-1' },
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 16,
          output_tokens: 13,
          total_tokens: 29,
          model: 'claude-opus-4-8',
        },
        cost: {
          input: 0,
          output: 0,
          total: 0,
        },
      },
    })
    expect(mockValidateMothershipByokEntitlement).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      signal: expect.any(AbortSignal),
    })
    expect(mockGetMothershipByokProviderKey).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      provider: 'anthropic',
      encryptionKey: TEST_ENV.ENCRYPTION_KEY,
    })
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'byok-anthropic-secret',
        }),
      })
    )
  })

  it('fails closed on BYOK Anthropic resume rejection without falling back to hosted credentials', async () => {
    mockValidateMothershipByokEntitlement.mockResolvedValueOnce({
      status: 'rejected',
      statusCode: 403,
      body: null,
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: {
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          executionId: 'exec-1',
          billing: {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            source: 'copilot',
            credentialSource: 'byok',
            cumulativeUsage: {
              input_tokens: 5,
              output_tokens: 8,
            },
          },
          request: {
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            stream: true,
            messages: [{ role: 'user', content: 'inspect workflow' }],
            tools: [
              {
                name: 'read_workflow',
                description: 'Read a workflow',
                input_schema: {
                  type: 'object',
                  properties: { workflowId: { type: 'string' } },
                  required: ['workflowId'],
                },
              },
            ],
          },
          assistantContent: [
            { type: 'text', text: 'I will check.' },
            {
              type: 'tool_use',
              id: 'toolu-1',
              name: 'read_workflow',
              input: { workflowId: 'workflow-1' },
            },
          ],
        },
      },
      recordedResults: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'hosted-anthropic-secret',
    })

    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-resume-byok-rejected-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [
            { callId: 'toolu-1', name: 'read_workflow', data: { ok: true }, success: true },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 4,
      type: 'error',
      stream: { streamId: 'stream-1', cursor: '4' },
      trace: { requestId: 'req-resume-byok-rejected-1' },
      payload: {
        code: 'owned_provider_error',
        message: 'Mothership BYOK callback failed with status 403',
      },
    })
    expect(mockGetMothershipByokProviderKey).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockReportMothershipBillingUsage).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunPausedForTool).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      error: 'owned_provider_error',
    })
  })

  it('continues owned Anthropic streams with failed resume tool results and bills cumulatively', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":7}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"I handled the failure."}}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: {
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          executionId: 'exec-1',
          billing: {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            source: 'copilot',
            cumulativeUsage: {
              input_tokens: 5,
              output_tokens: 8,
            },
          },
          request: {
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            stream: true,
            messages: [{ role: 'user', content: 'inspect workflow' }],
            tools: [
              {
                name: 'read_workflow',
                description: 'Read a workflow',
                input_schema: {
                  type: 'object',
                  properties: { workflowId: { type: 'string' } },
                  required: ['workflowId'],
                },
              },
            ],
          },
          assistantContent: [
            { type: 'text', text: 'I will check.' },
            {
              type: 'tool_use',
              id: 'toolu-1',
              name: 'read_workflow',
              input: { workflowId: 'workflow-1' },
            },
          ],
        },
      },
      recordedResults: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          status: 'failed',
          result: { error: 'Tool failed loudly' },
          error: 'Tool failed loudly',
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-resume-failed-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [
            {
              callId: 'toolu-1',
              name: 'read_workflow',
              data: { error: 'Tool failed loudly' },
              success: false,
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(4)
    expect(events[1]).toMatchObject({
      v: 1,
      seq: 5,
      type: 'tool',
      stream: { streamId: 'stream-1', cursor: '5' },
      trace: { requestId: 'req-resume-failed-1' },
      payload: {
        phase: 'result',
        toolCallId: 'toolu-1',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        success: false,
        status: 'error',
        error: 'Tool failed loudly',
      },
    })
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'complete',
      stream: { streamId: 'stream-1', cursor: '7' },
      trace: { requestId: 'req-resume-failed-1' },
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 12,
          output_tokens: 11,
          total_tokens: 23,
          model: 'claude-opus-4-8',
        },
        cost: {
          input: 0.00006,
          output: 0.000275,
          total: 0.000335,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'claude-opus-4-8',
      inputTokens: 12,
      outputTokens: 11,
      cost: 0.000335,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:anthropic',
    })
    expect(mockReportMothershipBillingUsage.mock.invocationCallOrder[0]!).toBeLessThan(
      mockAppendMothershipRunEvents.mock.invocationCallOrder[3]!
    )
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody.messages.at(-1)).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu-1',
          content: 'Tool failed loudly',
          is_error: true,
        },
      ],
    })
  })

  it('continues owned Anthropic streams with cancelled resume tool results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":9}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Tool cancellation noted."}}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":4}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: {
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          executionId: 'exec-1',
          billing: {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            source: 'copilot',
            cumulativeUsage: {
              input_tokens: 5,
              output_tokens: 8,
            },
          },
          request: {
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            stream: true,
            messages: [{ role: 'user', content: 'inspect workflow' }],
            tools: [
              {
                name: 'read_workflow',
                description: 'Read a workflow',
                input_schema: {
                  type: 'object',
                  properties: { workflowId: { type: 'string' } },
                  required: ['workflowId'],
                },
              },
            ],
          },
          assistantContent: [
            { type: 'text', text: 'I will check.' },
            {
              type: 'tool_use',
              id: 'toolu-1',
              name: 'read_workflow',
              input: { workflowId: 'workflow-1' },
            },
          ],
        },
      },
      recordedResults: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          status: 'cancelled',
          result: { cancelled: true },
          error: 'Tool cancelled',
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-resume-cancelled-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          results: [
            {
              callId: 'toolu-1',
              name: 'read_workflow',
              data: { cancelled: true },
              success: false,
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(4)
    expect(events[1]).toMatchObject({
      v: 1,
      seq: 5,
      type: 'tool',
      stream: { streamId: 'stream-1', cursor: '5' },
      trace: { requestId: 'req-resume-cancelled-1' },
      payload: {
        phase: 'result',
        toolCallId: 'toolu-1',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        success: false,
        status: 'cancelled',
        error: 'Tool cancelled',
        output: { cancelled: true },
      },
    })
    expect(events[2]).toMatchObject({
      v: 1,
      seq: 6,
      type: 'text',
      stream: { streamId: 'stream-1', cursor: '6' },
      trace: { requestId: 'req-resume-cancelled-1' },
      payload: {
        channel: 'assistant',
        text: 'Tool cancellation noted.',
      },
    })
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'complete',
      stream: { streamId: 'stream-1', cursor: '7' },
      trace: { requestId: 'req-resume-cancelled-1' },
      payload: {
        status: 'complete',
        usage: {
          input_tokens: 14,
          output_tokens: 12,
          total_tokens: 26,
          model: 'claude-opus-4-8',
        },
        cost: {
          input: 0.00007,
          output: 0.0003,
          total: 0.00037,
        },
      },
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'claude-opus-4-8',
      inputTokens: 14,
      outputTokens: 12,
      cost: 0.00037,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:anthropic',
    })
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
    expect(requestBody.messages.at(-1)).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu-1',
          content: 'Tool cancelled',
          is_error: true,
        },
      ],
    })
  })

  it('pauses again when an owned Anthropic resume returns another tool use', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        anthropicSseResponse([
          'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":13}}}',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu-2","name":"read_workflow","input":{}}}',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"workflowId\\": \\"workflow-2\\"}"}}',
          'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":6}}',
          'event: message_stop\ndata: {"type":"message_stop"}',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    mockCreateMothershipToolCheckpoint.mockResolvedValue({
      status: 'ready',
      checkpointId: 'checkpoint-2',
      pendingToolCallIds: ['toolu-2'],
    })
    mockRecordMothershipResumeToolResults.mockResolvedValue({
      status: 'ready',
      resumeEventStartSeq: 3,
      checkpoint: {
        checkpointId: 'checkpoint-1',
        runId: RUNTIME_RUN_ID,
        providerRequest: {
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          executionId: 'exec-1',
          billing: {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            source: 'copilot',
            cumulativeUsage: {
              input_tokens: 5,
              output_tokens: 8,
            },
          },
          request: {
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            stream: true,
            messages: [{ role: 'user', content: 'inspect workflow' }],
            tools: [
              {
                name: 'read_workflow',
                description: 'Read a workflow',
                input_schema: {
                  type: 'object',
                  properties: { workflowId: { type: 'string' } },
                  required: ['workflowId'],
                },
              },
            ],
          },
          assistantContent: [
            { type: 'text', text: 'I will check.' },
            {
              type: 'tool_use',
              id: 'toolu-1',
              name: 'read_workflow',
              input: { workflowId: 'workflow-1' },
            },
          ],
        },
      },
      recordedResults: [
        {
          toolCallId: 'toolu-1',
          toolName: 'read_workflow',
          status: 'completed',
          result: { ok: true },
          error: null,
        },
      ],
    })
    const handler = createMothershipHandler({
      ...TEST_ENV,
      MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
    })
    const response = await handler(
      new Request(`http://mothership.local${resumeToolsContract.path}`, {
        method: resumeToolsContract.method,
        headers: {
          'x-mothership-runtime-key': TEST_ENV.SIM_TO_MOTHERSHIP_API_KEY,
          'x-request-id': 'req-resume-chain-1',
        },
        body: JSON.stringify({
          streamId: 'stream-1',
          checkpointId: 'checkpoint-1',
          userId: 'user-1',
          willRetryOnStreamError: true,
          results: [
            { callId: 'toolu-1', name: 'read_workflow', data: { ok: true }, success: true },
          ],
        }),
      })
    )

    expect(response.status).toBe(200)
    const events = await readSseData(response)
    expect(events).toHaveLength(4)
    expect(events[0]).toMatchObject({
      v: 1,
      seq: 4,
      type: 'run',
      trace: { requestId: 'req-resume-chain-1' },
      payload: { kind: 'resumed' },
    })
    expect(events[1]).toMatchObject({
      v: 1,
      seq: 5,
      type: 'tool',
      trace: { requestId: 'req-resume-chain-1' },
      payload: {
        phase: 'result',
        toolCallId: 'toolu-1',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        success: true,
        status: 'success',
        output: { ok: true },
      },
    })
    expect(mockMarkMothershipResumeToolResultDelivered).toHaveBeenCalledWith({
      checkpointId: 'checkpoint-1',
      toolCallId: 'toolu-1',
    })
    expect(events[2]).toMatchObject({
      v: 1,
      seq: 6,
      type: 'tool',
      trace: { requestId: 'req-resume-chain-1' },
      payload: {
        phase: 'call',
        toolCallId: 'toolu-2',
        toolName: 'read_workflow',
        executor: 'sim',
        mode: 'async',
        arguments: { workflowId: 'workflow-2' },
        status: 'executing',
      },
    })
    expect(events[3]).toMatchObject({
      v: 1,
      seq: 7,
      type: 'run',
      trace: { requestId: 'req-resume-chain-1' },
      payload: {
        kind: 'checkpoint_pause',
        checkpointId: 'checkpoint-2',
        executionId: 'exec-1',
        runId: RUNTIME_RUN_ID,
        pendingToolCallIds: ['toolu-2'],
      },
    })
    expect(mockCreateMothershipToolCheckpoint).toHaveBeenCalledWith({
      runId: RUNTIME_RUN_ID,
      pendingToolCalls: [
        {
          toolCallId: 'toolu-2',
          toolName: 'read_workflow',
          args: { workflowId: 'workflow-2' },
        },
      ],
      conversationSnapshot: {
        messages: expect.arrayContaining([
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu-1',
                content: '{"ok":true}',
              },
            ],
          },
        ]),
        assistantContent: [
          {
            type: 'tool_use',
            id: 'toolu-2',
            name: 'read_workflow',
            input: { workflowId: 'workflow-2' },
          },
        ],
      },
      agentState: {
        provider: 'anthropic',
        stopReason: 'tool_use',
      },
      providerRequest: expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-opus-4-8',
        executionId: 'exec-1',
        billing: {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          source: 'copilot',
          credentialSource: 'hosted',
          cumulativeUsage: {
            input_tokens: 18,
            output_tokens: 14,
          },
        },
        assistantContent: [
          {
            type: 'tool_use',
            id: 'toolu-2',
            name: 'read_workflow',
            input: { workflowId: 'workflow-2' },
          },
        ],
      }),
    })
    expect(mockReportMothershipBillingUsage).toHaveBeenCalledWith({
      env: expect.objectContaining({
        SIM_BASE_URL: 'http://sim.local',
      }),
      userId: 'user-1',
      workspaceId: 'workspace-1',
      source: 'copilot',
      model: 'claude-opus-4-8',
      inputTokens: 18,
      outputTokens: 14,
      cost: 0.00044,
      idempotencyKey: 'mothership-run:22222222-2222-4222-8222-222222222222:anthropic',
    })
    expect(mockMarkMothershipRunPausedForTool).toHaveBeenCalledWith({ runId: RUNTIME_RUN_ID })
    expect(mockMarkMothershipResumeToolResultDelivered.mock.invocationCallOrder[0]!).toBeLessThan(
      mockMarkMothershipRunPausedForTool.mock.invocationCallOrder[0]!
    )
    expect(mockMarkMothershipRunComplete).not.toHaveBeenCalled()
    expect(mockMarkMothershipRunFailed).not.toHaveBeenCalled()
  })
})

describe('mothership node server', () => {
  const servers: ReturnType<typeof createMothershipNodeServer>[] = []

  afterEach(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve())
          })
      )
    )
    servers.length = 0
  })

  it('boots and serves health over HTTP', async () => {
    const server = createMothershipNodeServer(createMothershipApp(TEST_ENV))
    servers.push(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('expected TCP listener address')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`)
    expect(response.status).toBe(200)
    expect(await readJson(response)).toMatchObject({
      ok: true,
      service: 'mothership',
    })
  })

  it('propagates request id on adapter-level errors', async () => {
    const state = { shuttingDown: false }
    const server = createMothershipNodeServer({
      state,
      handler: async () => {
        throw new Error('handler failed')
      },
      startShutdown: () => {
        state.shuttingDown = true
      },
    })
    servers.push(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('expected TCP listener address')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
      headers: { 'x-request-id': 'req-error-1' },
    })
    expect(response.status).toBe(500)
    expect(response.headers.get('x-request-id')).toBe('req-error-1')
    expect(await readJson(response)).toMatchObject({
      ok: false,
      error: 'Internal server error',
      requestId: 'req-error-1',
    })
  })

  it('streams response chunks without waiting for body completion', async () => {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    let releaseSecondChunk!: () => void
    const secondChunkReady = new Promise<void>((resolve) => {
      releaseSecondChunk = resolve
    })
    const state = { shuttingDown: false }
    const server = createMothershipNodeServer({
      state,
      handler: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              controller.enqueue(encoder.encode('first\n'))
              await secondChunkReady
              controller.enqueue(encoder.encode('second\n'))
              controller.close()
            },
          }),
          {
            headers: { 'content-type': 'text/plain' },
          }
        ),
      startShutdown: () => {
        state.shuttingDown = true
      },
    })
    servers.push(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('expected TCP listener address')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/stream`)
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('expected response body')
    }

    const first = await reader.read()
    expect(first.done).toBe(false)
    expect(decoder.decode(first.value)).toBe('first\n')

    releaseSecondChunk()
    const second = await reader.read()
    expect(second.done).toBe(false)
    expect(decoder.decode(second.value)).toBe('second\n')
    expect(await reader.read()).toEqual({ done: true, value: undefined })
  })

  it('rejects oversized declared request bodies before handler dispatch', async () => {
    const server = createMothershipNodeServer(createMothershipApp(TEST_ENV))
    servers.push(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('expected TCP listener address')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/unknown`, {
      method: 'POST',
      headers: { 'x-request-id': 'req-too-large-1' },
      body: 'x'.repeat(MAX_REQUEST_BODY_BYTES + 1),
    })

    expect(response.status).toBe(413)
    expect(response.headers.get('x-request-id')).toBe('req-too-large-1')
    expect(await readJson(response)).toMatchObject({
      ok: false,
      error: 'Request body too large',
      requestId: 'req-too-large-1',
    })
  })

  it('rejects oversized request bodies when a route consumes the body', async () => {
    const state = { shuttingDown: false }
    const server = createMothershipNodeServer({
      state,
      handler: async (request) => {
        await request.text()
        return Response.json({ ok: true })
      },
      startShutdown: () => {
        state.shuttingDown = true
      },
    })
    servers.push(server)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('expected TCP listener address')
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/body`, {
      method: 'POST',
      headers: { 'x-request-id': 'req-too-large-2' },
      body: 'x'.repeat(MAX_REQUEST_BODY_BYTES + 1),
    })

    expect(response.status).toBe(413)
    expect(response.headers.get('x-request-id')).toBe('req-too-large-2')
    expect(await readJson(response)).toMatchObject({
      ok: false,
      error: 'Request body too large',
      requestId: 'req-too-large-2',
    })
  })
})
