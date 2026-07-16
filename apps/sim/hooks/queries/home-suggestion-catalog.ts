'use client'

import { useQuery } from '@tanstack/react-query'

export type HomeSuggestionModule =
  | 'knowledge-base'
  | 'tables'
  | 'files'
  | 'workflows'
  | 'scheduled'
  | 'agent'

export interface HomeSuggestionCatalogCandidate {
  id: string
  blockType: string
  label: string
  prompt: string
  modules: readonly HomeSuggestionModule[]
  featured: boolean
  popular: boolean
  providerId: string | null
}

export interface HomeSuggestionCatalogService {
  providerId: string
  slug: string
  name: string
  blockType: string
  templateCount: number
}

export interface HomeSuggestionCatalog {
  candidates: HomeSuggestionCatalogCandidate[]
  services: HomeSuggestionCatalogService[]
}

export const homeSuggestionCatalogKeys = {
  all: ['home-suggestion-catalog'] as const,
  catalog: () => [...homeSuggestionCatalogKeys.all, 'catalog'] as const,
}

export async function fetchHomeSuggestionCatalog(
  signal?: AbortSignal
): Promise<HomeSuggestionCatalog> {
  // boundary-raw-fetch: generated public metadata is a static asset, not an API boundary
  const response = await fetch('/generated/home-suggestions.json', { signal })
  if (!response.ok) {
    throw new Error(`Failed to load home suggestions (${response.status})`)
  }
  return (await response.json()) as HomeSuggestionCatalog
}

export function useHomeSuggestionCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: homeSuggestionCatalogKeys.catalog(),
    queryFn: ({ signal }) => fetchHomeSuggestionCatalog(signal),
    enabled: options?.enabled ?? true,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
