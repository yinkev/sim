/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parseWorkflowJson } from '@/lib/workflows/operations/import-export'

const FIXTURE_DIR = join(process.cwd(), '../../packages/db/fixtures/workflows')
const FILES = ['support-triage.json', 'http-enrichment.json', 'scheduled-report.json'] as const

describe('demo workflow fixtures', () => {
  for (const file of FILES) {
    it(`parses ${file}`, () => {
      const raw = readFileSync(join(FIXTURE_DIR, file), 'utf8')
      const result = parseWorkflowJson(raw, false)
      expect(result.errors).toEqual([])
      expect(result.data).toBeDefined()
      expect(Object.keys(result.data!.blocks).length).toBeGreaterThan(0)
    })
  }
})
