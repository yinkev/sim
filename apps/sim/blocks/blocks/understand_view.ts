import { CodeIcon } from '@/components/icons'
import type { BlockConfig } from '@/blocks/types'
import { IntegrationType } from '@/blocks/types'

export const UnderstandViewBlock: BlockConfig = {
  type: 'understand_view',
  name: 'Understand View',
  description: 'Render graph HTML',
  longDescription:
    'Render a knowledge graph into a standalone HTML report for inspection and sharing.',
  category: 'tools',
  integrationType: IntegrationType.DevOps,
  bgColor: '#0891B2',
  icon: CodeIcon,
  subBlocks: [
    {
      id: 'graph',
      title: 'Knowledge Graph',
      type: 'long-input',
      placeholder: '<Understand Graph.graph>',
      required: true,
    },
    {
      id: 'outputPath',
      title: 'Output Path',
      type: 'short-input',
      placeholder: '/Users/kyin/.prism/graphs/sim/index.html',
    },
  ],
  tools: {
    access: ['understand_view'],
  },
  inputs: {
    graph: { type: 'json', description: 'KnowledgeGraph object from Understand Graph.' },
    outputPath: { type: 'string', description: 'Optional HTML report output path.' },
  },
  outputs: {
    html: { type: 'string', description: 'Standalone graph HTML.' },
    outputPath: { type: 'string', description: 'HTML output path.' },
  },
}
