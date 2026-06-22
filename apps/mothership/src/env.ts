import { validateMothershipSecretTopology } from '@sim/mothership-contracts'
import { z } from 'zod'
import { parseConfiguredModels } from '@/models'

const nonEmptyTrimmedStringSchema = z.string().trim().min(1)
const providerSchema = z
  .enum(['anthropic', 'openai', 'cliproxyapi', 'cliproxy'])
  .transform((provider) => (provider === 'cliproxy' ? 'cliproxyapi' : provider))
const cliproxyBaseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
  }, 'MOTHERSHIP_CLIPROXY_BASE_URL must be an http(s) URL without credentials')

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(6891),
  SIM_TO_MOTHERSHIP_API_KEY: z.string().min(16),
  MOTHERSHIP_ADMIN_API_KEY: z.string().min(16).optional(),
  MOTHERSHIP_TO_SIM_CALLBACK_KEY: z.string().min(16).optional(),
  SIM_BASE_URL: z.string().url().optional(),
  MOTHERSHIP_DEFAULT_PROVIDER: providerSchema.optional(),
  MOTHERSHIP_DEFAULT_MODEL: nonEmptyTrimmedStringSchema.optional(),
  MOTHERSHIP_ANTHROPIC_API_KEY: nonEmptyTrimmedStringSchema.optional(),
  MOTHERSHIP_OPENAI_API_KEY: nonEmptyTrimmedStringSchema.optional(),
  MOTHERSHIP_CLIPROXY_API_KEY: nonEmptyTrimmedStringSchema.optional(),
  MOTHERSHIP_CLIPROXY_BASE_URL: cliproxyBaseUrlSchema.optional(),
  MOTHERSHIP_CLIPROXY_MODEL: nonEmptyTrimmedStringSchema.optional(),
  MOTHERSHIP_CLIPROXY_MAX_COMPLETION_TOKENS: z.coerce.number().int().positive().optional(),
  MOTHERSHIP_CLIPROXY_REASONING_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh']).optional(),
  MOTHERSHIP_PROVIDER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  MOTHERSHIP_AVAILABLE_MODELS_JSON: z.string().optional(),
  API_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'API_ENCRYPTION_KEY must be a 64-character hex string')
    .optional(),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be a 64-character hex string')
    .optional(),
})

export type MothershipEnv = z.infer<typeof EnvSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): MothershipEnv {
  const parsed = EnvSchema.safeParse(source)
  if (!parsed.success) {
    const formatted = z.treeifyError(parsed.error)
    throw new Error(`Invalid mothership environment: ${JSON.stringify(formatted, null, 2)}`)
  }

  const env = parsed.data
  const topology = validateMothershipSecretTopology({
    simToMothershipApiKey: env.SIM_TO_MOTHERSHIP_API_KEY,
    mothershipAdminApiKey: env.MOTHERSHIP_ADMIN_API_KEY,
    mothershipToSimCallbackKey: env.MOTHERSHIP_TO_SIM_CALLBACK_KEY,
    requireRuntimeKey: true,
    requireAdminKey: env.NODE_ENV === 'production',
    requireCallbackKey: env.NODE_ENV === 'production',
  })

  if (!topology.valid) {
    throw new Error(`Invalid mothership secret topology: ${topology.errors.join('; ')}`)
  }

  if (env.NODE_ENV === 'production' && !env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is required for Mothership BYOK admin storage')
  }
  if (env.NODE_ENV === 'production' && !env.API_ENCRYPTION_KEY) {
    throw new Error('API_ENCRYPTION_KEY is required for Mothership API key storage')
  }
  if (env.NODE_ENV === 'production' && !env.SIM_BASE_URL) {
    throw new Error('SIM_BASE_URL is required for Mothership to Sim callbacks')
  }

  parseConfiguredModels(env.MOTHERSHIP_AVAILABLE_MODELS_JSON)

  return env
}
