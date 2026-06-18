import type { ToolConfig } from '@/tools/types'
import type { GraphParams, GraphToolResponse } from '@/tools/understand/types'

function optionalInput<T>(value: T | undefined): T | undefined {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

export const understandGraphTool: ToolConfig<GraphParams, GraphToolResponse> = {
  id: 'understand_graph',
  name: 'Understand Graph',
  description: 'Build a PRISM-compatible knowledge graph from scan, parse, and extract outputs.',
  version: '1.0.0',

  params: {
    rootPath: {
      type: 'string',
      required: false,
      visibility: 'user-or-llm',
      description: 'Codebase root path used for graph metadata and relative labels.',
    },
    scanResult: {
      type: 'object',
      required: false,
      visibility: 'user-or-llm',
      description: 'Optional ScanResult from Understand Scan.',
    },
    parsedData: {
      type: 'object',
      required: false,
      visibility: 'user-or-llm',
      description: 'Optional ParseResult from Understand Parse.',
    },
    summaries: {
      type: 'array',
      required: false,
      visibility: 'user-or-llm',
      description: 'Optional summaries from Understand Extract.',
    },
    relationships: {
      type: 'array',
      required: false,
      visibility: 'user-or-llm',
      description: 'Optional typed relationships from Understand Extract.',
    },
    projectName: {
      type: 'string',
      required: false,
      visibility: 'user-or-llm',
      description: 'Project name used for ~/.prism/graphs/<project>/knowledge-graph.json.',
    },
    outputPath: {
      type: 'string',
      required: false,
      visibility: 'user-or-llm',
      description: 'Explicit path to write the knowledge graph JSON.',
    },
  },

  request: {
    url: '/api/tools/understand/graph',
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      rootPath: optionalInput(params.rootPath),
      scanResult: optionalInput(params.scanResult),
      parsedData: optionalInput(params.parsedData),
      summaries: optionalInput(params.summaries),
      relationships: optionalInput(params.relationships),
      projectName: optionalInput(params.projectName),
      outputPath: optionalInput(params.outputPath),
    }),
  },

  transformResponse: async (response) => response.json() as Promise<GraphToolResponse>,

  outputs: {
    graph: { type: 'object', description: 'Knowledge graph with nodes, edges, and metadata.' },
    outputPath: {
      type: 'string',
      description: 'Path where the graph JSON was written, when requested.',
      optional: true,
    },
  },
}
