/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const STATIC_WORKFLOW_ORCHESTRATION_IMPORT =
  /\bfrom\s*['"]@\/lib\/workflows\/orchestration(?:\/[^'"]*)?['"]/

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('Studio initial API route boundaries', () => {
  it('keeps workflow reads on the focused lookup module', () => {
    const source = readSource('../../app/api/workflows/[id]/route.ts')

    expect(source).toContain('@/lib/workflows/get-workflow-by-id')
    expect(source).toContain('@/lib/workflows/persistence/load')
    expect(source).not.toContain("from '@/lib/workflows/utils'")
    expect(source).not.toContain("from '@/lib/workflows/persistence/utils'")
    expect(source).not.toMatch(STATIC_WORKFLOW_ORCHESTRATION_IMPORT)
    expect(source).toContain('@/lib/workflows/orchestration/workflow-delete')
    expect(source).toContain('@/lib/workflows/orchestration/workflow-update')
    expect(source).not.toContain('@/lib/workflows/orchestration/workflow-lifecycle')
    expect(source).not.toMatch(/import\(\s*['"]@\/lib\/workflows\/orchestration['"]\s*\)/)
  })

  it('keeps the focused workflow loader off save-only persistence code', () => {
    const source = readSource('../workflows/persistence/load.ts')

    expect(source).toContain('@sim/workflow-persistence/load')
    expect(source).not.toContain('@sim/workflow-persistence/save')
  })

  it('keeps workflow mutations off create-only defaults and persistence', () => {
    for (const file of [
      '../workflows/orchestration/workflow-delete.ts',
      '../workflows/orchestration/workflow-update.ts',
    ]) {
      const source = readSource(file)
      expect(source).not.toContain('@/lib/workflows/defaults')
      expect(source).not.toContain('@/lib/workflows/persistence/utils')
    }
  })

  it('keeps ordinary workspace reads off creation-only workflow machinery', () => {
    const source = readSource('../../app/api/workspaces/route.ts')

    expect(source).toContain('@/lib/api/contracts/workspaces')
    expect(source).not.toContain("from '@/lib/api/contracts'")
    expect(source).not.toMatch(/^import .*@\/lib\/workflows\/(defaults|persistence\/utils)/m)
  })

  it('keeps workspace policy static imports off paid billing machinery', () => {
    const source = readSource('../workspaces/policy.ts')

    expect(source).toContain('@/lib/billing/organizations/membership-lookup')
    expect(source).not.toMatch(/^import .*@\/lib\/billing\/organizations\/membership['"]/m)
    expect(source).not.toMatch(/^import .*@\/lib\/billing\/core\/(billing|plan)['"]/m)
  })

  it('keeps workspace-file reads off workflow route utilities', () => {
    const source = readSource('../../app/api/workspaces/[id]/files/route.ts')

    expect(source).not.toContain('@/app/api/workflows/utils')
  })

  it('keeps workflow listing reads off persistence and orchestration barrels', () => {
    const source = readSource('../../app/api/workflows/route.ts')

    expect(source).not.toContain('@/app/api/workflows/utils')
    expect(source).not.toMatch(/^import .*@\/lib\/workflows\/orchestration/m)
  })

  it('keeps folder listing reads off workflow orchestration barrels', () => {
    const source = readSource('../../app/api/folders/route.ts')

    expect(source).not.toMatch(STATIC_WORKFLOW_ORCHESTRATION_IMPORT)
    expect(source).toContain('@/lib/workflows/orchestration/folder-create')
    expect(source).not.toContain('@/lib/workflows/orchestration/folder-lifecycle')
  })

  it('keeps folder creation off update and archive machinery', () => {
    const source = readSource('../workflows/orchestration/folder-create.ts')

    expect(source).not.toContain('@/lib/workflows/utils')
    expect(source).not.toContain('@/lib/workflows/lifecycle')
  })

  it('keeps user settings on its domain contract', () => {
    const source = readSource('../../app/api/users/me/settings/route.ts')

    expect(source).toContain('@/lib/api/contracts/user')
    expect(source).not.toContain("from '@/lib/api/contracts'")
  })
})
