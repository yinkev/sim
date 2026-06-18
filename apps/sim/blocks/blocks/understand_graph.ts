import { CodeIcon } from '@/components/icons'
import type { BlockConfig } from '@/blocks/types'
import { IntegrationType } from '@/blocks/types'

export const UnderstandGraphBlock: BlockConfig = {
  type: 'understand_graph',
  name: 'Understand Graph',
  description: 'Build a knowledge graph',
  longDescription:
    'Build a PRISM-compatible knowledge graph from scan, parse, and extract outputs and optionally write it to ~/.prism/graphs/<project>/knowledge-graph.json.',
  category: 'tools',
  integrationType: IntegrationType.DevOps,
  bgColor: '#EA580C',
  icon: CodeIcon,
  subBlocks: [
    {
      id: 'rootPath',
      title: 'Root Path',
      type: 'short-input',
      placeholder: '/Users/kyin/sim',
    },
    {
      id: 'scanResult',
      title: 'Scan Result',
      type: 'long-input',
      placeholder: '<Understand Scan.output>',
    },
    {
      id: 'parsedData',
      title: 'Parsed Data',
      type: 'long-input',
      placeholder: '<Understand Parse.output>',
    },
    {
      id: 'summaries',
      title: 'Summaries',
      type: 'long-input',
      placeholder: '<Understand Extract.summaries>',
    },
    {
      id: 'relationships',
      title: 'Relationships',
      type: 'long-input',
      placeholder: '<Understand Extract.relationships>',
    },
    {
      id: 'projectName',
      title: 'Project Name',
      type: 'short-input',
      placeholder: 'sim',
    },
    {
      id: 'outputPath',
      title: 'Output Path',
      type: 'short-input',
      placeholder: '/Users/kyin/.prism/graphs/sim/knowledge-graph.json',
    },
  ],
  tools: {
    access: ['understand_graph'],
  },
  inputs: {
    rootPath: { type: 'string', description: 'Codebase root path.' },
    scanResult: { type: 'json', description: 'ScanResult from Understand Scan.' },
    parsedData: { type: 'json', description: 'ParseResult from Understand Parse.' },
    summaries: { type: 'array', description: 'Summaries from Understand Extract.' },
    relationships: { type: 'array', description: 'Relationships from Understand Extract.' },
    projectName: { type: 'string', description: 'Project name for default PRISM graph path.' },
    outputPath: { type: 'string', description: 'Explicit knowledge graph JSON output path.' },
  },
  outputs: {
    graph: { type: 'json', description: 'Knowledge graph nodes, edges, and metadata.' },
    outputPath: { type: 'string', description: 'Graph JSON output path.' },
  },
}
