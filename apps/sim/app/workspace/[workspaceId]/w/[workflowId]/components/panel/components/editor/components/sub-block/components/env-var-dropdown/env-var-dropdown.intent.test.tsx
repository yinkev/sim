/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { usePersonalEnvironment, useWorkspaceEnvironment } = vi.hoisted(() => ({
  usePersonalEnvironment: vi.fn(),
  useWorkspaceEnvironment: vi.fn(),
}))

vi.mock('@/hooks/queries/environment', () => ({
  usePersonalEnvironment,
  useWorkspaceEnvironment,
}))

vi.mock('@/hooks/use-settings-navigation', () => ({
  useSettingsNavigation: () => ({ navigateToSettings: vi.fn() }),
}))

vi.mock('@/lib/credentials/client-state', () => ({
  writePendingCredentialCreateRequest: vi.fn(),
}))

vi.mock('@/components/emcn', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>
  return {
    Loader: () => <span data-testid='loader' />,
    Popover: Passthrough,
    PopoverAnchor: Passthrough,
    PopoverContent: Passthrough,
    PopoverItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    PopoverScrollArea: Passthrough,
    PopoverSection: Passthrough,
  }
})

import { EnvVarDropdown } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/editor/components/sub-block/components/env-var-dropdown/env-var-dropdown'

const BASE_PROPS = {
  onSelect: vi.fn(),
  inputValue: '{{',
  cursorPosition: 2,
  workspaceId: 'workspace-1',
}

describe('EnvVarDropdown query intent', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    usePersonalEnvironment.mockReset().mockReturnValue({ data: {}, isLoading: false })
    useWorkspaceEnvironment.mockReset().mockReturnValue({ data: undefined, isLoading: false })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function render(visible: boolean) {
    await act(async () => {
      root.render(<EnvVarDropdown {...BASE_PROPS} visible={visible} />)
    })
  }

  it('keeps hidden workspace and personal queries disabled', async () => {
    await render(false)

    expect(usePersonalEnvironment).toHaveBeenLastCalledWith({ enabled: false })
    expect(useWorkspaceEnvironment).toHaveBeenLastCalledWith(
      'workspace-1',
      expect.objectContaining({ enabled: false, select: expect.any(Function) })
    )
  })

  it('loads only the workspace aggregate and shows explicit loading on first open', async () => {
    useWorkspaceEnvironment.mockReturnValue({ data: undefined, isLoading: true })

    await render(true)

    expect(usePersonalEnvironment).toHaveBeenLastCalledWith({ enabled: false })
    expect(useWorkspaceEnvironment).toHaveBeenLastCalledWith(
      'workspace-1',
      expect.objectContaining({ enabled: true, select: expect.any(Function) })
    )
    expect(container.textContent).toContain('Loading secrets...')
    expect(container.querySelector('[data-testid="loader"]')).not.toBeNull()
  })

  it('uses workspace response for both workspace and personal names', async () => {
    useWorkspaceEnvironment.mockReturnValue({
      data: {
        workspace: { WORKSPACE_SECRET: 'masked' },
        personal: { PERSONAL_SECRET: 'value' },
        conflicts: [],
      },
      isLoading: false,
    })

    await render(true)

    expect(container.textContent).toContain('WORKSPACE_SECRET')
    expect(container.textContent).toContain('PERSONAL_SECRET')
  })

  it('falls back to the personal query when the workspace aggregate fails', async () => {
    usePersonalEnvironment.mockReturnValue({
      data: { PERSONAL_FALLBACK: { value: 'value' } },
      isLoading: false,
    })
    useWorkspaceEnvironment.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
    })

    await render(true)

    expect(usePersonalEnvironment).toHaveBeenLastCalledWith({ enabled: true })
    expect(container.textContent).toContain('PERSONAL_FALLBACK')
  })
})
