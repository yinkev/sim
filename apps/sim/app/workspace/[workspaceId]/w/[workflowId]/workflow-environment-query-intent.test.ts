import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('workflow environment query intent', () => {
  it('does not preload workspace environment data before an environment consumer opens', () => {
    const workflowSource = readFileSync(new URL('./workflow.tsx', import.meta.url), 'utf8')

    expect(workflowSource).not.toContain('useWorkspaceEnvironment')
  })
})
