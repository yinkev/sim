import { CodeIcon } from '@/components/icons'
import type { BlockConfig } from '@/blocks/types'
import { IntegrationType } from '@/blocks/types'
import type { ParseToolResponse } from '@/tools/understand/types'

export const UnderstandParseBlock: BlockConfig<ParseToolResponse> = {
  type: 'understand_parse',
  name: 'Understand Parse',
  description: 'Parse source structure',
  longDescription:
    'Parse scanned source files into imports, functions, classes, methods, and call references. TypeScript and JavaScript use the TypeScript compiler AST; other common languages use lightweight structural extraction.',
  category: 'tools',
  integrationType: IntegrationType.DevOps,
  bgColor: '#0F766E',
  icon: CodeIcon,
  subBlocks: [
    {
      id: 'files',
      title: 'Scan Result',
      type: 'long-input',
      placeholder: '<Understand Scan.output>',
      required: true,
    },
    {
      id: 'maxFileBytes',
      title: 'Max File Bytes',
      type: 'short-input',
      placeholder: '524288',
      value: () => '524288',
    },
  ],
  tools: {
    access: ['understand_parse'],
  },
  inputs: {
    files: { type: 'json', description: 'ScanResult or file entries from Understand Scan.' },
    maxFileBytes: { type: 'number', description: 'Maximum file size to parse.' },
  },
  outputs: {
    files: { type: 'array', description: 'Parsed source files.' },
    functions: { type: 'array', description: 'Functions and methods with lines and signatures.' },
    classes: { type: 'array', description: 'Classes/interfaces with methods and inheritance.' },
    imports: { type: 'array', description: 'Import references by source file.' },
    calls: { type: 'array', description: 'Call references by source file.' },
  },
}
