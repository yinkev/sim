import type { ToolConfig } from '@/tools/types'
import type { ParseParams, ParseToolResponse } from '@/tools/understand/types'

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const understandParseTool: ToolConfig<ParseParams, ParseToolResponse> = {
  id: 'understand_parse',
  name: 'Understand Parse',
  description: 'Parse scanned code files into imports, functions, classes, and call references.',
  version: '1.0.0',

  params: {
    files: {
      type: 'object',
      required: true,
      visibility: 'user-or-llm',
      description: 'ScanResult or array of file entries from Understand Scan.',
    },
    maxFileBytes: {
      type: 'number',
      required: false,
      visibility: 'hidden',
      description: 'Maximum file size to parse.',
      default: 524288,
    },
  },

  request: {
    url: '/api/tools/understand/parse',
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      ...params,
      maxFileBytes: toOptionalNumber(params.maxFileBytes),
    }),
  },

  transformResponse: async (response) => response.json() as Promise<ParseToolResponse>,

  outputs: {
    files: { type: 'array', description: 'Parsed file-level AST summaries.' },
    functions: { type: 'array', description: 'Functions and methods with source paths and lines.' },
    classes: { type: 'array', description: 'Classes/interfaces with source paths and methods.' },
    imports: { type: 'array', description: 'Imports and source file relationships.' },
    calls: { type: 'array', description: 'Function and method call references.' },
  },
}
