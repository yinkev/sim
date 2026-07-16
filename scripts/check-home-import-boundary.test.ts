/** Run with: bun test scripts/check-home-import-boundary.test.ts */
import { describe, expect, test } from 'bun:test'
import {
  collectModuleSpecifiers,
  collectStaticModuleSpecifiers,
} from './check-home-import-boundary.ts'

describe('collectStaticModuleSpecifiers', () => {
  test('keeps runtime edges and excludes type-only and dynamic imports', () => {
    const source = `
      import type { TypeOnly } from './type-only'
      import { type NamedTypeOnly } from './named-type-only'
      import RuntimeDefault, { type RuntimeType } from './runtime-default'
      import { runtimeValue, type MixedType } from './runtime-named'
      import './side-effect'
      export type { ExportedType } from './export-type-only'
      export { type NamedExportType } from './named-export-type-only'
      export { runtimeExport, type ExportType } from './runtime-export'
      export * from './runtime-export-all'

      const lazy = import('./dynamic')
      const staticModule = require('./static-require')
      const computedModule = require(moduleName)
    `

    const edges = collectStaticModuleSpecifiers(source).map(({ kind, specifier }) => ({
      kind,
      specifier,
    }))

    expect(edges).toEqual([
      { kind: 'import', specifier: './runtime-default' },
      { kind: 'import', specifier: './runtime-named' },
      { kind: 'import', specifier: './side-effect' },
      { kind: 're-export', specifier: './runtime-export' },
      { kind: 're-export', specifier: './runtime-export-all' },
      { kind: 'require', specifier: './static-require' },
    ])
  })

  test('includes literal dynamic imports when cold-route tracing requests them', () => {
    const source = `
      import './static'
      const lazy = import('./dynamic')
      const unresolvedAtBuildTime = import(moduleName)
    `

    const edges = collectModuleSpecifiers(source, 'source.ts', {
      includeDynamicImports: true,
    }).map(({ kind, specifier }) => ({ kind, specifier }))

    expect(edges).toEqual([
      { kind: 'import', specifier: './static' },
      { kind: 'dynamic-import', specifier: './dynamic' },
    ])
  })
})
