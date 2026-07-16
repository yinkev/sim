/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }))

vi.mock('@/lib/api/client/request', () => ({ requestJson }))

import {
  useWorkspacePermissionsQuery,
  workspacePermissionsKey,
} from '@/hooks/queries/workspace-permissions'

function Harness({ enabled }: { enabled: boolean }) {
  useWorkspacePermissionsQuery('workspace-1', { enabled })
  return null
}

describe('useWorkspacePermissionsQuery intent', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    requestJson.mockReset().mockResolvedValue({
      users: [],
      total: 0,
      viewer: { userId: 'user-1', isAdmin: false, permissionType: 'read' },
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

  async function render(enabled: boolean) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness enabled={enabled} />
        </QueryClientProvider>
      )
      await Promise.resolve()
    })
  }

  it('keeps the workspace key idle until enabled, then performs the cancellable request', async () => {
    await render(false)

    expect(requestJson).not.toHaveBeenCalled()
    expect(queryClient.getQueryState(workspacePermissionsKey('workspace-1'))?.fetchStatus).toBe(
      'idle'
    )

    await render(true)

    await vi.waitFor(() => expect(requestJson).toHaveBeenCalledTimes(1))
    expect(requestJson).toHaveBeenCalledWith(expect.anything(), {
      params: { id: 'workspace-1' },
      signal: expect.any(AbortSignal),
    })
  })
})
