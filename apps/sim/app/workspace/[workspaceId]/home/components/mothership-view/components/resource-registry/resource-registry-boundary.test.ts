/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('resource registry boundary', () => {
  it('keeps presentation imports separate from resource query invalidation', () => {
    const registry = readSource('resource-registry.tsx')
    const registryIndex = readSource('index.ts')
    const componentIndex = readSource('../index.ts')
    const invalidationConsumers = [
      readSource('../../../../hooks/preview/use-file-preview-controller.ts'),
      readSource('../../../../hooks/stream/handle-resource-event.ts'),
      readSource('../../../../hooks/stream/handle-tool-event.ts'),
    ]

    expect(registry).not.toContain('@tanstack/react-query')
    expect(registry).not.toContain('@/hooks/queries/')
    expect(registry).not.toContain('RESOURCE_INVALIDATORS')
    expect(registry).not.toContain('invalidateResourceQueries')
    expect(registryIndex).not.toContain('resource-query-invalidation')
    expect(componentIndex).toContain("from './resource-registry/resource-query-invalidation'")

    for (const consumer of invalidationConsumers) {
      expect(consumer).toContain(
        '@/app/workspace/[workspaceId]/home/components/mothership-view/components/resource-registry/resource-query-invalidation'
      )
      expect(consumer).not.toMatch(
        /from ['"]@\/app\/workspace\/\[workspaceId\]\/home\/components\/mothership-view\/components\/resource-registry['"]/
      )
    }
  })
})
