/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pathname: '/workspace/workspace-1/chat/new',
  query: vi.fn(),
  refetch: vi.fn(),
  useUserPermissions: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'workspace-1' }),
  usePathname: () => mocks.pathname,
}))

vi.mock('@/hooks/queries/workspace-permissions', () => ({
  useWorkspacePermissionsQuery: mocks.query,
  workspacePermissionsKey: (workspaceId: string) => [
    'workspace',
    'detail',
    workspaceId,
    'permissions',
  ],
}))

vi.mock('@/hooks/use-user-permissions', () => ({
  useUserPermissions: mocks.useUserPermissions,
}))

import {
  useWorkspacePermissionsContext,
  WorkspacePermissionsProvider,
} from '@/app/workspace/[workspaceId]/providers/workspace-permissions-provider'

type PermissionsContext = ReturnType<typeof useWorkspacePermissionsContext>

const cachedPermissions = {
  users: [],
  total: 0,
  viewer: { userId: 'user-1', isAdmin: true, permissionType: 'admin' as const },
}

let observedContext: PermissionsContext | null = null

function ContextProbe() {
  observedContext = useWorkspacePermissionsContext()
  return null
}

describe('WorkspacePermissionsProvider route intent', () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    mocks.pathname = '/workspace/workspace-1/chat/new'
    mocks.refetch.mockReset().mockResolvedValue(undefined)
    mocks.query.mockReset().mockReturnValue({
      data: cachedPermissions,
      isLoading: false,
      error: new Error('cached error'),
      refetch: mocks.refetch,
    })
    mocks.useUserPermissions.mockReset().mockReturnValue({
      canRead: false,
      canEdit: false,
      canAdmin: false,
      userPermissions: 'read',
      isLoading: true,
      error: null,
    })
    observedContext = null
    queryClient = new QueryClient()
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

  async function renderProvider() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <WorkspacePermissionsProvider>
            <ContextProbe />
          </WorkspacePermissionsProvider>
        </QueryClientProvider>
      )
    })
  }

  it('keeps exact new-chat permissions disabled and fail-closed', async () => {
    await renderProvider()

    expect(mocks.query).toHaveBeenCalledWith('workspace-1', { enabled: false })
    expect(mocks.useUserPermissions).toHaveBeenCalledWith(null, true, null)
    expect(observedContext).toMatchObject({
      workspacePermissions: null,
      permissionsLoading: true,
      permissionsError: null,
    })

    await act(async () => observedContext?.refetchPermissions())
    expect(mocks.refetch).not.toHaveBeenCalled()
  })

  it.each(['/workspace/workspace-1/chat/chat-1', '/workspace/workspace-1/w/workflow-1'])(
    'keeps permissions enabled on %s',
    async (pathname) => {
      mocks.pathname = pathname
      await renderProvider()

      expect(mocks.query).toHaveBeenCalledWith('workspace-1', { enabled: true })
      expect(mocks.useUserPermissions).toHaveBeenCalledWith(
        cachedPermissions,
        false,
        'cached error'
      )
      expect(observedContext).toMatchObject({
        workspacePermissions: cachedPermissions,
        permissionsLoading: false,
        permissionsError: 'cached error',
      })

      await act(async () => observedContext?.refetchPermissions())
      expect(mocks.refetch).toHaveBeenCalledTimes(1)
    }
  )
})
