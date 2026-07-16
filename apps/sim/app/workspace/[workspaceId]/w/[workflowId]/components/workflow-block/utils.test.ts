import { describe, expect, it } from 'vitest'
import { getSubBlockResourceQueryIntent } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/workflow-block/utils'

describe('getSubBlockResourceQueryIntent', () => {
  it('keeps unrelated and empty subblocks off resource queries', () => {
    expect(getSubBlockResourceQueryIntent({ type: 'short-input' }, 'hello')).toEqual({
      customTools: false,
      mcpServers: false,
      mcpTools: false,
      skills: false,
      tables: false,
    })
    expect(getSubBlockResourceQueryIntent({ type: 'mcp-server-selector' }, '')).toEqual({
      customTools: false,
      mcpServers: false,
      mcpTools: false,
      skills: false,
      tables: false,
    })
    expect(getSubBlockResourceQueryIntent({ type: 'tool-input' }, [])).toEqual({
      customTools: false,
      mcpServers: false,
      mcpTools: false,
      skills: false,
      tables: false,
    })
  })

  it.each([
    ['mcp-server-selector', 'server-1', 'mcpServers'],
    ['mcp-tool-selector', 'server-1/tool-1', 'mcpTools'],
    ['table-selector', 'table-1', 'tables'],
    ['tool-input', [{ type: 'custom-tool', customToolId: 'tool-1' }], 'customTools'],
    ['skill-input', [{ skillId: 'skill-1' }], 'skills'],
  ] as const)('enables only the %s catalog required by a selected value', (type, value, key) => {
    const intent = getSubBlockResourceQueryIntent({ type }, value)

    expect(intent[key]).toBe(true)
    expect(Object.entries(intent).filter(([, enabled]) => enabled)).toEqual([[key, true]])
  })
})
