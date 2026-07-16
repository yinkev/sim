/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchPersonalEnvironment, fetchWorkspaceEnvironment } = vi.hoisted(() => ({
  fetchPersonalEnvironment: vi.fn(),
  fetchWorkspaceEnvironment: vi.fn(),
}))

vi.mock('@/lib/environment/api', () => ({
  fetchPersonalEnvironment,
  fetchWorkspaceEnvironment,
}))

import { usePersonalEnvironment, useWorkspaceEnvironment } from '@/hooks/queries/environment'

interface HarnessProps {
  personalEnabled: boolean
  workspaceEnabled: boolean
}

function Harness({ personalEnabled, workspaceEnabled }: HarnessProps) {
  usePersonalEnvironment({ enabled: personalEnabled })
  useWorkspaceEnvironment('workspace-1', { enabled: workspaceEnabled })
  return null
}

describe('environment query intent', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    fetchPersonalEnvironment.mockReset().mockResolvedValue({})
    fetchWorkspaceEnvironment.mockReset().mockResolvedValue({
      workspace: {},
      personal: {},
      conflicts: [],
    })
    queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 0, retry: false } },
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    queryClient.clear()
    container.remove()
    vi.unstubAllGlobals()
  })

  async function render(props: HarnessProps) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness {...props} />
        </QueryClientProvider>
      )
      await Promise.resolve()
    })
  }

  it('keeps both queries idle until their consumer enables them', async () => {
    await render({ personalEnabled: false, workspaceEnabled: false })
    expect(fetchPersonalEnvironment).not.toHaveBeenCalled()
    expect(fetchWorkspaceEnvironment).not.toHaveBeenCalled()

    await render({ personalEnabled: true, workspaceEnabled: false })
    await vi.waitFor(() => expect(fetchPersonalEnvironment).toHaveBeenCalledTimes(1))
    expect(fetchWorkspaceEnvironment).not.toHaveBeenCalled()

    await render({ personalEnabled: true, workspaceEnabled: true })
    await vi.waitFor(() => expect(fetchWorkspaceEnvironment).toHaveBeenCalledTimes(1))
  })
})
