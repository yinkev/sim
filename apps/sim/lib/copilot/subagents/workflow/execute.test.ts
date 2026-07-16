/**
 * @vitest-environment node
 */
import { WORKFLOW_SUBAGENT_SPEC } from '@sim/mothership-contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { runHeadlessCopilotLifecycle as RunHeadlessCopilotLifecycle } from '@/lib/copilot/request/lifecycle/headless'
import type { OrchestratorResult } from '@/lib/copilot/request/types'

const {
  mockAssertActiveWorkspaceAccess,
  mockAuthorizeWorkflowByWorkspacePermission,
  mockGetUserEntityPermissions,
  mockRunHeadlessCopilotLifecycle,
} = vi.hoisted(() => ({
  mockAssertActiveWorkspaceAccess: vi.fn(),
  mockAuthorizeWorkflowByWorkspacePermission: vi.fn(),
  mockGetUserEntityPermissions: vi.fn(),
  mockRunHeadlessCopilotLifecycle: vi.fn(),
}))

vi.mock('@sim/workflow-authz', () => ({
  authorizeWorkflowByWorkspacePermission: mockAuthorizeWorkflowByWorkspacePermission,
}))

vi.mock('@/lib/workspaces/permissions/utils', () => ({
  assertActiveWorkspaceAccess: mockAssertActiveWorkspaceAccess,
  getUserEntityPermissions: mockGetUserEntityPermissions,
}))

vi.mock('@/lib/copilot/request/lifecycle/headless', () => ({
  runHeadlessCopilotLifecycle: mockRunHeadlessCopilotLifecycle,
}))

import { executeWorkflowSubagent } from './execute'

type HeadlessPayload = Parameters<typeof RunHeadlessCopilotLifecycle>[0]
type HeadlessOptions = Parameters<typeof RunHeadlessCopilotLifecycle>[1]

const validBody = {
  runId: '11111111-1111-4111-8111-111111111111',
  streamId: 'parent-stream-1',
  chatId: 'chat-1',
  userId: 'user-1',
  workspaceId: 'workspace-1',
  parentToolCallId: 'parent-tool-call-1',
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

function lifecycleResult(overrides?: Partial<OrchestratorResult>): OrchestratorResult {
  return {
    success: true,
    content: 'Inspected and fixed the workflow.',
    contentBlocks: [],
    toolCalls: [],
    chatId: 'chat-1',
    ...overrides,
  }
}

describe('executeWorkflowSubagent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssertActiveWorkspaceAccess.mockResolvedValue({
      exists: true,
      hasAccess: true,
      canWrite: true,
      workspace: { id: 'workspace-1' },
    })
    mockAuthorizeWorkflowByWorkspacePermission.mockResolvedValue({
      allowed: true,
      status: 200,
      workflow: { id: 'workflow-1', workspaceId: 'workspace-1' },
      workspacePermission: 'write',
    })
    mockGetUserEntityPermissions.mockResolvedValue('write')
    mockRunHeadlessCopilotLifecycle.mockResolvedValue(lifecycleResult())
  })

  it('runs a child headless Mothership lifecycle with only workflow child tools', async () => {
    mockRunHeadlessCopilotLifecycle.mockImplementationOnce(
      async (payload: HeadlessPayload, options: HeadlessOptions) => {
        await options.onEvent?.({
          type: 'text',
          payload: { channel: 'assistant', text: 'Inspecting workflow.' },
        })
        await options.onEvent?.({
          type: 'complete',
          payload: { status: 'complete' },
        })
        return lifecycleResult({
          toolCalls: [
            {
              id: 'tool-1',
              name: 'edit_workflow',
              status: 'success',
              params: { workflowId: 'workflow-1' },
              result: { ok: true },
            },
          ],
        })
      }
    )

    const result = await executeWorkflowSubagent(validBody)

    expect(result).toMatchObject({
      success: true,
      result: {
        status: 'completed',
        summary: 'Inspected and fixed the workflow.',
        changedResources: [{ type: 'workflow', id: 'workflow-1', action: 'updated' }],
      },
    })
    expect(result.streamEvents.map((event) => event.type)).toEqual(['span', 'text', 'span'])
    expect(result.streamEvents[1]).toMatchObject({
      type: 'text',
      scope: {
        lane: 'subagent',
        agentId: 'workflow',
        parentToolCallId: 'parent-tool-call-1',
      },
      payload: { channel: 'assistant', text: 'Inspecting workflow.' },
    })

    const [payload, options] = mockRunHeadlessCopilotLifecycle.mock.calls[0] as [
      HeadlessPayload,
      HeadlessOptions,
    ]
    const toolNames = (payload.mothershipTools as Array<{ name: string }>).map((tool) => tool.name)
    expect(toolNames).toEqual([...WORKFLOW_SUBAGENT_SPEC.allowedChildTools])
    expect(toolNames).not.toContain('workflow')
    expect(payload).toMatchObject({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      chatId: 'chat-1',
      workflowId: 'workflow-1',
      parentRunId: '11111111-1111-4111-8111-111111111111',
      parentToolCallId: 'parent-tool-call-1',
      model: 'claude-opus-4-8',
      provider: 'anthropic',
      mode: 'agent',
    })
    expect(payload.runId).not.toBe('11111111-1111-4111-8111-111111111111')
    expect(options).toMatchObject({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      chatId: 'chat-1',
      workflowId: 'workflow-1',
      goRoute: '/api/mothership',
      autoExecuteTools: true,
      interactive: false,
    })
  })

  it('does not run the child lifecycle when workspace access fails', async () => {
    mockAssertActiveWorkspaceAccess.mockRejectedValueOnce(new Error('Workspace access denied'))

    const result = await executeWorkflowSubagent(validBody)

    expect(result).toEqual({
      success: false,
      code: 'workflow_subagent_workspace_access_denied',
      error: 'Workspace access denied',
      retryable: false,
      streamEvents: [],
    })
    expect(mockRunHeadlessCopilotLifecycle).not.toHaveBeenCalled()
  })

  it('does not run the child lifecycle when workflow access fails', async () => {
    mockAuthorizeWorkflowByWorkspacePermission.mockResolvedValueOnce({
      allowed: false,
      status: 403,
      message: 'Unauthorized workflow access',
      workflow: { id: 'workflow-1', workspaceId: 'workspace-1' },
      workspacePermission: 'read',
    })

    const result = await executeWorkflowSubagent(validBody)

    expect(result).toEqual({
      success: false,
      code: 'workflow_subagent_workflow_access_denied',
      error: 'Unauthorized workflow access',
      retryable: false,
      streamEvents: [],
    })
    expect(mockRunHeadlessCopilotLifecycle).not.toHaveBeenCalled()
  })

  it('returns needs_input without running the child lifecycle when no task is provided', async () => {
    const result = await executeWorkflowSubagent({
      ...validBody,
      input: { workflowId: 'workflow-1' },
      context: {
        workflowId: 'workflow-1',
        messages: [],
        resources: [],
      },
    })

    expect(result).toEqual({
      success: true,
      result: {
        status: 'needs_input',
        reason: 'ambiguous_instruction',
        summary: 'Workflow subagent needs a concrete workflow task before it can act.',
        prompt: 'What workflow should I inspect, change, or run?',
      },
      streamEvents: [],
    })
    expect(mockRunHeadlessCopilotLifecycle).not.toHaveBeenCalled()
  })

  it('returns needs_input when a child tool fails for missing permission', async () => {
    mockRunHeadlessCopilotLifecycle.mockResolvedValueOnce(
      lifecycleResult({
        success: false,
        content: '',
        error: 'Tool failed',
        toolCalls: [
          {
            id: 'tool-1',
            name: 'edit_workflow',
            status: 'error',
            error:
              "Permission denied: 'edit' on edit_workflow requires write access. You have 'read' permission.",
          },
        ],
      })
    )

    const result = await executeWorkflowSubagent(validBody)

    expect(result).toMatchObject({
      success: true,
      result: {
        status: 'needs_input',
        reason: 'missing_permission',
        summary:
          "Permission denied: 'edit' on edit_workflow requires write access. You have 'read' permission.",
      },
    })
    expect(result.streamEvents.map((event) => event.type)).toEqual(['span', 'span'])
    expect(result.streamEvents.at(-1)?.payload).toMatchObject({
      data: {
        status: 'needs_input',
        reason: 'missing_permission',
      },
    })
  })

  it('returns needs_input when a destructive child tool is cancelled', async () => {
    mockRunHeadlessCopilotLifecycle.mockResolvedValueOnce(
      lifecycleResult({
        content: 'The delete action needs confirmation.',
        toolCalls: [
          {
            id: 'tool-1',
            name: 'delete_folder',
            status: 'cancelled',
            params: { folderId: 'folder-1' },
            error: 'User cancelled delete_folder before execution.',
          },
        ],
      })
    )

    const result = await executeWorkflowSubagent(validBody)

    expect(result).toMatchObject({
      success: true,
      result: {
        status: 'needs_input',
        reason: 'destructive_action',
        summary: 'User cancelled delete_folder before execution.',
        prompt: 'Confirm whether I should continue with the destructive delete_folder action.',
      },
    })
  })

  it('returns needs_input when a child tool is still awaiting confirmation', async () => {
    mockRunHeadlessCopilotLifecycle.mockResolvedValueOnce(
      lifecycleResult({
        content: 'Waiting for tool confirmation.',
        toolCalls: [
          {
            id: 'tool-1',
            name: 'run_workflow',
            status: 'pending',
            params: { workflowId: 'workflow-1' },
          },
        ],
      })
    )

    const result = await executeWorkflowSubagent(validBody)

    expect(result).toMatchObject({
      success: true,
      result: {
        status: 'needs_input',
        reason: 'tool_confirmation',
        summary: 'Workflow child tool run_workflow needs input before it can continue.',
        prompt:
          'Confirm or revise the run_workflow tool action so the workflow subagent can continue.',
      },
    })
  })

  it('aborts and returns a contract failure when the child tool limit is exceeded', async () => {
    let capturedOptions: HeadlessOptions | undefined
    mockRunHeadlessCopilotLifecycle.mockImplementationOnce(
      async (_payload: HeadlessPayload, options: HeadlessOptions) => {
        capturedOptions = options
        await options.onEvent?.({
          type: 'tool',
          payload: {
            phase: 'call',
            toolCallId: 'tool-1',
            toolName: 'edit_workflow',
            executor: 'sim',
            mode: 'async',
            arguments: { workflowId: 'workflow-1' },
            status: 'executing',
          },
        })
        await options.onEvent?.({
          type: 'tool',
          payload: {
            phase: 'call',
            toolCallId: 'tool-2',
            toolName: 'query_logs',
            executor: 'sim',
            mode: 'async',
            arguments: { workflowId: 'workflow-1' },
            status: 'executing',
          },
        })
        return lifecycleResult()
      }
    )

    const result = await executeWorkflowSubagent({
      ...validBody,
      limits: {
        ...validBody.limits,
        maxChildToolCalls: 1,
      },
    })

    expect(result).toMatchObject({
      success: false,
      code: 'workflow_subagent_child_tool_limit_exceeded',
      retryable: false,
    })
    expect(capturedOptions?.abortSignal?.aborted).toBe(true)
    expect(result.streamEvents.map((event) => event.type)).toEqual(['span', 'tool', 'span'])
  })

  it('aborts when the child lifecycle attempts a disallowed tool', async () => {
    let capturedOptions: HeadlessOptions | undefined
    mockRunHeadlessCopilotLifecycle.mockImplementationOnce(
      async (_payload: HeadlessPayload, options: HeadlessOptions) => {
        capturedOptions = options
        await options.onEvent?.({
          type: 'tool',
          payload: {
            phase: 'call',
            toolCallId: 'tool-1',
            toolName: 'workflow',
            executor: 'go',
            mode: 'async',
            arguments: { prompt: 'nested subagent' },
            status: 'executing',
          },
        })
        return lifecycleResult()
      }
    )

    const result = await executeWorkflowSubagent(validBody)

    expect(result).toMatchObject({
      success: false,
      code: 'workflow_subagent_disallowed_child_tool',
      error: 'Workflow subagent attempted disallowed child tool: workflow',
    })
    expect(capturedOptions?.abortSignal?.aborted).toBe(true)
    expect(result.streamEvents.map((event) => event.type)).toEqual(['span', 'span'])
  })

  it('aborts when provider rounds exceed the callback limit', async () => {
    let capturedOptions: HeadlessOptions | undefined
    mockRunHeadlessCopilotLifecycle.mockImplementationOnce(
      async (_payload: HeadlessPayload, options: HeadlessOptions) => {
        capturedOptions = options
        await options.onEvent?.({
          type: 'run',
          payload: {
            kind: 'checkpoint_pause',
            checkpointId: 'checkpoint-1',
            pendingToolCallIds: ['tool-1'],
          },
        })
        return lifecycleResult()
      }
    )

    const result = await executeWorkflowSubagent({
      ...validBody,
      limits: {
        ...validBody.limits,
        maxProviderRounds: 1,
      },
    })

    expect(result).toMatchObject({
      success: false,
      code: 'workflow_subagent_provider_round_limit_exceeded',
      error: 'Workflow subagent exceeded maxProviderRounds (1)',
    })
    expect(capturedOptions?.abortSignal?.aborted).toBe(true)
    expect(result.streamEvents.map((event) => event.type)).toEqual(['span', 'span'])
  })
})
