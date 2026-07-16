import { LandingPromptStorage } from '@/lib/core/utils/browser-storage'
import mentionCatalog from '@/lib/integrations/integration-mention-catalog.json'

/** Minimal integration metadata required by chat mention surfaces. */
export interface IntegrationMentionDescriptor {
  blockType: string
  name: string
}

/** Precomputed lookup tables shared by chat auto-mention paths. */
export interface IntegrationMatcher {
  regex: RegExp | null
  byName: Map<string, IntegrationMentionDescriptor>
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Strips ` (Legacy)` / ` V2` suffixes so chat uses the natural display name. */
export function normalizeIntegrationDisplayName(name: string): string {
  return name
    .replace(/\s*\(legacy\)\s*$/i, '')
    .replace(/\s+v\d+(\.\d+)*\s*$/i, '')
    .trim()
}

let cachedMatcher: IntegrationMatcher | null = null
let cachedList: readonly IntegrationMentionDescriptor[] | null = null

function buildMatcher(): IntegrationMatcher {
  const byName = new Map<string, IntegrationMentionDescriptor>()
  const names: string[] = []

  for (const integration of mentionCatalog.integrations) {
    if (!integration.name || integration.name.trim().length < 2) continue
    const displayName = normalizeIntegrationDisplayName(integration.name)
    const key = displayName.toLowerCase()
    if (byName.has(key)) continue
    byName.set(key, { blockType: integration.blockType, name: displayName })
    names.push(displayName)
  }

  names.sort((a, b) => b.length - a.length)
  const regex = names.length
    ? new RegExp(`(?<![A-Za-z0-9_])(${names.map(escapeRegex).join('|')})(?![A-Za-z0-9_])`, 'gi')
    : null

  return { regex, byName }
}

/** Returns the cached integration name matcher used by chat input and rendering. */
export function getIntegrationMatcher(): IntegrationMatcher {
  if (cachedMatcher) return cachedMatcher
  cachedMatcher = buildMatcher()
  return cachedMatcher
}

/** Rewrites standalone integration names to explicit `@` mentions. */
export function mentionifyIntegrations(text: string): string {
  const { regex } = getIntegrationMatcher()
  if (!regex || !text) return text
  return text.replace(regex, (match: string, _name: string, offset: number) =>
    offset > 0 && text[offset - 1] === '@' ? match : `@${match}`
  )
}

/** Stores a curated prompt after converting integration names to mentions. */
export function storeCuratedPrompt(prompt: string): boolean {
  return LandingPromptStorage.store(mentionifyIntegrations(prompt))
}

/** Returns all mentionable integrations sorted by their normalized display name. */
export function listIntegrationMentions(): readonly IntegrationMentionDescriptor[] {
  if (cachedList) return cachedList
  cachedList = [...getIntegrationMatcher().byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  return cachedList
}
