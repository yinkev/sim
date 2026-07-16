/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }))

vi.mock('@/lib/api/client/request', () => ({ requestJson }))
vi.mock('@/lib/auth/auth-client', () => ({ client: { oauth2: { link: vi.fn() } } }))
vi.mock('@/lib/oauth', () => ({
  OAUTH_PROVIDERS: {
    google: {
      services: {
        gmail: { name: 'Gmail', providerId: 'google', scopes: [] },
      },
    },
  },
}))

import { useOAuthConnections } from '@/hooks/queries/oauth/oauth-connections'

function Harness({ enabled }: { enabled: boolean }) {
  useOAuthConnections({ enabled })
  return null
}

describe('useOAuthConnections query intent', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    requestJson.mockReset().mockResolvedValue({ connections: [] })
    queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 0 } },
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

  it('does not fetch until enabled, then uses the existing cancellable query', async () => {
    await render(false)
    expect(requestJson).not.toHaveBeenCalled()

    await render(true)
    expect(requestJson).toHaveBeenCalledTimes(1)
    expect(requestJson).toHaveBeenCalledWith(expect.anything(), {
      signal: expect.any(AbortSignal),
    })
  })
})
