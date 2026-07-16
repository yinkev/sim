import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readQuerySource(fileName: string): string {
  return readFileSync(new URL(fileName, import.meta.url), 'utf8')
}

describe('composer list query intent options', () => {
  it.each([
    ['skills.ts', 'enabled: Boolean(workspaceId) && (options?.enabled ?? true)'],
    ['workflow-list.ts', 'enabled: Boolean(workspaceId) && (options?.enabled ?? true)'],
    ['folder-list.ts', 'enabled: Boolean(workspaceId) && (options?.enabled ?? true)'],
    ['table-list.ts', 'enabled: Boolean(workspaceId) && (options?.enabled ?? true)'],
    ['workspace-file-folders.ts', 'enabled: Boolean(workspaceId) && (options?.enabled ?? true)'],
    ['mothership-chat-list.ts', 'enabled: Boolean(workspaceId) && (options?.enabled ?? true)'],
    ['schedule-list.ts', 'enabled: Boolean(workspaceId) && (options?.enabled ?? true)'],
  ])('%s honors an explicit enabled option', (fileName, expected) => {
    expect(readQuerySource(fileName)).toContain(expected)
  })

  it('keeps compatibility re-exports for extracted list queries', () => {
    expect(readQuerySource('tables.ts')).toContain("from '@/hooks/queries/table-list'")
    expect(readQuerySource('schedules.ts')).toContain("from '@/hooks/queries/schedule-list'")
  })

  it('keeps the skills query off the API contract barrel', () => {
    const source = readQuerySource('skills.ts')
    expect(source).toContain("from '@/lib/api/contracts/skills'")
    expect(source).not.toContain("from '@/lib/api/contracts'")
  })
})
