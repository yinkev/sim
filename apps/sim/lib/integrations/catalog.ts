import integrationsJson from '@/lib/integrations/integrations.json'
import type { Integration } from '@/lib/integrations/types'

/** Serialized integrations catalog without executable block-registry imports. */
export const INTEGRATIONS: readonly Integration[] =
  integrationsJson.integrations as readonly Integration[]

/** ISO date of the last real integrations catalog change. */
export const INTEGRATIONS_UPDATED_AT: string = integrationsJson.updatedAt
