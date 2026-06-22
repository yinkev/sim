import { z } from 'zod'
import { defineMothershipRouteContract } from '../contract'
import { adminHeadersSchema, nonEmptyStringSchema, successResponseSchema } from './common'

export const adminByokQuerySchema = z
  .object({
    workspaceId: z.string().optional(),
    provider: z.string().optional(),
    userId: z.string().optional(),
  })
  .passthrough()

export const adminByokProviderSchema = z
  .object({
    provider: nonEmptyStringSchema,
    configured: z.boolean().optional(),
    createdBy: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    lastValidatedAt: z.string().nullable().optional(),
  })
  .passthrough()

export const adminByokBodySchema = z
  .object({
    workspaceId: nonEmptyStringSchema,
    provider: nonEmptyStringSchema,
    apiKey: nonEmptyStringSchema,
    createdBy: z.string().optional(),
  })
  .passthrough()

export const adminByokGetResponseSchema = z
  .object({
    workspaceId: z.string().optional(),
    providers: z.array(adminByokProviderSchema).optional(),
    keys: z.array(adminByokProviderSchema).optional(),
  })
  .passthrough()

export const adminByokMutationResponseSchema = successResponseSchema
  .extend({
    workspaceId: z.string().optional(),
    provider: z.string().optional(),
  })
  .passthrough()

export const adminProcessBillingCallbacksBodySchema = z
  .object({
    batchSize: z.number().int().min(1).max(100).optional(),
    failOnNonClean: z.boolean().optional(),
  })
  .passthrough()

export const adminProcessBillingCallbacksResponseSchema = successResponseSchema
  .extend({
    attempted: z.number().int().min(0),
    completed: z.number().int().min(0),
    deadLettered: z.number().int().min(0),
    leaseLost: z.number().int().min(0),
    reaped: z.number().int().min(0),
    retryable: z.number().int().min(0),
    requestId: z.string(),
  })
  .passthrough()

export const adminByokGetContract = defineMothershipRouteContract({
  method: 'GET',
  path: '/api/admin/byok',
  headers: adminHeadersSchema,
  query: adminByokQuerySchema,
  response: { mode: 'json', schema: adminByokGetResponseSchema },
})

export const adminByokPostContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/admin/byok',
  headers: adminHeadersSchema,
  query: adminByokQuerySchema,
  body: adminByokBodySchema,
  response: { mode: 'json', schema: adminByokMutationResponseSchema },
})

export const adminByokDeleteContract = defineMothershipRouteContract({
  method: 'DELETE',
  path: '/api/admin/byok',
  headers: adminHeadersSchema,
  query: adminByokQuerySchema,
  response: { mode: 'json', schema: adminByokMutationResponseSchema },
})

export const adminProcessBillingCallbacksContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/admin/callbacks/billing/process',
  headers: adminHeadersSchema,
  body: adminProcessBillingCallbacksBodySchema,
  response: { mode: 'json', schema: adminProcessBillingCallbacksResponseSchema },
})

export type AdminByokQuery = z.input<typeof adminByokQuerySchema>
export type AdminByokBody = z.input<typeof adminByokBodySchema>
export type AdminProcessBillingCallbacksBody = z.input<
  typeof adminProcessBillingCallbacksBodySchema
>
