/**
 * @vitest-environment node
 */
import { createAgentBlock, createStarterBlock } from '@sim/testing'
import { describe, expect, it } from 'vitest'
import { sanitizeAgentToolsInBlocks } from '@/lib/workflows/sanitization/agent-tools'
import type { BlockState } from '@/stores/workflows/workflow/types'

function asBlockState(block: unknown): BlockState {
  return block as BlockState
}

describe('sanitizeAgentToolsInBlocks', () => {
  it('normalizes valid tools and removes malformed custom tools', () => {
    const builtinTool = { type: 'knowledge', title: 'Knowledge' }
    const referenceTool = { type: 'custom-tool', customToolId: 'custom-1' }
    const inlineTool = {
      type: 'custom-tool',
      schema: {
        function: {
          name: 'inline_tool',
          parameters: { type: 'object', properties: {} },
        },
      },
    }
    const malformedTool = { type: 'custom-tool', schema: {} }
    const block = asBlockState(
      createAgentBlock({
        id: 'agent-1',
        subBlocks: {
          tools: {
            id: 'tools',
            type: 'tool-input',
            value: [builtinTool, referenceTool, inlineTool, malformedTool, null],
          },
        },
      })
    )

    const result = sanitizeAgentToolsInBlocks({ 'agent-1': block })
    const tools = result.blocks['agent-1'].subBlocks.tools.value as unknown[]

    expect(tools).toEqual([
      builtinTool,
      { ...referenceTool, usageControl: 'auto' },
      { ...inlineTool, usageControl: 'auto', code: '' },
    ])
    expect(result.warnings).toEqual(['Block Agent: removed 2 invalid tool(s)'])
  })

  it('parses legacy JSON and resets invalid tool values', () => {
    const legacyBlock = asBlockState(
      createAgentBlock({
        id: 'legacy-agent',
        name: 'Legacy Agent',
        subBlocks: {
          tools: {
            id: 'tools',
            type: 'tool-input',
            value: JSON.stringify([{ type: 'web_search' }]),
          },
        },
      })
    )
    const invalidBlock = asBlockState(
      createAgentBlock({
        id: 'invalid-agent',
        name: 'Invalid Agent',
        subBlocks: {
          tools: { id: 'tools', type: 'tool-input', value: '{invalid' },
        },
      })
    )
    const nonArrayBlock = asBlockState(
      createAgentBlock({
        id: 'non-array-agent',
        name: 'Non-array Agent',
        subBlocks: {
          tools: { id: 'tools', type: 'tool-input', value: 42 },
        },
      })
    )

    const result = sanitizeAgentToolsInBlocks({
      'legacy-agent': legacyBlock,
      'invalid-agent': invalidBlock,
      'non-array-agent': nonArrayBlock,
    })

    expect(result.blocks['legacy-agent'].subBlocks.tools.value).toEqual([{ type: 'web_search' }])
    expect(result.blocks['invalid-agent'].subBlocks.tools.value).toEqual([])
    expect(result.blocks['non-array-agent'].subBlocks.tools.value).toEqual([])
    expect(result.warnings).toEqual([
      'Block Invalid Agent: invalid tools JSON; resetting tools to empty array',
      'Block Non-array Agent: tools value is not an array; resetting',
    ])
  })

  it('leaves non-agent blocks unchanged while cloning the blocks record', () => {
    const block = asBlockState(createStarterBlock({ id: 'start-1' }))
    const blocks = { 'start-1': block }

    const result = sanitizeAgentToolsInBlocks(blocks)

    expect(result.blocks).not.toBe(blocks)
    expect(result.blocks['start-1']).toBe(block)
    expect(result.warnings).toEqual([])
  })
})
