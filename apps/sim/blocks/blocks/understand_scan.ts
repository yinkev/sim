import { CodeIcon } from '@/components/icons'
import type { BlockConfig } from '@/blocks/types'
import { IntegrationType } from '@/blocks/types'
import type { ScanToolResponse } from '@/tools/understand/types'

export const UnderstandScanBlock: BlockConfig<ScanToolResponse> = {
  type: 'understand_scan',
  name: 'Understand Scan',
  description: 'Scan a local codebase',
  longDescription:
    'Walk a local codebase, skip generated/vendor folders, detect source languages, and return code files with aggregate scan stats.',
  category: 'tools',
  integrationType: IntegrationType.DevOps,
  bgColor: '#2563EB',
  icon: CodeIcon,
  subBlocks: [
    {
      id: 'rootPath',
      title: 'Root Path',
      type: 'short-input',
      placeholder: '/Users/kyin/sim',
      required: true,
    },
    {
      id: 'ignorePatterns',
      title: 'Ignore Patterns',
      type: 'long-input',
      placeholder: 'node_modules, .git, dist, build, .next, .cache, coverage',
      value: () => 'node_modules, .git, dist, build, .next, .cache, coverage, __pycache__',
    },
    {
      id: 'maxFiles',
      title: 'Max Files',
      type: 'short-input',
      placeholder: '5000',
      value: () => '5000',
    },
  ],
  tools: {
    access: ['understand_scan'],
  },
  inputs: {
    rootPath: { type: 'string', description: 'Absolute path to the local codebase root.' },
    ignorePatterns: {
      type: 'string',
      description: 'Comma- or newline-separated patterns to skip.',
    },
    maxFiles: { type: 'number', description: 'Maximum number of source files to scan.' },
  },
  outputs: {
    files: { type: 'array', description: 'Discovered code files.' },
    stats: { type: 'json', description: 'Total files, line counts, languages, and skipped files.' },
  },
}
