/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { listOrganizations, getFullOrganization } = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  getFullOrganization: vi.fn(),
}))

vi.mock('@/lib/auth/auth-client', () => ({
  client: {
    organization: {
      list: listOrganizations,
      getFullOrganization,
    },
  },
}))

import { useOrganizations } from '@/hooks/queries/organization-list'

function Harness({ enabled }: { enabled?: boolean }) {
  useOrganizations({ enabled })
  return null
}

describe('useOrganizations intent', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    listOrganizations.mockReset().mockResolvedValue({ data: [] })
    getFullOrganization.mockReset().mockResolvedValue({ data: null })
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

  async function render(enabled?: boolean) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness enabled={enabled} />
        </QueryClientProvider>
      )
      await Promise.resolve()
    })
  }

  it('stays idle when explicitly disabled', async () => {
    await render(false)

    expect(listOrganizations).not.toHaveBeenCalled()
    expect(getFullOrganization).not.toHaveBeenCalled()
  })

  it('remains eager by default', async () => {
    await render()

    expect(listOrganizations).toHaveBeenCalledTimes(1)
    expect(getFullOrganization).toHaveBeenCalledTimes(1)
  })
})
