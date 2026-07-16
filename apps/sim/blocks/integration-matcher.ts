import {
  getIntegrationDescriptor,
  type IntegrationDescriptor,
} from '@/lib/integrations/client-catalog'
import { listIntegrationMentions } from '@/blocks/integration-mention-matcher'

export type { IntegrationDescriptor } from '@/lib/integrations/client-catalog'
export type {
  IntegrationMatcher,
  IntegrationMentionDescriptor,
} from '@/blocks/integration-mention-matcher'
export {
  getIntegrationMatcher,
  mentionifyIntegrations,
  storeCuratedPrompt,
} from '@/blocks/integration-mention-matcher'

let cachedList: readonly IntegrationDescriptor[] | null = null

/**
 * Returns the visual integration descriptors used by Studio mention menus.
 * Chat surfaces use the lightweight mention catalog directly.
 */
export function listIntegrations(): readonly IntegrationDescriptor[] {
  if (cachedList) return cachedList
  cachedList = listIntegrationMentions().flatMap((mention) => {
    const descriptor = getIntegrationDescriptor(mention.blockType)
    return descriptor ? [{ ...descriptor, name: mention.name }] : []
  })
  return cachedList
}
