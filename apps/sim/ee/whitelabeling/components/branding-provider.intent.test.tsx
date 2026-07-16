/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { listOrganizations, getFullOrganization, requestJson } = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  getFullOrganization: vi.fn(),
  requestJson: vi.fn(),
}))

vi.mock('@/lib/auth/auth-client', () => ({
  client: {
    organization: {
      list: listOrganizations,
      getFullOrganization,
    },
  },
}))
vi.mock('@/lib/api/client/request', () => ({ requestJson }))

import { BrandingProvider } from '@/ee/whitelabeling/components/branding-provider'
import { organizationKeys } from '@/hooks/queries/organization-keys'

describe('BrandingProvider idle queries', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    listOrganizations.mockReset().mockResolvedValue({ data: [] })
    getFullOrganization.mockReset().mockResolvedValue({ data: null })
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

  async function render() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <BrandingProvider initialOrganizationId='org-1' initialOrgSettings={null}>
            <span>child</span>
          </BrandingProvider>
        </QueryClientProvider>
      )
      await Promise.resolve()
    })
  }

  it('uses the workspace server seed without organization or whitelabel requests', async () => {
    await render()

    expect(listOrganizations).not.toHaveBeenCalled()
    expect(getFullOrganization).not.toHaveBeenCalled()
    expect(requestJson).not.toHaveBeenCalled()
  })

  it('observes a cached active organization change and fetches its whitelabel key', async () => {
    await render()

    await act(async () => {
      queryClient.setQueryData(organizationKeys.lists(), {
        organizations: [],
        activeOrganization: { id: 'org-2' },
      })
    })

    await vi.waitFor(() => expect(requestJson).toHaveBeenCalledTimes(1))
    expect(requestJson).toHaveBeenCalledWith(expect.anything(), {
      params: { id: 'org-2' },
      signal: expect.any(AbortSignal),
    })
  })

  it('receives the active organization id from the workspace layout', () => {
    const layoutSource = readFileSync(
      resolve(process.cwd(), 'app/workspace/[workspaceId]/layout.tsx'),
      'utf8'
    )

    expect(layoutSource).toContain('initialOrganizationId={orgId}')
  })
})
