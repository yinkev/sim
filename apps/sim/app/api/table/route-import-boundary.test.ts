/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('table collection route import boundary', () => {
  it('keeps list reads isolated from table creation dependencies', () => {
    const route = readSource('./route.ts')
    const createRoute = readSource('./create/route.ts')
    const normalizeColumn = readSource('./normalize-column.ts')
    const tableService = readSource('../../../lib/table/service.ts')
    const tableReads = readSource('../../../lib/table/read.ts')
    const jobReads = readSource('../../../lib/table/jobs/read.ts')
    const tableCreateTool = readSource('../../../tools/table/create.ts')

    expect(route).not.toContain("from '@/lib/table'")
    expect(route).not.toContain("from '@/app/api/table/utils'")
    expect(route).toContain("from '@/lib/table/read'")
    expect(route).not.toMatch(/@\/lib\/table\/(?:service|billing)/)
    expect(route).toContain("new URL('/api/table/create', request.url)")
    expect(createRoute).toContain("from '@/lib/table/service'")
    expect(createRoute).toContain("from '@/lib/table/billing'")
    expect(tableCreateTool).toContain("url: '/api/table/create'")
    expect(route).toContain("from '@/app/api/table/normalize-column'")
    expect(normalizeColumn).not.toContain("from '@/lib/table'")
    expect(tableReads).toContain("from '@/lib/table/jobs/read'")
    expect(tableReads).not.toMatch(/workflow-columns|billing|rows\/service/)
    expect(tableService).toContain("from '@/lib/table/read'")
    expect(tableService).not.toContain("from '@/lib/table/jobs/service'")
    expect(jobReads).not.toContain('/rows/service')
  })
})
