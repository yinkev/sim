import { z } from 'zod'
import { defineMothershipRouteContract } from '../contract'
import { nonEmptyStringSchema, runtimeHeadersSchema, successResponseSchema } from './common'

export const validateKeyListBodySchema = z.object({
  userId: nonEmptyStringSchema,
})

export const validateKeyDeleteBodySchema = z.object({
  userId: nonEmptyStringSchema,
  apiKeyId: nonEmptyStringSchema,
})

export const validateKeyGenerateBodySchema = z.object({
  userId: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
})

export const mothershipApiKeySchema = z
  .object({
    id: nonEmptyStringSchema,
    name: z.string().nullable().optional(),
    apiKey: z.string().optional(),
    displayKey: z.string().optional(),
    createdAt: z.string().nullable().optional(),
    lastUsed: z.string().nullable().optional(),
  })
  .passthrough()

export const validateKeyListResponseSchema = z.object({
  keys: z.array(mothershipApiKeySchema),
})

export const validateKeyBackendListResponseSchema = z.array(mothershipApiKeySchema)

export const validateKeyBackendGenerateResponseSchema = z.object({
  id: z.string().optional(),
  apiKey: nonEmptyStringSchema,
})

export const validateKeyListContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/validate-key/get-api-keys',
  headers: runtimeHeadersSchema,
  body: validateKeyListBodySchema,
  response: { mode: 'json', schema: validateKeyBackendListResponseSchema },
})

export const validateKeyDeleteContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/validate-key/delete',
  headers: runtimeHeadersSchema,
  body: validateKeyDeleteBodySchema,
  response: { mode: 'json', schema: successResponseSchema },
})

export const validateKeyGenerateContract = defineMothershipRouteContract({
  method: 'POST',
  path: '/api/validate-key/generate',
  headers: runtimeHeadersSchema,
  body: validateKeyGenerateBodySchema,
  response: { mode: 'json', schema: validateKeyBackendGenerateResponseSchema },
})

export type ValidateKeyListBody = z.input<typeof validateKeyListBodySchema>
export type ValidateKeyDeleteBody = z.input<typeof validateKeyDeleteBodySchema>
export type ValidateKeyGenerateBody = z.input<typeof validateKeyGenerateBodySchema>
