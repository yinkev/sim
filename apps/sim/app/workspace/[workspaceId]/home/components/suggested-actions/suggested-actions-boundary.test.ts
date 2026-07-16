/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('SuggestedActions static boundary', () => {
  it('keeps heavy integration metadata and OAuth runtime off the component graph', () => {
    const source = readSource('suggested-actions.tsx')
    const forbiddenImports = [
      '@/components/icons',
      '@/lib/integrations/client-catalog',
      '@/lib/integrations/home-suggestions',
      '@/lib/integrations/oauth-service',
      '@/blocks/icon-color',
      'connect-oauth-modal',
      '@/hooks/queries/oauth/oauth-connections',
      'ConnectOAuthModal',
      'useOAuthConnections',
    ]

    for (const forbiddenImport of forbiddenImports) {
      expect(source).not.toContain(forbiddenImport)
    }
    expect(source).toContain('@/hooks/queries/home-suggestion-catalog')
    expect(source).toContain('?connect=oauth')
  })

  it('loads immutable public metadata through a signal-aware React Query seam', () => {
    const source = readSource('../../../../../../hooks/queries/home-suggestion-catalog.ts')

    expect(source).toContain("all: ['home-suggestion-catalog'] as const")
    expect(source).toContain("fetch('/generated/home-suggestions.json', { signal })")
    expect(source).toContain('queryFn: ({ signal }) => fetchHomeSuggestionCatalog(signal)')
    expect(source).toContain('enabled: options?.enabled ?? true')
    expect(source).toContain('staleTime: Number.POSITIVE_INFINITY')
  })
})
