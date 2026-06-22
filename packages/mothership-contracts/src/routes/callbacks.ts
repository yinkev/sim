import { z } from 'zod'
import { defineMothershipRouteContract } from '../contract'
import { callbackHeadersSchema, nonEmptyStringSchema } from './common'
import { streamEventEnvelopeSchema } from './runtime'

const runIdSchema = z.string().trim().uuid()

export const simApiKeyValidateBodySchema = z.object({
  userId: nonEmptyStringSchema,
  workspaceId: nonEmptyStringSchema,
})

export const simByokValidateBodySchema = z.object({
  userId: nonEmptyStringSchema,
  workspaceId: nonEmptyStringSchema,
})

export const billingUpdateCostBodySchema = z.object({
  userId: nonEmptyStringSchema,
  cost: z.number().min(0),
  model: nonEmptyStringSchema,
  inputTokens: z.number().min(0).default(0),
  outputTokens: z.number().min(0).default(0),
  source: z
    .enum(['copilot', 'workspace-chat', 'mcp_copilot', 'mothership_block'])
    .default('copilot'),
  idempotencyKey: nonEmptyStringSchema.optional(),
  workspaceId: nonEmptyStringSchema.optional(),
})

export const billingUpdateCostResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.object({
    userId: z.string().optional(),
    cost: z.number().optional(),
    billingEnabled: z.boolean().optional(),
    processedAt: z.string(),
    requestId: z.string(),
  }),
})

export const workflowSubagentMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().max(200_000),
    name: nonEmptyStringSchema.optional(),
    toolCallId: nonEmptyStringSchema.optional(),
  })
  .strict()

export const workflowSubagentResourceSchema = z
  .object({
    type: z.enum(['workflow', 'folder', 'knowledgebase', 'file', 'scheduledtask', 'log']),
    id: nonEmptyStringSchema,
    title: nonEmptyStringSchema.optional(),
  })
  .strict()

export const workflowSubagentExecuteBodySchema = z
  .object({
    runId: runIdSchema,
    streamId: nonEmptyStringSchema,
    chatId: nonEmptyStringSchema,
    userId: nonEmptyStringSchema,
    workspaceId: nonEmptyStringSchema,
    parentToolCallId: nonEmptyStringSchema,
    model: nonEmptyStringSchema,
    provider: nonEmptyStringSchema,
    depth: z.number().int().min(0).max(4).default(0),
    input: z
      .object({
        prompt: z.string().trim().min(1).max(20_000).optional(),
        workflowId: nonEmptyStringSchema.optional(),
      })
      .strict()
      .default({}),
    context: z
      .object({
        messages: z.array(workflowSubagentMessageSchema).min(1).max(100),
        resources: z.array(workflowSubagentResourceSchema).max(50).default([]),
        workflowId: nonEmptyStringSchema.optional(),
      })
      .strict(),
    limits: z
      .object({
        maxDepth: z.number().int().min(1).max(4),
        maxProviderRounds: z.number().int().min(1).max(20),
        maxChildToolCalls: z.number().int().min(1).max(100),
      })
      .strict(),
  })
  .strict()

export const workflowSubagentChangedResourceSchema = z
  .object({
    type: z.enum(['workflow', 'folder', 'global_variable', 'block', 'run', 'log']),
    id: nonEmptyStringSchema,
    action: z.enum(['created', 'updated', 'deleted', 'moved', 'ran', 'read']),
    name: nonEmptyStringSchema.optional(),
  })
  .strict()

export const workflowSubagentArtifactSchema = z
  .object({
    type: z.enum(['workflow_diff', 'run_result', 'log_summary', 'text']),
    title: nonEmptyStringSchema,
    body: z.string().optional(),
    url: z.string().url().optional(),
  })
  .strict()

export const workflowSubagentResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('completed'),
      summary: nonEmptyStringSchema,
      changedResources: z.array(workflowSubagentChangedResourceSchema).default([]),
      artifacts: z.array(workflowSubagentArtifactSchema).default([]),
      followUp: nonEmptyStringSchema.optional(),
    })
    .strict(),
  z
    .object({
      status: z.literal('needs_input'),
      summary: nonEmptyStringSchema,
      prompt: nonEmptyStringSchema,
      reason: z.enum([
        'ambiguous_instruction',
        'destructive_action',
        'missing_permission',
        'tool_confirmation',
      ]),
    })
    .strict(),
  z
    .object({
      status: z.literal('cancelled'),
      summary: nonEmptyStringSchema,
    })
    .strict(),
])

export const workflowSubagentExecuteResponseSchema = z.discriminatedUnion('success', [
  z
    .object({
      success: z.literal(true),
      result: workflowSubagentResultSchema,
      streamEvents: z.array(streamEventEnvelopeSchema).default([]),
    })
    .strict(),
  z
    .object({
      success: z.literal(false),
      code: nonEmptyStringSchema,
      error: nonEmptyStringSchema,
      retryable: z.boolean().default(false),
      streamEvents: z.array(streamEventEnvelopeSchema).default([]),
    })
    .strict(),
])

export const emptyCallbackResponse = { mode: 'empty' } as const

export const simApiKeyValidateCallbackContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/copilot/api-keys/validate',
  headers: callbackHeadersSchema,
  body: simApiKeyValidateBodySchema,
  response: emptyCallbackResponse,
})

export const simByokValidateCallbackContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/copilot/byok/validate',
  headers: callbackHeadersSchema,
  body: simByokValidateBodySchema,
  response: emptyCallbackResponse,
})

export const billingUpdateCostCallbackContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/billing/update-cost',
  headers: callbackHeadersSchema,
  body: billingUpdateCostBodySchema,
  response: { mode: 'json', schema: billingUpdateCostResponseSchema },
})

export const workflowSubagentExecuteCallbackContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/copilot/subagents/workflow/execute',
  headers: callbackHeadersSchema,
  body: workflowSubagentExecuteBodySchema,
  response: { mode: 'json', status: [200, 501], schema: workflowSubagentExecuteResponseSchema },
})

export type SimApiKeyValidateBody = z.input<typeof simApiKeyValidateBodySchema>
export type SimByokValidateBody = z.input<typeof simByokValidateBodySchema>
export type BillingUpdateCostBody = z.input<typeof billingUpdateCostBodySchema>
export type WorkflowSubagentExecuteBody = z.input<typeof workflowSubagentExecuteBodySchema>
export type WorkflowSubagentExecuteRequest = z.output<typeof workflowSubagentExecuteBodySchema>
export type WorkflowSubagentExecuteResponse = z.output<typeof workflowSubagentExecuteResponseSchema>
export type WorkflowSubagentChangedResource = z.output<typeof workflowSubagentChangedResourceSchema>
export type WorkflowSubagentArtifact = z.output<typeof workflowSubagentArtifactSchema>
export type WorkflowSubagentResult = z.output<typeof workflowSubagentResultSchema>
