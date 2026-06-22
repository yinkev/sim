import { createLogger } from '@sim/logger'
import { WORKFLOW_SUBAGENT_SPEC } from '@sim/mothership-contracts'
import type {
  WorkflowSubagentChangedResource,
  WorkflowSubagentExecuteRequest,
  WorkflowSubagentExecuteResponse,
  WorkflowSubagentResult,
} from '@sim/mothership-contracts/routes'
import { getErrorMessage } from '@sim/utils/errors'
import { generateId } from '@sim/utils/id'
import { isRecordLike } from '@sim/utils/object'
import { authorizeWorkflowByWorkspacePermission } from '@sim/workflow-authz'
import type { ToolSchema } from '@/lib/copilot/chat/payload'
import { TOOL_CATALOG } from '@/lib/copilot/generated/tool-catalog-v1'
import { runHeadlessCopilotLifecycle } from '@/lib/copilot/request/lifecycle/headless'
import type { OrchestratorResult, StreamEvent, ToolCallSummary } from '@/lib/copilot/request/types'
import {
  assertActiveWorkspaceAccess,
  getUserEntityPermissions,
} from '@/lib/workspaces/permissions/utils'

type CallbackStreamEvent = WorkflowSubagentExecuteResponse['streamEvents'][number]

const logger = createLogger('WorkflowSubagentExecutor')
const CHILD_AGENT_ROUTE = '/api/mothership'
const NON_FORWARDABLE_CHILD_EVENT_TYPES = new Set(['complete', 'error', 'run', 'session'])
const ALLOWED_CHILD_TOOL_SET = new Set<string>(WORKFLOW_SUBAGENT_SPEC.allowedChildTools)
const DESTRUCTIVE_CHILD_TOOL_SET = new Set<string>(['delete_folder'])

const CHILD_TOOL_DESCRIPTIONS: Record<string, string> = {
  list_folders: 'List workflow folders in the current workspace.',
  create_folder: 'Create a workflow folder in the current workspace.',
  move_folder: 'Move a workflow folder in the current workspace.',
  delete_folder: 'Delete a workflow folder in the current workspace.',
  create_workflow: 'Create a new workflow in the current workspace.',
  get_workflow_data: 'Read workflow blocks, edges, metadata, and variables.',
  get_workflow_run_options: 'Inspect how a workflow can be run and what input it expects.',
  get_block_outputs: 'Read block outputs from workflow execution history.',
  get_block_upstream_references: 'Inspect upstream references for a workflow block.',
  edit_workflow: 'Apply structured edits to workflow blocks, edges, and layout.',
  set_block_enabled: 'Enable or disable a workflow block.',
  set_global_workflow_variables: 'Set global workflow variables.',
  run_workflow: 'Run a workflow and return execution results.',
  run_workflow_until_block: 'Run a workflow until a target block completes.',
  run_block: 'Run a single workflow block in isolation.',
  run_from_block: 'Run a workflow starting from a target block.',
  diff_workflows: 'Compare workflow versions or workflow states.',
  query_logs: 'Search and inspect workflow execution logs.',
  search_documentation: 'Search Sim workflow-building documentation.',
}

class WorkflowSubagentLimitError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'WorkflowSubagentLimitError'
  }
}

class CallbackStreamCollector {
  private seq = 0
  readonly events: CallbackStreamEvent[] = []

  constructor(
    private readonly body: WorkflowSubagentExecuteRequest,
    private readonly childStreamId: string,
    private readonly childRequestId: string,
    private readonly childSpanId: string
  ) {}

  push(type: string, payload: unknown, eventScope?: unknown): void {
    const seq = ++this.seq
    this.events.push({
      v: 1,
      seq,
      ts: new Date().toISOString(),
      type,
      stream: {
        streamId: this.childStreamId,
        cursor: String(seq),
      },
      trace: {
        requestId: this.childRequestId,
      },
      scope: this.scope(eventScope),
      payload,
    })
  }

  collect(event: StreamEvent): void {
    if (NON_FORWARDABLE_CHILD_EVENT_TYPES.has(event.type)) return
    this.push(event.type, event.payload, event.scope)
  }

  span(event: 'start' | 'end', data?: Record<string, unknown>): void {
    this.push('span', {
      kind: 'subagent',
      event,
      agent: WORKFLOW_SUBAGENT_SPEC.displayName,
      data: {
        toolCallId: this.body.parentToolCallId,
        ...(data ?? {}),
      },
    })
  }

  private scope(eventScope?: unknown): CallbackStreamEvent['scope'] {
    const scope = isRecordLike(eventScope) ? eventScope : undefined
    return {
      lane: 'subagent',
      agentId: WORKFLOW_SUBAGENT_SPEC.id,
      parentToolCallId: this.body.parentToolCallId,
      spanId: stringValue(scope?.spanId) ?? this.childSpanId,
      ...(stringValue(scope?.parentSpanId)
        ? { parentSpanId: stringValue(scope?.parentSpanId) }
        : {}),
    }
  }
}

class WorkflowSubagentRunLimiter {
  private childToolCalls = 0
  private providerRounds = 1

  constructor(private readonly limits: WorkflowSubagentExecuteRequest['limits']) {}

  observe(event: StreamEvent, abortController: AbortController): void {
    if (isFinalToolCallEvent(event)) {
      const toolName = event.payload.toolName
      if (!ALLOWED_CHILD_TOOL_SET.has(toolName)) {
        this.abort(
          abortController,
          'workflow_subagent_disallowed_child_tool',
          `Workflow subagent attempted disallowed child tool: ${toolName}`
        )
      }

      this.childToolCalls += 1
      if (this.childToolCalls > this.limits.maxChildToolCalls) {
        this.abort(
          abortController,
          'workflow_subagent_child_tool_limit_exceeded',
          `Workflow subagent exceeded maxChildToolCalls (${this.limits.maxChildToolCalls})`
        )
      }
    }

    if (isCheckpointPauseEvent(event)) {
      if (this.providerRounds >= this.limits.maxProviderRounds) {
        this.abort(
          abortController,
          'workflow_subagent_provider_round_limit_exceeded',
          `Workflow subagent exceeded maxProviderRounds (${this.limits.maxProviderRounds})`
        )
      }
      this.providerRounds += 1
    }
  }

  private abort(abortController: AbortController, code: string, message: string): never {
    if (!abortController.signal.aborted) {
      abortController.abort(code)
    }
    throw new WorkflowSubagentLimitError(code, message)
  }
}

export async function executeWorkflowSubagent(
  body: WorkflowSubagentExecuteRequest
): Promise<WorkflowSubagentExecuteResponse> {
  const depth = body.depth ?? 0
  if (depth >= body.limits.maxDepth) {
    return failureResponse(
      'workflow_subagent_depth_limit_exceeded',
      `Workflow subagent exceeded maxDepth (${body.limits.maxDepth})`
    )
  }

  const workflowId = body.input.workflowId ?? body.context.workflowId
  const accessFailure = await validateAccess(body, workflowId)
  if (accessFailure) return accessFailure
  const inputFailure = needsInputFromRequest(body)
  if (inputFailure) {
    return {
      success: true,
      result: inputFailure,
      streamEvents: [],
    }
  }

  const childStreamId = generateId()
  const childExecutionId = generateId()
  const childRunId = generateId()
  const childRequestId = generateId()
  const childSpanId = generateId()
  const abortController = new AbortController()
  const limiter = new WorkflowSubagentRunLimiter(body.limits)
  const collector = new CallbackStreamCollector(body, childStreamId, childRequestId, childSpanId)
  const requestPayload = await buildWorkflowSubagentRequestPayload({
    body,
    childExecutionId,
    childRunId,
    childStreamId,
    workflowId,
  })

  collector.span('start')

  try {
    const result = await runHeadlessCopilotLifecycle(requestPayload, {
      userId: body.userId,
      workspaceId: body.workspaceId,
      chatId: body.chatId,
      workflowId,
      executionId: childExecutionId,
      runId: childRunId,
      simRequestId: childRequestId,
      goRoute: CHILD_AGENT_ROUTE,
      autoExecuteTools: true,
      interactive: false,
      abortSignal: abortController.signal,
      onEvent: async (event) => {
        limiter.observe(event, abortController)
        collector.collect(event)
      },
    })

    return responseFromLifecycleResult(result, body, workflowId, collector)
  } catch (error) {
    const message = getErrorMessage(error, 'Workflow subagent execution failed')
    logger.warn('Workflow subagent execution failed', {
      parentRunId: body.runId,
      childRunId,
      workflowId,
      workspaceId: body.workspaceId,
      error: message,
    })
    collector.span('end', { status: 'error', error: message })
    if (error instanceof WorkflowSubagentLimitError) {
      return failureResponse(error.code, message, false, collector.events)
    }
    return failureResponse('workflow_subagent_execution_failed', message, false, collector.events)
  }
}

async function validateAccess(
  body: WorkflowSubagentExecuteRequest,
  workflowId: string | undefined
): Promise<WorkflowSubagentExecuteResponse | null> {
  try {
    await assertActiveWorkspaceAccess(body.workspaceId, body.userId)
  } catch (error) {
    return failureResponse(
      'workflow_subagent_workspace_access_denied',
      getErrorMessage(error, 'Workspace access denied')
    )
  }

  if (!workflowId) return null

  const authorization = await authorizeWorkflowByWorkspacePermission({
    workflowId,
    userId: body.userId,
    action: 'read',
  })

  if (!authorization.allowed || !authorization.workflow) {
    return failureResponse(
      'workflow_subagent_workflow_access_denied',
      authorization.message ?? 'Workflow access denied'
    )
  }

  if (authorization.workflow.workspaceId !== body.workspaceId) {
    return failureResponse(
      'workflow_subagent_workflow_workspace_mismatch',
      'Workflow does not belong to the callback workspace'
    )
  }

  return null
}

async function buildWorkflowSubagentRequestPayload(input: {
  body: WorkflowSubagentExecuteRequest
  childExecutionId: string
  childRunId: string
  childStreamId: string
  workflowId?: string
}): Promise<Record<string, unknown>> {
  const { body, childExecutionId, childRunId, childStreamId, workflowId } = input
  const userPermission = await getUserEntityPermissions(body.userId, 'workspace', body.workspaceId)
    .then((permission) => permission ?? undefined)
    .catch(() => undefined)

  return {
    messages: buildWorkflowSubagentMessages(body, workflowId),
    userId: body.userId,
    workspaceId: body.workspaceId,
    chatId: body.chatId,
    mode: 'agent',
    messageId: childStreamId,
    executionId: childExecutionId,
    runId: childRunId,
    model: body.model,
    provider: body.provider,
    isHosted: true,
    parentRunId: body.runId,
    parentToolCallId: body.parentToolCallId,
    ...(workflowId ? { workflowId } : {}),
    ...(userPermission ? { userPermission } : {}),
    mothershipTools: buildWorkflowChildToolSchemas(),
  }
}

function buildWorkflowChildToolSchemas(): ToolSchema[] {
  return WORKFLOW_SUBAGENT_SPEC.allowedChildTools.flatMap((toolName) => {
    const entry = TOOL_CATALOG[toolName]
    if (!entry) return []
    const inputSchema = isRecordLike(entry.parameters)
      ? structuredClone(entry.parameters)
      : { type: 'object', properties: {} }

    return [
      {
        name: entry.name,
        description: CHILD_TOOL_DESCRIPTIONS[toolName] ?? `Execute ${entry.name}.`,
        input_schema: inputSchema,
      },
    ]
  })
}

function buildWorkflowSubagentMessages(
  body: WorkflowSubagentExecuteRequest,
  workflowId: string | undefined
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const inherited = body.context.messages.slice(-80).flatMap((message) => {
    if (message.role === 'assistant' || message.role === 'user') {
      return [{ role: message.role, content: message.content }]
    }
    const prefix =
      message.role === 'tool'
        ? `Tool result${message.toolCallId ? ` ${message.toolCallId}` : ''}:`
        : 'System context:'
    return [{ role: 'user' as const, content: `${prefix}\n${message.content}` }]
  })

  return [
    ...inherited,
    {
      role: 'user',
      content: buildWorkflowSubagentInstruction(body, workflowId),
    },
  ]
}

function buildWorkflowSubagentInstruction(
  body: WorkflowSubagentExecuteRequest,
  workflowId: string | undefined
): string {
  const resources = body.context.resources
    .map((resource) => {
      const title = resource.title ? ` (${resource.title})` : ''
      return `- ${resource.type}:${resource.id}${title}`
    })
    .join('\n')
  const prompt = body.input.prompt?.trim()
  return [
    WORKFLOW_SUBAGENT_SPEC.instructions,
    '',
    `Workspace ID: ${body.workspaceId}`,
    workflowId ? `Workflow ID: ${workflowId}` : 'Workflow ID: not provided',
    `Parent tool call ID: ${body.parentToolCallId}`,
    `Allowed child tools: ${WORKFLOW_SUBAGENT_SPEC.allowedChildTools.join(', ')}`,
    resources ? `Resources:\n${resources}` : 'Resources: none',
    prompt ? `Task:\n${prompt}` : 'Task: use the inherited conversation to help with the workflow.',
  ].join('\n')
}

function responseFromLifecycleResult(
  result: OrchestratorResult,
  body: WorkflowSubagentExecuteRequest,
  workflowId: string | undefined,
  collector: CallbackStreamCollector
): WorkflowSubagentExecuteResponse {
  if (result.cancelled) {
    const summary = nonEmpty(result.content) ?? result.error ?? 'Workflow subagent was cancelled.'
    collector.span('end', { status: 'cancelled', summary })
    return {
      success: true,
      result: {
        status: 'cancelled',
        summary,
      },
      streamEvents: collector.events,
    }
  }

  const needsInput = needsInputFromLifecycleResult(result)
  if (needsInput) {
    collector.span('end', {
      status: 'needs_input',
      reason: needsInput.reason,
      summary: needsInput.summary,
    })
    return {
      success: true,
      result: needsInput,
      streamEvents: collector.events,
    }
  }

  if (!result.success) {
    const error = result.error ?? result.errors?.join('\n') ?? 'Workflow subagent execution failed'
    collector.span('end', { status: 'error', error })
    return failureResponse('workflow_subagent_execution_failed', error, false, collector.events)
  }

  const summary = nonEmpty(result.content) ?? 'Workflow subagent completed.'
  const changedResources = changedResourcesFromToolCalls(result.toolCalls, workflowId)
  collector.span('end', { status: 'completed', summary })
  return {
    success: true,
    result: {
      status: 'completed',
      summary,
      changedResources,
      artifacts: [],
    },
    streamEvents: collector.events,
  }
}

function needsInputFromRequest(
  body: WorkflowSubagentExecuteRequest
): Extract<WorkflowSubagentResult, { status: 'needs_input' }> | undefined {
  const hasPrompt = Boolean(nonEmpty(body.input.prompt))
  const hasInheritedInstruction = body.context.messages.some((message) =>
    Boolean(nonEmpty(message.content))
  )
  if (hasPrompt || hasInheritedInstruction) return undefined

  return {
    status: 'needs_input',
    reason: 'ambiguous_instruction',
    summary: 'Workflow subagent needs a concrete workflow task before it can act.',
    prompt: 'What workflow should I inspect, change, or run?',
  }
}

function needsInputFromLifecycleResult(
  result: OrchestratorResult
): Extract<WorkflowSubagentResult, { status: 'needs_input' }> | undefined {
  const permissionToolCall = result.toolCalls.find((toolCall) =>
    isMissingPermissionToolCall(toolCall)
  )
  if (permissionToolCall) {
    return {
      status: 'needs_input',
      reason: 'missing_permission',
      summary: toolCallFailureSummary(permissionToolCall),
      prompt: `Ask a workspace admin to grant the required permission, or choose a workflow action you are allowed to perform.`,
    }
  }

  const destructiveToolCall = result.toolCalls.find((toolCall) =>
    needsDestructiveConfirmation(toolCall)
  )
  if (destructiveToolCall) {
    return {
      status: 'needs_input',
      reason: 'destructive_action',
      summary: toolCallFailureSummary(destructiveToolCall),
      prompt: `Confirm whether I should continue with the destructive ${destructiveToolCall.name} action.`,
    }
  }

  const confirmationToolCall = result.toolCalls.find((toolCall) => needsToolConfirmation(toolCall))
  if (confirmationToolCall) {
    return {
      status: 'needs_input',
      reason: 'tool_confirmation',
      summary: toolCallFailureSummary(confirmationToolCall),
      prompt: `Confirm or revise the ${confirmationToolCall.name} tool action so the workflow subagent can continue.`,
    }
  }

  if (result.success && result.toolCalls.length === 0 && !nonEmpty(result.content)) {
    return {
      status: 'needs_input',
      reason: 'ambiguous_instruction',
      summary: 'Workflow subagent completed without a concrete answer or workflow action.',
      prompt: 'What exact workflow change, inspection, or run should I perform?',
    }
  }

  return undefined
}

function changedResourcesFromToolCalls(
  toolCalls: ToolCallSummary[],
  fallbackWorkflowId: string | undefined
): WorkflowSubagentChangedResource[] {
  const changed = new Map<string, WorkflowSubagentChangedResource>()
  for (const toolCall of toolCalls) {
    if (toolCall.status !== 'success' && toolCall.status !== 'skipped') continue
    const resource = changedResourceFromToolCall(toolCall, fallbackWorkflowId)
    if (resource) changed.set(`${resource.type}:${resource.id}:${resource.action}`, resource)
  }
  return Array.from(changed.values())
}

function changedResourceFromToolCall(
  toolCall: ToolCallSummary,
  fallbackWorkflowId: string | undefined
): WorkflowSubagentChangedResource | undefined {
  const params = isRecordLike(toolCall.params) ? toolCall.params : {}
  const result = isRecordLike(toolCall.result) ? toolCall.result : {}

  if (toolCall.name === 'create_workflow') {
    const workflowId = stringValue(result.workflowId) ?? stringValue(result.id)
    if (workflowId) return { type: 'workflow', id: workflowId, action: 'created' }
  }

  if (toolCall.name === 'create_folder') {
    const folderId = stringValue(result.folderId) ?? stringValue(result.id)
    if (folderId) return { type: 'folder', id: folderId, action: 'created' }
  }

  if (toolCall.name === 'delete_folder') {
    const folderId = stringValue(params.folderId) ?? stringValue(params.id)
    if (folderId) return { type: 'folder', id: folderId, action: 'deleted' }
  }

  if (toolCall.name === 'move_folder') {
    const folderId = stringValue(params.folderId) ?? stringValue(params.id)
    if (folderId) return { type: 'folder', id: folderId, action: 'moved' }
  }

  if (toolCall.name === 'run_workflow' || toolCall.name === 'run_workflow_until_block') {
    const runId = stringValue(result.executionId) ?? stringValue(result.runId)
    if (runId) return { type: 'run', id: runId, action: 'ran' }
  }

  if (toolCall.name === 'run_block' || toolCall.name === 'run_from_block') {
    const runId = stringValue(result.executionId) ?? stringValue(result.runId)
    if (runId) return { type: 'run', id: runId, action: 'ran' }
  }

  if (
    toolCall.name === 'edit_workflow' ||
    toolCall.name === 'set_block_enabled' ||
    toolCall.name === 'set_global_workflow_variables'
  ) {
    const workflowId = stringValue(params.workflowId) ?? fallbackWorkflowId
    if (workflowId) return { type: 'workflow', id: workflowId, action: 'updated' }
  }

  return undefined
}

function isMissingPermissionToolCall(toolCall: ToolCallSummary): boolean {
  if (!isUnresolvedToolCall(toolCall)) return false
  const message = toolCallMessage(toolCall).toLowerCase()
  return (
    message.includes('permission denied') ||
    message.includes('access denied') ||
    message.includes('unauthorized') ||
    message.includes('requires write access') ||
    message.includes('requires admin access')
  )
}

function needsDestructiveConfirmation(toolCall: ToolCallSummary): boolean {
  if (!DESTRUCTIVE_CHILD_TOOL_SET.has(toolCall.name)) return false
  return toolCall.status === 'cancelled' || toolCall.status === 'rejected'
}

function needsToolConfirmation(toolCall: ToolCallSummary): boolean {
  if (toolCall.status === 'pending' || toolCall.status === 'executing') return true
  if (toolCall.status !== 'cancelled' && toolCall.status !== 'rejected') {
    const message = toolCallMessage(toolCall).toLowerCase()
    return (
      isUnresolvedToolCall(toolCall) &&
      (message.includes('confirmation') ||
        message.includes('confirm') ||
        message.includes('approval') ||
        message.includes('approve'))
    )
  }
  return true
}

function isUnresolvedToolCall(toolCall: ToolCallSummary): boolean {
  return (
    toolCall.status === 'error' ||
    toolCall.status === 'cancelled' ||
    toolCall.status === 'rejected' ||
    toolCall.status === 'pending' ||
    toolCall.status === 'executing'
  )
}

function toolCallFailureSummary(toolCall: ToolCallSummary): string {
  const message = nonEmpty(toolCallMessage(toolCall))
  return message ?? `Workflow child tool ${toolCall.name} needs input before it can continue.`
}

function toolCallMessage(toolCall: ToolCallSummary): string {
  const result = isRecordLike(toolCall.result) ? toolCall.result : {}
  return (
    toolCall.error ??
    stringValue(result.error) ??
    stringValue(result.message) ??
    stringValue(result.reason) ??
    ''
  )
}

function failureResponse(
  code: string,
  error: string,
  retryable = false,
  streamEvents: CallbackStreamEvent[] = []
): WorkflowSubagentExecuteResponse {
  return {
    success: false,
    code,
    error,
    retryable,
    streamEvents,
  }
}

function isFinalToolCallEvent(
  event: StreamEvent
): event is StreamEvent & { payload: { phase: 'call'; toolName: string; partial?: boolean } } {
  if (event.type !== 'tool') return false
  const payload = isRecordLike(event.payload) ? event.payload : undefined
  return (
    payload?.phase === 'call' &&
    typeof payload.toolName === 'string' &&
    payload.partial !== true &&
    payload.status !== 'generating'
  )
}

function isCheckpointPauseEvent(event: StreamEvent): boolean {
  if (event.type !== 'run') return false
  const payload = isRecordLike(event.payload) ? event.payload : undefined
  return payload?.kind === 'checkpoint_pause'
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
