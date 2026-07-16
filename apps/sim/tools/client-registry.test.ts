/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'

const originalExecutionTimeoutEnv = vi.hoisted(() => {
  const keys = [
    'EXECUTION_TIMEOUT_FREE',
    'EXECUTION_TIMEOUT_PRO',
    'EXECUTION_TIMEOUT_TEAM',
    'EXECUTION_TIMEOUT_ENTERPRISE',
    'EXECUTION_TIMEOUT_ASYNC_FREE',
    'EXECUTION_TIMEOUT_ASYNC_PRO',
    'EXECUTION_TIMEOUT_ASYNC_TEAM',
    'EXECUTION_TIMEOUT_ASYNC_ENTERPRISE',
  ] as const
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]
  return original
})

import { CLIENT_TOOLS, getClientTool } from '@/tools/client-registry'
import { CLIENT_TOOL_SUMMARIES, getClientToolSummary } from '@/tools/client-summary-registry'
import { tools } from '@/tools/registry'
import type { ToolConfig } from '@/tools/types'

const CLIENT_TOOL_FIELDS = ['id', 'name', 'description', 'version', 'params', 'oauth'] as const

const CLIENT_TOOL_SUMMARY_FIELDS = ['id', 'params', 'outputs'] as const
const TOOLS_DIR = dirname(fileURLToPath(import.meta.url))

afterAll(() => {
  for (const [key, value] of Object.entries(originalExecutionTimeoutEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function projectTool(tool: ToolConfig): Record<string, unknown> {
  const projected: Record<string, unknown> = {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    version: tool.version,
    params: tool.params,
  }

  if (tool.oauth !== undefined) projected.oauth = tool.oauth

  return JSON.parse(JSON.stringify(projected)) as Record<string, unknown>
}

function projectToolSummary(tool: ToolConfig): Record<string, unknown> {
  const params = Object.fromEntries(
    Object.entries(tool.params)
      .filter(([, param]) => param?.required === true && param.visibility === 'user-only')
      .map(([id]) => [id, { required: true, visibility: 'user-only' }])
  )
  const projected: Record<string, unknown> = { id: tool.id, params }

  if (tool.outputs !== undefined) projected.outputs = tool.outputs

  return JSON.parse(JSON.stringify(projected)) as Record<string, unknown>
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

describe('client tool registry', () => {
  it('matches the executable registry metadata in deterministic id order', () => {
    const expected = Object.values(tools)
      .map(projectTool)
      .sort((left, right) => compareIds(String(left.id), String(right.id)))

    expect(CLIENT_TOOLS).toEqual(expected)
    expect(CLIENT_TOOLS.map(({ id }) => id)).toEqual(
      CLIENT_TOOLS.map(({ id }) => id).toSorted(compareIds)
    )
  })

  it('matches required validation params and full outputs in deterministic id order', () => {
    const expected = Object.values(tools)
      .map(projectToolSummary)
      .sort((left, right) => compareIds(String(left.id), String(right.id)))

    expect(CLIENT_TOOL_SUMMARIES).toEqual(expected)
    expect(CLIENT_TOOL_SUMMARIES.map(({ id }) => id)).toEqual(
      CLIENT_TOOL_SUMMARIES.map(({ id }) => id).toSorted(compareIds)
    )
  })

  it('resolves versioned ids exactly and unversioned ids to the latest version', () => {
    expect(getClientTool('file_parser_v2')?.id).toBe('file_parser_v2')
    expect(getClientTool('file_parser_v3')?.id).toBe('file_parser_v3')
    expect(getClientTool('file_parser')?.id).toBe('file_parser_v3')
    expect(getClientTool('missing_tool')).toBeUndefined()

    expect(getClientToolSummary('file_parser_v2')?.id).toBe('file_parser_v2')
    expect(getClientToolSummary('file_parser_v3')?.id).toBe('file_parser_v3')
    expect(getClientToolSummary('file_parser')?.id).toBe('file_parser_v3')
    expect(getClientToolSummary('missing_tool')).toBeUndefined()
  })

  it('contains metadata only, without executable registry fields', () => {
    const allowedFields = new Set<string>(CLIENT_TOOL_FIELDS)

    for (const tool of CLIENT_TOOLS) {
      expect(Object.keys(tool).every((field) => allowedFields.has(field))).toBe(true)
      expect(tool).not.toHaveProperty('request')
      expect(tool).not.toHaveProperty('outputs')
      expect(tool).not.toHaveProperty('directExecution')
      expect(tool).not.toHaveProperty('transformResponse')
      expect(tool).not.toHaveProperty('postProcess')
      expect(tool).not.toHaveProperty('schemaEnrichment')
      expect(tool).not.toHaveProperty('toolEnrichment')
      expect(tool).not.toHaveProperty('hosting')
    }
  })

  it('keeps summaries limited to validation markers and output metadata', () => {
    const allowedFields = new Set<string>(CLIENT_TOOL_SUMMARY_FIELDS)

    for (const tool of CLIENT_TOOL_SUMMARIES) {
      expect(Object.keys(tool).every((field) => allowedFields.has(field))).toBe(true)
      expect(tool).not.toHaveProperty('name')
      expect(tool).not.toHaveProperty('description')
      expect(tool).not.toHaveProperty('version')
      expect(tool).not.toHaveProperty('oauth')
      expect(tool).not.toHaveProperty('request')

      for (const param of Object.values(tool.params)) {
        expect(param).toEqual({ required: true, visibility: 'user-only' })
      }
    }
  })

  it('keeps initial and deferred JSON projections in separate source modules', () => {
    const metadataRegistry = readFileSync(resolve(TOOLS_DIR, 'client-registry.ts'), 'utf8')
    const summaryRegistry = readFileSync(resolve(TOOLS_DIR, 'client-summary-registry.ts'), 'utf8')

    expect(metadataRegistry).toContain("from '@/tools/client-tool-params.generated.json'")
    expect(metadataRegistry).not.toContain('client-tool-summary.generated.json')
    expect(metadataRegistry).not.toContain('client-summary-registry')

    expect(summaryRegistry).toContain("from '@/tools/client-tool-summary.generated.json'")
    expect(summaryRegistry).not.toContain('client-tool-params.generated.json')
    expect(summaryRegistry).not.toContain("from '@/tools/client-registry'")
  })
})
