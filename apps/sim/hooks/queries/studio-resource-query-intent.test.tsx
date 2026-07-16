/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }))

vi.mock('@/lib/api/client/request', () => ({ requestJson }))

import { useCustomTools } from '@/hooks/queries/custom-tools'
import { useMcpServers } from '@/hooks/queries/mcp'

interface HarnessProps {
  customToolsEnabled: boolean
  mcpServersEnabled: boolean
}

function Harness({ customToolsEnabled, mcpServersEnabled }: HarnessProps) {
  useCustomTools('workspace-1', { enabled: customToolsEnabled })
  useMcpServers('workspace-1', { enabled: mcpServersEnabled })
  return null
}

describe('studio resource query intent', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    requestJson.mockReset().mockResolvedValue({ data: { servers: [] } })
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

  it('keeps both catalogs idle until their consumer enables them', async () => {
    await render({ customToolsEnabled: false, mcpServersEnabled: false })
    expect(requestJson).not.toHaveBeenCalled()

    await render({ customToolsEnabled: true, mcpServersEnabled: false })
    await vi.waitFor(() => expect(requestJson).toHaveBeenCalledTimes(1))

    await render({ customToolsEnabled: true, mcpServersEnabled: true })
    await vi.waitFor(() => expect(requestJson).toHaveBeenCalledTimes(2))
  })
})
