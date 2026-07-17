import fs from 'node:fs'
import path from 'node:path'
import {
  getAllBlockMeta,
  getAllBlocks,
  getSuggestedSkillsForBlock,
  getTemplatesForBlock,
} from '../apps/sim/blocks/registry'
import integrationsJson from '../apps/sim/lib/integrations/integrations.json'
import { getServiceConfigByServiceId } from '../apps/sim/lib/oauth/utils'

interface GeneratedHomeSuggestion {
  id: string
  blockType: string
  label: string
  prompt: string
  modules: readonly string[]
  featured: boolean
  popular: boolean
  iconType?: string
  iconName?: string
}

interface GeneratedPublicHomeSuggestion {
  id: string
  blockType: string
  label: string
  prompt: string
  modules: readonly string[]
  featured: boolean
  popular: boolean
  providerId: string | null
}

interface GeneratedOAuthService {
  providerId: string
  slug: string
  name: string
  blockType: string
  templateCount: number
}

interface GeneratedIntegrationDetails {
  templates: Array<{
    title: string
    prompt: string
    otherBlockTypes: readonly string[]
  }>
  skills: Array<{
    name: string
    description: string
    content: string
  }>
}

const VERSION_SUFFIX = /_v\d+(?:_\d+)*$/
const stripVersionSuffix = (value: string) => value.replace(VERSION_SUFFIX, '')
const checkOnly = process.argv.includes('--check')

const ALLOWED_STANDALONE_ICON_NAMES = new Set([
  'BookOpen',
  'Bug',
  'Calendar',
  'Card',
  'CirclebackIcon',
  'ClipboardList',
  'EnrichmentIcon',
  'File',
  'Mail',
  'MailServerIcon',
  'RssIcon',
  'Search',
  'Send',
  'ShieldCheck',
  'SpotifyIcon',
  'Table',
  'Users',
])

function writeJson(outputPath: string, value: unknown): void {
  const content = `${JSON.stringify(value, null, 2)}\n`
  if (checkOnly) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== content) {
      throw new Error(`Generated integration catalog is stale: ${outputPath}`)
    }
    return
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, content)
}

function getCanonicalProviderId(
  integration: (typeof integrationsJson.integrations)[number] | undefined
): string | null {
  if (!integration?.oauthServiceId) return null
  const service = getServiceConfigByServiceId(integration.oauthServiceId)
  if (!service) {
    throw new Error(
      `Integration ${integration.type} references unknown OAuth service ${integration.oauthServiceId}`
    )
  }
  return service.providerId
}

export function writeHomeSuggestionsCatalog(): void {
  const integrations = integrationsJson.integrations
  const integrationByType = new Map<string, (typeof integrations)[number]>()
  const visibleTypes = new Set<string>()

  for (const integration of integrations) {
    integrationByType.set(integration.type, integration)
    integrationByType.set(stripVersionSuffix(integration.type), integration)
    visibleTypes.add(integration.type)
  }

  const visibleTypeByIcon = new Map<unknown, string>()
  for (const block of getAllBlocks()) {
    if (visibleTypes.has(block.type) && !visibleTypeByIcon.has(block.icon)) {
      visibleTypeByIcon.set(block.icon, block.type)
    }
  }

  const suggestions: GeneratedHomeSuggestion[] = []
  for (const [blockType, meta] of Object.entries(getAllBlockMeta()).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (!integrationByType.has(blockType)) continue

    for (const [index, template] of (meta.templates ?? []).entries()) {
      const iconType = visibleTypeByIcon.get(template.icon)
      const iconName = template.icon?.name
      if (!iconType && (!iconName || !ALLOWED_STANDALONE_ICON_NAMES.has(iconName))) {
        throw new Error(
          `Home suggestion ${blockType}:${index} uses unsupported icon ${iconName || '<anonymous>'}`
        )
      }

      suggestions.push({
        id: `${blockType}-${index}`,
        blockType,
        label: template.title,
        prompt: template.prompt,
        modules: template.modules,
        featured: template.featured ?? false,
        popular: template.category === 'popular',
        ...(iconType ? { iconType } : { iconName }),
      })
    }
  }

  const outputPath = path.join(
    import.meta.dir,
    '../apps/sim/lib/integrations/home-suggestions.json'
  )
  writeJson(outputPath, { suggestions })

  const mentionCatalogPath = path.join(
    import.meta.dir,
    '../apps/sim/lib/integrations/integration-mention-catalog.json'
  )
  writeJson(mentionCatalogPath, {
    integrations: integrations.map((integration) => ({
      blockType: integration.type,
      name: integration.name,
    })),
  })

  const integrationDetailsPath = path.join(
    import.meta.dir,
    '../apps/sim/lib/integrations/integration-details.json'
  )
  const details: Record<string, GeneratedIntegrationDetails> = {}
  for (const integration of integrations) {
    details[integration.type] = {
      templates: getTemplatesForBlock(integration.type).map(
        ({ title, prompt, otherBlockTypes }) => ({ title, prompt, otherBlockTypes })
      ),
      skills: getSuggestedSkillsForBlock(integration.type).map(
        ({ name, description, content }) => ({ name, description, content })
      ),
    }
  }
  writeJson(integrationDetailsPath, { details })

  const publicCandidates: GeneratedPublicHomeSuggestion[] = suggestions.map((suggestion) => ({
    id: suggestion.id,
    blockType: suggestion.blockType,
    label: suggestion.label,
    prompt: suggestion.prompt,
    modules: suggestion.modules,
    featured: suggestion.featured,
    popular: suggestion.popular,
    providerId: getCanonicalProviderId(integrationByType.get(suggestion.blockType)),
  }))
  const serviceByProvider = new Map<string, GeneratedOAuthService>()
  for (const candidate of publicCandidates) {
    if (!candidate.providerId) continue
    const integration = integrationByType.get(candidate.blockType)
    if (!integration) continue
    const current = serviceByProvider.get(candidate.providerId)
    if (current) {
      current.templateCount++
      continue
    }
    serviceByProvider.set(candidate.providerId, {
      providerId: candidate.providerId,
      slug: integration.slug,
      name: integration.name,
      blockType: candidate.blockType,
      templateCount: 1,
    })
  }

  const publicCatalogPath = path.join(
    import.meta.dir,
    '../apps/sim/public/generated/home-suggestions.json'
  )
  writeJson(publicCatalogPath, {
    candidates: publicCandidates,
    services: [...serviceByProvider.values()].sort((a, b) =>
      a.providerId.localeCompare(b.providerId)
    ),
  })
  console.log(
    `✓ Home suggestion catalog written: ${suggestions.length} suggestions → ${outputPath}`
  )
  console.log(`✓ Integration mention catalog written → ${mentionCatalogPath}`)
  console.log(`✓ Integration detail catalog written → ${integrationDetailsPath}`)
  console.log(`✓ Public home suggestion catalog written → ${publicCatalogPath}`)
}

if (import.meta.main) {
  writeHomeSuggestionsCatalog()
}
