import { CodeIcon } from '@/components/icons'
import type { BlockConfig } from '@/blocks/types'
import { IntegrationType } from '@/blocks/types'
import type { ExtractToolResponse } from '@/tools/understand/types'

export const UnderstandExtractBlock: BlockConfig<ExtractToolResponse> = {
  type: 'understand_extract',
  name: 'Understand Extract',
  description: 'Extract graph semantics',
  longDescription:
    'Summarize parsed code files and extract typed relationships such as defines, imports, calls, extends, and implements.',
  category: 'tools',
  integrationType: IntegrationType.DevOps,
  bgColor: '#7C3AED',
  icon: CodeIcon,
  subBlocks: [
    {
      id: 'parsedData',
      title: 'Parsed Data',
      type: 'long-input',
      placeholder: '<Understand Parse.output>',
      required: true,
    },
    {
      id: 'model',
      title: 'Model Label',
      type: 'short-input',
      placeholder: 'optional',
    },
  ],
  tools: {
    access: ['understand_extract'],
  },
  inputs: {
    parsedData: { type: 'json', description: 'ParseResult or parsed files from Understand Parse.' },
    model: { type: 'string', description: 'Optional model label for future enrichment.' },
  },
  outputs: {
    summaries: { type: 'array', description: 'Per-file structural summaries.' },
    relationships: { type: 'array', description: 'Typed relationships for graph construction.' },
  },
}
