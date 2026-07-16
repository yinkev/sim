/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sanitizeChatDisplayContent } from './chat-sanitize'

describe('sanitizeChatDisplayContent', () => {
  it('unwraps workspace resource tags from inline code spans', () => {
    const content =
      '`I updated <workspace_resource>{"type":"workflow","id":"wf-1","title":"Workflow"}</workspace_resource>.`'

    expect(sanitizeChatDisplayContent(content)).toBe(
      'I updated <workspace_resource>{"type":"workflow","id":"wf-1","title":"Workflow"}</workspace_resource>.'
    )
  })

  it('removes hidden internal references wrapped in inline code', () => {
    const content = 'Read `internal/tool-results/read-1.md` and found the issue.'

    expect(sanitizeChatDisplayContent(content)).toBe('Read  and found the issue.')
  })
})

describe('Prism runtime boundary', () => {
  it('loads the Prism runtime before language side effects', () => {
    const source = readFileSync(new URL('./chat-content.tsx', import.meta.url), 'utf8')
    const runtimeImport = source.indexOf("from 'prismjs'")

    expect(runtimeImport).toBeGreaterThan(-1)
    for (const language of ['typescript', 'bash', 'css', 'markup']) {
      expect(runtimeImport).toBeLessThan(
        source.indexOf(`import 'prismjs/components/prism-${language}'`)
      )
    }
  })
})
