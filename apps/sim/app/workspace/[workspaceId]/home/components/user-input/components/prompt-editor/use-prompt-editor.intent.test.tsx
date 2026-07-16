/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  integrationApplyToText,
  integrationProcessChange,
  mentionTokens,
  queryState,
  useAvailableResources,
  useIntegrationAutoMention,
  useMentionMenu,
  useMentionTokens,
  useSkills,
} = vi.hoisted(() => ({
  integrationApplyToText: vi.fn((text: string) => text),
  integrationProcessChange: vi.fn(({ nextValue }: { nextValue: string }) => nextValue),
  mentionTokens: {
    deleteRange: vi.fn(),
    findRangeContaining: vi.fn(() => undefined),
    mentionRanges: [],
  },
  queryState: {
    skills: [] as Array<{ id: string; name: string; description: string; content: string }>,
    textarea: null as HTMLTextAreaElement | null,
  },
  useAvailableResources: vi.fn(() => []),
  useIntegrationAutoMention: vi.fn(),
  useMentionMenu: vi.fn(),
  useMentionTokens: vi.fn(),
  useSkills: vi.fn(),
}))

vi.mock(
  '@/app/workspace/[workspaceId]/home/components/mothership-view/components/add-resource-dropdown',
  () => ({ useAvailableResources })
)

vi.mock('@/app/workspace/[workspaceId]/home/components/user-input/components/constants', () => ({
  mapResourceToContext: vi.fn(),
}))

vi.mock(
  '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/copilot/components/user-input/hooks/use-integration-auto-mention',
  () => ({ useIntegrationAutoMention })
)

vi.mock(
  '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/copilot/components/user-input/hooks/use-mention-menu',
  () => ({ useMentionMenu })
)

vi.mock(
  '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/copilot/components/user-input/hooks/use-mention-tokens',
  () => ({ useMentionTokens })
)

vi.mock('@/hooks/queries/skills', () => ({ useSkills }))

import {
  type PromptEditorInstance,
  usePromptEditor,
} from '@/app/workspace/[workspaceId]/home/components/user-input/components/prompt-editor/use-prompt-editor'
import { SKILL_CHIP_TRIGGER } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/copilot/components/user-input/utils'

let editor: PromptEditorInstance | null = null

function Harness({ initialValue = '' }: { initialValue?: string }) {
  editor = usePromptEditor({ workspaceId: 'workspace-1', initialValue })
  return null
}

describe('prompt editor query intent', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    queryState.skills = []
    queryState.textarea = document.createElement('textarea')
    editor = null

    useSkills.mockImplementation(() => ({ data: queryState.skills }))
    useAvailableResources.mockReturnValue([])
    useIntegrationAutoMention.mockReturnValue({
      applyToText: integrationApplyToText,
      processChange: integrationProcessChange,
    })
    useMentionMenu.mockImplementation(() => ({
      getActiveMentionQueryAtPosition: vi.fn(() => null),
      getActiveSlashQueryAtPosition: vi.fn(() => null),
      textareaRef: { current: queryState.textarea },
    }))
    useMentionTokens.mockReturnValue(mentionTokens)

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function render(initialValue = '') {
    await act(async () => root.render(<Harness initialValue={initialValue} />))
    if (!editor) throw new Error('Editor did not render')
    return editor
  }

  it('keeps skills and resources disabled until their first intent', async () => {
    await render()

    expect(useSkills).toHaveBeenLastCalledWith('workspace-1', { enabled: false })
    expect(useAvailableResources).toHaveBeenLastCalledWith(
      'workspace-1',
      expect.any(Set),
      undefined,
      { enabled: false }
    )
  })

  it('enables resources after the first toolbar or mention intent', async () => {
    const toolbarEditor = await render()

    await act(async () => toolbarEditor.openResourceMenu({ left: 10, top: 20 }))
    expect(useAvailableResources).toHaveBeenLastCalledWith(
      'workspace-1',
      expect.any(Set),
      undefined,
      { enabled: true }
    )

    await act(async () => root.unmount())
    root = createRoot(container)
    const mentionEditor = await render()
    const textarea = queryState.textarea as HTMLTextAreaElement
    textarea.value = '@'
    textarea.setSelectionRange(1, 1)

    await act(async () => {
      mentionEditor.handleInputChange({
        target: textarea,
      } as React.ChangeEvent<HTMLTextAreaElement>)
    })

    expect(useAvailableResources).toHaveBeenLastCalledWith(
      'workspace-1',
      expect.any(Set),
      undefined,
      { enabled: true }
    )
  })

  it('enables skills after the first slash intent', async () => {
    const current = await render()
    const textarea = queryState.textarea as HTMLTextAreaElement
    textarea.value = '/'
    textarea.setSelectionRange(1, 1)

    await act(async () => {
      current.handleInputChange({ target: textarea } as React.ChangeEvent<HTMLTextAreaElement>)
    })

    expect(useSkills).toHaveBeenLastCalledWith('workspace-1', { enabled: true })
  })

  it.each([
    ['seeded', (current: PromptEditorInstance) => current],
    ['restored', (current: PromptEditorInstance) => current.setValue('/review')],
  ])('loads and chipifies cold %s slash skill text', async (mode, prepare) => {
    const current = await render(mode === 'seeded' ? '/review' : '')

    await act(async () => {
      prepare(current)
    })
    expect(useSkills).toHaveBeenLastCalledWith('workspace-1', { enabled: true })
    expect(editor?.value).toBe('/review')

    queryState.skills = [
      { id: 'skill-1', name: 'review', description: 'Review code', content: 'Review it' },
    ]
    await act(async () =>
      root.render(<Harness initialValue={mode === 'seeded' ? '/review' : ''} />)
    )

    expect(editor?.value).toBe(`${SKILL_CHIP_TRIGGER}review`)
    expect(editor?.contexts).toContainEqual({
      kind: 'skill',
      skillId: 'skill-1',
      label: 'review',
    })
  })
})
