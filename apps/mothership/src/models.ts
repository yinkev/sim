import {
  getAvailableModelsResponseSchema,
  modelDescriptorSchema,
} from '@sim/mothership-contracts/routes'
import { z } from 'zod'
import type { MothershipEnv } from '@/env'

const configuredModelsSchema = z.array(modelDescriptorSchema)

export type ConfiguredMothershipModel = z.output<typeof modelDescriptorSchema>

export function parseConfiguredModels(
  source: string | undefined
): ConfiguredMothershipModel[] | null {
  if (!source) return null

  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    throw new Error('MOTHERSHIP_AVAILABLE_MODELS_JSON must be valid JSON')
  }

  const parsed = configuredModelsSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('MOTHERSHIP_AVAILABLE_MODELS_JSON must be an array of model descriptors')
  }

  return parsed.data
}

export function getConfiguredModels(env: MothershipEnv): ConfiguredMothershipModel[] | null {
  return parseConfiguredModels(env.MOTHERSHIP_AVAILABLE_MODELS_JSON)
}

export function availableModelsUnavailableResponse(): z.output<
  typeof getAvailableModelsResponseSchema
> {
  return getAvailableModelsResponseSchema.parse({
    success: false,
    error: 'Mothership model catalog is not configured',
    models: [],
  })
}

export function availableModelsResponse(
  models: ConfiguredMothershipModel[]
): z.output<typeof getAvailableModelsResponseSchema> {
  return getAvailableModelsResponseSchema.parse({
    success: true,
    models,
  })
}
