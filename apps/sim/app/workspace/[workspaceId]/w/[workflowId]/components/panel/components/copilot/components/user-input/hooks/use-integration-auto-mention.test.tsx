/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIntegrationAutoMention } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/copilot/components/user-input/hooks/use-integration-auto-mention'
import type { ChatContext } from '@/stores/panel'

let contexts: ChatContext[] = []
let autoMention: ReturnType<typeof useIntegrationAutoMention> | null = null

function Harness() {
  const setSelectedContexts: React.Dispatch<React.SetStateAction<ChatContext[]>> = (update) => {
    contexts = typeof update === 'function' ? update(contexts) : update
  }
  autoMention = useIntegrationAutoMention({ setSelectedContexts })
  return null
}

describe('integration auto mention', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    contexts = []
    autoMention = null
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<Harness />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('canonicalizes explicit mentions and preserves their block type context', () => {
    const result = autoMention?.applyToText('@slack then @google sheets')

    expect(result).toBe('@Slack then @Google Sheets')
    expect(contexts).toEqual([
      { kind: 'integration', blockType: 'slack', label: 'Slack' },
      { kind: 'integration', blockType: 'google_sheets_v2', label: 'Google Sheets' },
    ])
  })

  it('leaves bare names and email-like text unchanged', () => {
    const text = 'Slack and foo@slack stay plain'

    expect(autoMention?.applyToText(text)).toBe(text)
    expect(contexts).toEqual([])
  })
})
