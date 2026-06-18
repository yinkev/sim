import type { ToolConfig } from '@/tools/types'
import type { ScanParams, ScanToolResponse } from '@/tools/understand/types'

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const understandScanTool: ToolConfig<ScanParams, ScanToolResponse> = {
  id: 'understand_scan',
  name: 'Understand Scan',
  description:
    'Scan a local codebase and return code files, line counts, languages, and scan stats.',
  version: '1.0.0',

  params: {
    rootPath: {
      type: 'string',
      required: true,
      visibility: 'user-or-llm',
      description: 'Absolute path to the local codebase root to scan.',
    },
    ignorePatterns: {
      type: 'string',
      required: false,
      visibility: 'user-or-llm',
      description: 'Comma- or newline-separated directory/file patterns to skip.',
    },
    maxFiles: {
      type: 'number',
      required: false,
      visibility: 'user-or-llm',
      description: 'Maximum number of code files to include.',
      default: 5000,
    },
    maxFileBytes: {
      type: 'number',
      required: false,
      visibility: 'hidden',
      description: 'Maximum file size to read for line counts.',
      default: 524288,
    },
  },

  request: {
    url: '/api/tools/understand/scan',
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      ...params,
      maxFiles: toOptionalNumber(params.maxFiles),
      maxFileBytes: toOptionalNumber(params.maxFileBytes),
    }),
  },

  transformResponse: async (response) => response.json() as Promise<ScanToolResponse>,

  outputs: {
    files: {
      type: 'array',
      description: 'Code files discovered under the root path.',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute file path.' },
          language: { type: 'string', description: 'Detected language.' },
          size: { type: 'number', description: 'File size in bytes.' },
          lines: { type: 'number', description: 'Line count when file was read.' },
        },
      },
    },
    stats: {
      type: 'object',
      description: 'Aggregate scan statistics.',
    },
  },
}
