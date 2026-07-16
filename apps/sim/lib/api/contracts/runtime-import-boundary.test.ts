/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const HOT_PATH_SOURCES = [
  '../../../hooks/use-oauth-return.ts',
  '../../../hooks/queries/credentials.ts',
  '../../../hooks/queries/environment.ts',
  '../../../hooks/queries/skills.ts',
  '../../environment/api.ts',
  '../../../app/api/settings/voice/route.ts',
] as const

describe('hot-path API contract imports', () => {
  it.each(HOT_PATH_SOURCES)('keeps %s off the aggregate contract barrel', (relativePath) => {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')

    expect(source).not.toMatch(/from\s+['"]@\/lib\/api\/contracts['"]/)
  })

  it('keeps CSV parser code out of the tables contract graph', () => {
    const contract = readFileSync(new URL('./tables.ts', import.meta.url), 'utf8')
    const constants = readFileSync(new URL('../../table/constants.ts', import.meta.url), 'utf8')

    expect(contract).not.toContain("from '@/lib/table/import'")
    expect(contract).toContain("from '@/lib/table/constants'")
    expect(constants).toContain('export const CSV_MAX_FILE_SIZE_BYTES')
  })
})
