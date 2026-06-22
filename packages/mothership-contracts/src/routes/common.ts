import { z } from 'zod'
import {
  MOTHERSHIP_ADMIN_KEY_HEADER,
  MOTHERSHIP_RUNTIME_KEY_HEADER,
  MOTHERSHIP_SOURCE_ENV_HEADER,
  SIM_CALLBACK_KEY_HEADER,
} from '../auth'

export const nonEmptyStringSchema = z.string().min(1)
const mothershipSourceEnvSchema = z.enum(['dev', 'staging', 'prod'])

export const runtimeHeadersSchema = z
  .object({
    [MOTHERSHIP_RUNTIME_KEY_HEADER]: nonEmptyStringSchema,
    traceparent: z.string().optional(),
    tracestate: z.string().optional(),
    'x-client-version': z.string().optional(),
    [MOTHERSHIP_SOURCE_ENV_HEADER]: mothershipSourceEnvSchema.optional(),
  })
  .passthrough()

export const callbackHeadersSchema = z
  .object({
    [SIM_CALLBACK_KEY_HEADER]: nonEmptyStringSchema,
    traceparent: z.string().optional(),
    tracestate: z.string().optional(),
  })
  .passthrough()

export const adminHeadersSchema = z
  .object({
    [MOTHERSHIP_ADMIN_KEY_HEADER]: nonEmptyStringSchema,
    traceparent: z.string().optional(),
    tracestate: z.string().optional(),
    [MOTHERSHIP_SOURCE_ENV_HEADER]: mothershipSourceEnvSchema.optional(),
  })
  .passthrough()

export const errorResponseSchema = z.object({
  success: z.literal(false).optional(),
  error: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
})

export const successResponseSchema = z.object({
  success: z.literal(true),
})

export const toolResultSchema = z.object({
  callId: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  data: z.unknown().optional(),
  success: z.boolean(),
})

export const modelDescriptorSchema = z.object({
  id: nonEmptyStringSchema,
  name: z.string().optional(),
  friendlyName: z.string().optional(),
  displayName: z.string().optional(),
  provider: z.string().optional(),
})
