/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EMCN_ICON_MODULAR_IMPORTS,
  EMCN_MODULAR_IMPORTS,
} from '@/lib/build-config/emcn-modular-imports'

const EXPORT_PATTERN = /export\s*\{([\s\S]*?)\}\s*from\s*'(.+?)'/g

function parseBarrel(relativePath: string, aliasRoot: string): Record<string, string> {
  const source = readFileSync(path.join(process.cwd(), relativePath), 'utf8')
  const exports: Record<string, string> = {}

  for (const match of source.matchAll(EXPORT_PATTERN)) {
    const names = match[1]
    const sourcePath = match[2]

    for (const rawName of names.split(',')) {
      const name = rawName.trim().replace(/^type\s+/, '')
      if (name) exports[name] = `${aliasRoot}/${sourcePath.replace(/^\.\//, '')}`
    }
  }

  return exports
}

describe('EMCN modular imports', () => {
  it('matches every component and icon barrel export', () => {
    const componentExports = parseBarrel(
      'components/emcn/components/index.ts',
      '@/components/emcn/components'
    )
    const iconExports = parseBarrel('components/emcn/icons/index.ts', '@/components/emcn/icons')

    expect(EMCN_ICON_MODULAR_IMPORTS).toEqual(iconExports)
    expect(EMCN_MODULAR_IMPORTS).toEqual({ ...iconExports, ...componentExports })
  })
})
