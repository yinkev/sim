/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }))

vi.mock('@/lib/api/client/request', () => ({ requestJson }))

import type { OrganizationWhitelabelSettings } from '@/lib/branding/types'
import { useWhitelabelSettings, whitelabelKeys } from '@/ee/whitelabeling/hooks/whitelabel-query'

interface HarnessProps {
  initialData?: OrganizationWhitelabelSettings | null
  orgId: string
}

function Harness({ initialData, orgId }: HarnessProps) {
  useWhitelabelSettings(orgId, { initialData })
  return null
}

describe('useWhitelabelSettings server seed', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    requestJson.mockReset().mockResolvedValue({ data: { brandName: 'Fetched' } })
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

  it('does not fetch seeded data on mount but refetches when invalidated', async () => {
    await render({ orgId: 'org-1', initialData: { brandName: 'Seeded' } })

    expect(requestJson).not.toHaveBeenCalled()

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: whitelabelKeys.settings('org-1') })
    })

    expect(requestJson).toHaveBeenCalledTimes(1)
    expect(requestJson).toHaveBeenCalledWith(expect.anything(), {
      params: { id: 'org-1' },
      signal: expect.any(AbortSignal),
    })
  })

  it('fetches normally when the active organization changes away from the seeded key', async () => {
    await render({ orgId: 'org-1', initialData: null })
    expect(requestJson).not.toHaveBeenCalled()

    await render({ orgId: 'org-2' })

    expect(requestJson).toHaveBeenCalledTimes(1)
    expect(requestJson).toHaveBeenCalledWith(expect.anything(), {
      params: { id: 'org-2' },
      signal: expect.any(AbortSignal),
    })
  })
})
