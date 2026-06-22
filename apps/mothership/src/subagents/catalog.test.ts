import { getMothershipToolCatalogEntry } from '@sim/mothership-contracts'
import { describe, expect, it } from 'vitest'
import {
  getOwnedSubagentSpec,
  OWNED_SUBAGENT_SPECS,
  requireOwnedSubagentSpec,
} from '@/subagents/catalog'

describe('owned subagent catalog', () => {
  it('specifies workflow against the canonical subagent tool catalog entry', () => {
    const catalogEntry = getMothershipToolCatalogEntry('workflow')
    const spec = getOwnedSubagentSpec('workflow')

    expect(catalogEntry).toMatchObject({
      id: 'workflow',
      route: 'subagent',
      mode: 'async',
      subagentId: 'workflow',
      internal: true,
    })
    expect(spec).toBeDefined()
    expect(spec).toMatchObject({
      id: 'workflow',
      toolName: 'workflow',
      displayName: 'Workflow Agent',
      modelPolicy: 'inherit_parent',
      byokPolicy: 'inherit_parent_workspace',
      billingAttribution: 'parent_run',
      maxDepth: 1,
    })
    expect(spec?.inputSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        prompt: expect.objectContaining({ type: 'string' }),
      },
    })
    expect(spec?.resultSchema).toMatchObject({
      type: 'object',
      required: ['status', 'summary'],
    })
  })

  it('keeps workflow child tools explicit and free of nested subagents for the first slice', () => {
    const spec = requireOwnedSubagentSpec('workflow')

    expect(spec.allowedChildTools).toContain('edit_workflow')
    expect(spec.allowedChildTools).toContain('run_workflow')
    expect(spec.allowedChildTools).toContain('search_documentation')
    expect(spec.allowedNestedSubagents).toEqual([])

    for (const toolName of spec.allowedChildTools) {
      const entry = getMothershipToolCatalogEntry(toolName)
      expect(entry, `${toolName} should be a known catalog tool`).toBeDefined()
      expect(entry?.route, `${toolName} should not be a subagent in the first slice`).not.toBe(
        'subagent'
      )
    }
  })

  it('does not specify unsupported subagent catalog tools yet', () => {
    expect(getOwnedSubagentSpec('research')).toBeUndefined()
    expect(getOwnedSubagentSpec('deploy')).toBeUndefined()
    expect(getOwnedSubagentSpec('read_workflow')).toBeUndefined()
    expect(Object.keys(OWNED_SUBAGENT_SPECS)).toEqual(['workflow'])
    expect(() => requireOwnedSubagentSpec('research')).toThrow(
      'Owned Mothership subagent research is not specified'
    )
  })
})
