export type OwnedSubagentId = 'workflow'
export type OwnedSubagentBillingAttribution = 'parent_run'
export type OwnedSubagentModelPolicy = 'inherit_parent'
export type OwnedSubagentByokPolicy = 'inherit_parent_workspace'

export interface OwnedSubagentSpec {
  id: OwnedSubagentId
  toolName: string
  displayName: string
  description: string
  inputSchema: Record<string, unknown>
  resultSchema: Record<string, unknown>
  instructions: string
  allowedChildTools: readonly string[]
  allowedNestedSubagents: readonly OwnedSubagentId[]
  maxDepth: number
  maxProviderRounds: number
  maxChildToolCalls: number
  modelPolicy: OwnedSubagentModelPolicy
  byokPolicy: OwnedSubagentByokPolicy
  billingAttribution: OwnedSubagentBillingAttribution
}

export const WORKFLOW_ALLOWED_CHILD_TOOLS = [
  'list_folders',
  'create_folder',
  'move_folder',
  'delete_folder',
  'create_workflow',
  'get_workflow_data',
  'get_workflow_run_options',
  'get_block_outputs',
  'get_block_upstream_references',
  'edit_workflow',
  'set_block_enabled',
  'set_global_workflow_variables',
  'run_workflow',
  'run_workflow_until_block',
  'run_block',
  'run_from_block',
  'diff_workflows',
  'query_logs',
  'search_documentation',
] as const

export const WORKFLOW_SUBAGENT_SPEC = {
  id: 'workflow',
  toolName: 'workflow',
  displayName: 'Workflow Agent',
  description:
    'Creates, modifies, inspects, tests, and organizes Sim workflows using scoped child tools.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      prompt: {
        type: 'string',
        description:
          'Optional short scoping instruction. The subagent inherits the parent conversation.',
      },
    },
  },
  resultSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { enum: ['completed', 'needs_input', 'cancelled'] },
      summary: { type: 'string' },
      changedResources: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { enum: ['workflow', 'folder', 'global_variable', 'block', 'run', 'log'] },
            id: { type: 'string' },
            action: { enum: ['created', 'updated', 'deleted', 'moved', 'ran', 'read'] },
            name: { type: 'string' },
          },
          required: ['type', 'id', 'action'],
        },
      },
      artifacts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { enum: ['workflow_diff', 'run_result', 'log_summary', 'text'] },
            title: { type: 'string' },
            body: { type: 'string' },
            url: { type: 'string' },
          },
          required: ['type', 'title'],
        },
      },
      followUp: { type: 'string' },
      prompt: { type: 'string' },
      reason: {
        enum: [
          'ambiguous_instruction',
          'destructive_action',
          'missing_permission',
          'tool_confirmation',
        ],
      },
    },
    required: ['status', 'summary'],
  },
  instructions: [
    'You are the owned Workflow Agent inside Sim Mothership.',
    'Use the inherited parent conversation as context; do not ask the parent to restate it.',
    'Operate only on workflows and folders the provided workspace/user identity can access.',
    'Prefer inspecting existing workflow state before editing.',
    'Use child tools for durable workflow reads, edits, runs, and logs.',
    'Summarize exactly what changed and return resource identifiers for anything modified.',
    'Ask for missing user intent instead of guessing destructive workflow changes.',
    'Do not request provider secrets, database secrets, or service-auth keys from the user.',
  ].join('\n'),
  allowedChildTools: WORKFLOW_ALLOWED_CHILD_TOOLS,
  allowedNestedSubagents: [],
  maxDepth: 1,
  maxProviderRounds: 8,
  maxChildToolCalls: 30,
  modelPolicy: 'inherit_parent',
  byokPolicy: 'inherit_parent_workspace',
  billingAttribution: 'parent_run',
} as const satisfies OwnedSubagentSpec

export const OWNED_SUBAGENT_SPECS: Record<OwnedSubagentId, OwnedSubagentSpec> = {
  workflow: WORKFLOW_SUBAGENT_SPEC,
}
