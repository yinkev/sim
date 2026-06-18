import type { ToolConfig } from '@/tools/types'
import type { ExtractParams, ExtractToolResponse } from '@/tools/understand/types'

function optionalInput<T>(value: T | undefined): T | undefined {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

export const understandExtractTool: ToolConfig<ExtractParams, ExtractToolResponse> = {
  id: 'understand_extract',
  name: 'Understand Extract',
  description: 'Extract file summaries and typed relationships from parsed code data.',
  version: '1.0.0',

  params: {
    parsedData: {
      type: 'object',
      required: true,
      visibility: 'user-or-llm',
      description: 'ParseResult or array of parsed file records from Understand Parse.',
    },
    model: {
      type: 'string',
      required: false,
      visibility: 'user-or-llm',
      description:
        'Optional model label for future LLM enrichment. Local extraction runs without it.',
    },
  },

  request: {
    url: '/api/tools/understand/extract',
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      ...params,
      model: optionalInput(params.model),
    }),
  },

  transformResponse: async (response) => response.json() as Promise<ExtractToolResponse>,

  outputs: {
    summaries: {
      type: 'array',
      description: 'Per-file summaries derived from parsed code structure.',
    },
    relationships: { type: 'array', description: 'Typed graph relationships extracted from code.' },
  },
}
