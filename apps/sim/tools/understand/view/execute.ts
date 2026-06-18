import type { ToolConfig } from '@/tools/types'
import type { ViewParams, ViewToolResponse } from '@/tools/understand/types'

function optionalInput<T>(value: T | undefined): T | undefined {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

export const understandViewTool: ToolConfig<ViewParams, ViewToolResponse> = {
  id: 'understand_view',
  name: 'Understand View',
  description: 'Render a knowledge graph into a standalone HTML report.',
  version: '1.0.0',

  params: {
    graph: {
      type: 'object',
      required: true,
      visibility: 'user-or-llm',
      description: 'KnowledgeGraph object or JSON string from Understand Graph.',
    },
    outputPath: {
      type: 'string',
      required: false,
      visibility: 'user-or-llm',
      description: 'Optional path to write the HTML graph report.',
    },
  },

  request: {
    url: '/api/tools/understand/view',
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      ...params,
      outputPath: optionalInput(params.outputPath),
    }),
  },

  transformResponse: async (response) => response.json() as Promise<ViewToolResponse>,

  outputs: {
    html: { type: 'string', description: 'Standalone HTML graph report.' },
    outputPath: {
      type: 'string',
      description: 'Path where the HTML report was written, when requested.',
      optional: true,
    },
  },
}
