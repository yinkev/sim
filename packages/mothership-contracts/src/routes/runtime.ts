import { z } from 'zod'
import { defineMothershipRouteContract } from '../contract'
import {
  modelDescriptorSchema,
  nonEmptyStringSchema,
  runtimeHeadersSchema,
  successResponseSchema,
  toolResultSchema,
} from './common'

const mothershipMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })
  .passthrough()

const runtimeIdentitySchema = z.string().trim().min(1)
const runtimeUuidIdentitySchema = z.string().trim().uuid()

export const mothershipChatBodySchema = z
  .object({
    message: z.string().optional(),
    messages: z.array(mothershipMessageSchema).optional(),
    userId: nonEmptyStringSchema,
    messageId: nonEmptyStringSchema,
    executionId: runtimeIdentitySchema,
    runId: runtimeUuidIdentitySchema,
    parentRunId: runtimeUuidIdentitySchema.optional(),
    workflowId: z.string().optional(),
    workflowName: z.string().optional(),
    workspaceId: runtimeIdentitySchema,
    model: z.string().optional(),
    provider: z.string().optional(),
    mode: z.string().optional(),
    context: z.array(z.unknown()).optional(),
    chatId: runtimeUuidIdentitySchema,
    prefetch: z.boolean().optional(),
    implicitFeedback: z.unknown().optional(),
    integrationTools: z.array(z.unknown()).optional(),
    mothershipTools: z.array(z.unknown()).optional(),
    commands: z.array(z.unknown()).optional(),
    workspaceContext: z.unknown().optional(),
    userPermission: z.unknown().optional(),
    userTimezone: z.string().optional(),
    userMetadata: z
      .object({
        name: z.string().optional(),
        email: z.string().optional(),
        timezone: z.string().optional(),
      })
      .passthrough()
      .optional(),
    docCompiler: z.enum(['python', 'js']).optional(),
    isHosted: z.boolean().optional(),
    enterpriseByokEligible: z.boolean().optional(),
  })
  .passthrough()
  .refine(
    (body) =>
      (typeof body.message === 'string' && body.message.trim().length > 0) ||
      (Array.isArray(body.messages) && body.messages.length > 0),
    {
      message: 'message or messages is required',
      path: ['message'],
    }
  )

export const resumeToolsBodySchema = z
  .object({
    streamId: nonEmptyStringSchema,
    checkpointId: nonEmptyStringSchema,
    userId: nonEmptyStringSchema,
    workspaceId: z.string().optional(),
    results: z.array(toolResultSchema),
    willRetryOnStreamError: z.boolean().optional(),
  })
  .passthrough()

export const explicitAbortBodySchema = z
  .object({
    messageId: nonEmptyStringSchema,
    userId: nonEmptyStringSchema,
    chatId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .passthrough()

export const streamReplayQuerySchema = z
  .object({
    streamId: nonEmptyStringSchema,
    userId: nonEmptyStringSchema,
    after: z.string().optional().default('0'),
    batch: z
      .enum(['true', 'false'])
      .optional()
      .default('false')
      .transform((value) => value === 'true'),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
  })
  .passthrough()

export const streamReplayStreamQuerySchema = streamReplayQuerySchema.refine(
  (query) => query.batch === false,
  {
    path: ['batch'],
    message: 'batch must be absent or false for stream replay responses',
  }
)

export const streamReplayBatchQuerySchema = streamReplayQuerySchema.refine(
  (query) => query.batch === true,
  {
    path: ['batch'],
    message: 'batch=true is required for batch replay responses',
  }
)

export const streamEventEnvelopeSchema = z
  .object({
    v: z.literal(1),
    seq: z.number().int().nonnegative(),
    ts: nonEmptyStringSchema,
    type: nonEmptyStringSchema,
    stream: z
      .object({
        streamId: nonEmptyStringSchema,
        cursor: z.string().optional(),
      })
      .passthrough(),
    trace: z
      .object({
        requestId: z.string().optional(),
      })
      .passthrough()
      .optional(),
    payload: z.unknown(),
  })
  .passthrough()

export const streamReplayBatchEventSchema = z.object({
  eventId: z.number().int().nonnegative(),
  streamId: nonEmptyStringSchema,
  event: streamEventEnvelopeSchema,
})

export const streamReplayResponseSchema = z.object({
  success: z.literal(true),
  events: z.array(streamReplayBatchEventSchema),
  status: nonEmptyStringSchema,
  chatId: nonEmptyStringSchema.optional(),
})

export const getAvailableModelsResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    models: z.array(modelDescriptorSchema),
    error: z.never().optional(),
  }),
  z.object({
    success: z.literal(false),
    models: z.array(modelDescriptorSchema),
    error: nonEmptyStringSchema,
  }),
])

export const generateChatTitleBodySchema = z
  .object({
    message: nonEmptyStringSchema,
    model: nonEmptyStringSchema.optional(),
    provider: z.string().optional(),
    workspaceId: z.string().optional(),
    userId: z.string().optional(),
  })
  .passthrough()

export const generateChatTitleResponseSchema = z
  .object({
    title: z.string().optional(),
  })
  .passthrough()

export const forkChatBodySchema = z
  .object({
    sourceChatId: nonEmptyStringSchema,
    newChatId: nonEmptyStringSchema,
    upToMessageId: nonEmptyStringSchema.optional(),
    userId: nonEmptyStringSchema,
  })
  .passthrough()

export const forkChatResponseSchema = successResponseSchema.extend({
  copied: z.boolean().optional(),
  sourceChatId: z.string().optional(),
  newChatId: z.string().optional(),
})

export const copilotRuntimeContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/copilot',
  headers: runtimeHeadersSchema,
  body: mothershipChatBodySchema,
  response: { mode: 'stream' },
})

export const mothershipRuntimeContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/mothership',
  headers: runtimeHeadersSchema,
  body: mothershipChatBodySchema,
  response: { mode: 'stream' },
})

export const mothershipExecuteRuntimeContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/mothership/execute',
  headers: runtimeHeadersSchema,
  body: mothershipChatBodySchema,
  response: { mode: 'stream' },
})

export const resumeToolsContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/tools/resume',
  headers: runtimeHeadersSchema,
  body: resumeToolsBodySchema,
  response: { mode: 'stream' },
})

export const explicitAbortContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/streams/explicit-abort',
  headers: runtimeHeadersSchema,
  body: explicitAbortBodySchema,
  response: { mode: 'json', schema: successResponseSchema },
})

export const streamReplayContract = defineMothershipRouteContract({
  method: 'GET',
  path: '/api/streams/replay',
  headers: runtimeHeadersSchema,
  query: streamReplayStreamQuerySchema,
  response: { mode: 'stream' },
})

export const streamReplayBatchContract = defineMothershipRouteContract({
  method: 'GET',
  path: '/api/streams/replay',
  headers: runtimeHeadersSchema,
  query: streamReplayBatchQuerySchema,
  response: { mode: 'json', schema: streamReplayResponseSchema },
})

export const getAvailableModelsContract = defineMothershipRouteContract({
  method: 'GET',
  path: '/api/get-available-models',
  headers: runtimeHeadersSchema,
  response: { mode: 'json', schema: getAvailableModelsResponseSchema },
})

export const generateChatTitleContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/generate-chat-title',
  headers: runtimeHeadersSchema,
  body: generateChatTitleBodySchema,
  response: { mode: 'json', schema: generateChatTitleResponseSchema },
})

export const forkChatContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/chats/fork',
  headers: runtimeHeadersSchema,
  body: forkChatBodySchema,
  response: { mode: 'json', schema: forkChatResponseSchema },
})

export type MothershipChatBody = z.input<typeof mothershipChatBodySchema>
export type ResumeToolsBody = z.input<typeof resumeToolsBodySchema>
export type ExplicitAbortBody = z.input<typeof explicitAbortBodySchema>
export type StreamReplayQuery = z.input<typeof streamReplayQuerySchema>
export type GenerateChatTitleBody = z.input<typeof generateChatTitleBodySchema>
export type ForkChatBody = z.input<typeof forkChatBodySchema>
