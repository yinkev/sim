import { stripVersionSuffix } from '@sim/utils/string'
import integrationDetailsJson from '@/lib/integrations/integration-details.json'

/** Pure-data template rendered on a workspace integration detail page. */
export interface IntegrationDetailTemplate {
  title: string
  prompt: string
  otherBlockTypes: readonly string[]
}

/** Pure-data skill rendered on a workspace integration detail page. */
export interface IntegrationDetailSkill {
  name: string
  description: string
  content: string
}

/** Generated presentation data for one integration detail page. */
export interface IntegrationDetails {
  templates: readonly IntegrationDetailTemplate[]
  skills: readonly IntegrationDetailSkill[]
}

const detailsByType = integrationDetailsJson.details as Record<string, IntegrationDetails>
const EMPTY_DETAILS: IntegrationDetails = { templates: [], skills: [] }

/** Resolves generated integration details without loading executable block modules. */
export function getIntegrationDetails(blockType: string): IntegrationDetails {
  return detailsByType[blockType] ?? detailsByType[stripVersionSuffix(blockType)] ?? EMPTY_DETAILS
}
