import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getServiceConfigByServiceId } from '@/lib/oauth/utils'

interface IntegrationCatalogSource {
  integrations: Array<{
    type: string
    name: string
    slug: string
    oauthServiceId?: string
  }>
}

interface HomeSuggestionSource {
  suggestions: Array<{
    id: string
    blockType: string
    label: string
    prompt: string
    modules: readonly string[]
    featured: boolean
    popular: boolean
  }>
}

interface PublicHomeSuggestions {
  candidates: Array<{
    id: string
    blockType: string
    label: string
    prompt: string
    modules: readonly string[]
    featured: boolean
    popular: boolean
    providerId: string | null
  }>
  services: Array<{
    providerId: string
    slug: string
    name: string
    blockType: string
    templateCount: number
  }>
}

const integrationsPath = new URL('./integrations.json', import.meta.url)
const mentionCatalogPath = new URL('./integration-mention-catalog.json', import.meta.url)
const integrationDetailsPath = new URL('./integration-details.json', import.meta.url)
const homeSuggestionsPath = new URL('./home-suggestions.json', import.meta.url)
const publicHomeSuggestionsPath = new URL(
  '../../public/generated/home-suggestions.json',
  import.meta.url
)
const VERSION_SUFFIX = /_v\d+(?:_\d+)*$/

function readJson<T>(path: URL): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

describe('generated lightweight integration catalogs', () => {
  it('keeps the mention catalog fresh against integrations.json', () => {
    expect(existsSync(mentionCatalogPath)).toBe(true)
    if (!existsSync(mentionCatalogPath)) return

    const source = readJson<IntegrationCatalogSource>(integrationsPath)
    const catalog = readJson<{ integrations: Array<{ blockType: string; name: string }> }>(
      mentionCatalogPath
    )

    expect(catalog.integrations).toEqual(
      source.integrations.map(({ type, name }) => ({ blockType: type, name }))
    )
  })

  it('keeps integration detail presentation data complete and free of executable metadata', () => {
    expect(existsSync(integrationDetailsPath)).toBe(true)
    if (!existsSync(integrationDetailsPath)) return

    const integrations = readJson<IntegrationCatalogSource>(integrationsPath).integrations
    const catalog = readJson<{
      details: Record<
        string,
        {
          templates: Array<{ title: string; prompt: string; otherBlockTypes: readonly string[] }>
          skills: Array<{ name: string; description: string; content: string }>
        }
      >
    }>(integrationDetailsPath)

    expect(Object.keys(catalog.details)).toEqual(integrations.map(({ type }) => type))
    for (const details of Object.values(catalog.details)) {
      for (const template of details.templates) {
        expect(Object.keys(template).sort()).toEqual(['otherBlockTypes', 'prompt', 'title'])
        expect(template.title).not.toBe('')
        expect(template.prompt).not.toBe('')
      }
      for (const skill of details.skills) {
        expect(Object.keys(skill).sort()).toEqual(['content', 'description', 'name'])
        expect(skill.name).not.toBe('')
        expect(skill.content).not.toBe('')
      }
    }
  })

  it('keeps the public suggestion catalog deterministic and free of icon data', () => {
    expect(existsSync(publicHomeSuggestionsPath)).toBe(true)
    if (!existsSync(publicHomeSuggestionsPath)) return

    const integrations = readJson<IntegrationCatalogSource>(integrationsPath).integrations
    const suggestions = readJson<HomeSuggestionSource>(homeSuggestionsPath).suggestions
    const integrationByType = new Map<string, (typeof integrations)[number]>()
    for (const integration of integrations) {
      integrationByType.set(integration.type, integration)
      integrationByType.set(integration.type.replace(VERSION_SUFFIX, ''), integration)
    }
    const candidates = suggestions.map((suggestion) => ({
      id: suggestion.id,
      blockType: suggestion.blockType,
      label: suggestion.label,
      prompt: suggestion.prompt,
      modules: suggestion.modules,
      featured: suggestion.featured,
      popular: suggestion.popular,
      providerId: (() => {
        const serviceId = integrationByType.get(suggestion.blockType)?.oauthServiceId
        return serviceId ? (getServiceConfigByServiceId(serviceId)?.providerId ?? null) : null
      })(),
    }))

    const services = new Map<
      string,
      { providerId: string; slug: string; name: string; blockType: string; templateCount: number }
    >()
    for (const candidate of candidates) {
      if (!candidate.providerId) continue
      const integration = integrationByType.get(candidate.blockType)
      if (!integration) continue
      const current = services.get(candidate.providerId)
      if (current) {
        current.templateCount++
      } else {
        services.set(candidate.providerId, {
          providerId: candidate.providerId,
          slug: integration.slug,
          name: integration.name,
          blockType: candidate.blockType,
          templateCount: 1,
        })
      }
    }

    const catalog = readJson<PublicHomeSuggestions>(publicHomeSuggestionsPath)
    expect(catalog).toEqual({
      candidates,
      services: [...services.values()].sort((a, b) => a.providerId.localeCompare(b.providerId)),
    })
    expect(JSON.stringify(catalog)).not.toMatch(/icon(?:Name|Type|Component)/i)
  })
})
