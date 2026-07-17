import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const routeDirectory = fileURLToPath(new URL('.', import.meta.url))

function readRouteSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

function readOptionalRouteSource(relativePath: string): string {
  try {
    return readRouteSource(relativePath)
  } catch {
    return ''
  }
}

describe('workspace route dependency boundaries', () => {
  it('initializes workflow scope only inside the workflow editor route', () => {
    const sharedLayout = readRouteSource('layout.tsx')
    const workflowLayout = readRouteSource('w/[workflowId]/layout.tsx')

    expect(sharedLayout).not.toContain('WorkspaceScopeSync')
    expect(workflowLayout).toContain('WorkspaceScopeSync')
  })

  it('keeps the workflow redirect page free of editor-only modules', () => {
    const redirectPage = readRouteSource('w/page.tsx')

    expect(redirectPage).not.toMatch(/ReactFlowProvider|\bPanel\b|\bTerminal\b/)
  })

  it('does not mount workflow realtime from the workspace root', () => {
    const workspaceRootLayout = readRouteSource('../layout.tsx')

    expect(workspaceRootLayout).not.toContain('SocketProvider')
  })

  it('keeps eager settings and provider discovery out of the shared workspace layout', () => {
    const sharedLayout = readRouteSource('layout.tsx')

    expect(sharedLayout).not.toMatch(
      /SettingsLoader|ProviderModelsLoader|WorkspaceRuntimeBoundary|WorkflowRealtimeBoundary/
    )
  })

  it('keeps Home outside query-backed workspace providers until runtime promotion', () => {
    const sharedLayout = readRouteSource('layout.tsx')
    const boundary = readOptionalRouteSource('providers/workspace-provider-boundary.tsx')
    const runtime = readOptionalRouteSource('providers/workspace-runtime-providers.tsx')

    expect(sharedLayout).toContain('WorkspaceProviderBoundary')
    expect(sharedLayout).not.toMatch(/BrandingProvider|WorkspacePermissionsProvider/)
    expect(boundary).not.toMatch(/@tanstack|WorkspacePermissionsProvider|BrandingProvider/)
    expect(boundary).toContain(
      "import('@/app/workspace/[workspaceId]/providers/workspace-runtime-providers')"
    )
    expect(runtime).toMatch(
      /QueryProvider[\s\S]*BrandingProvider[\s\S]*WorkspacePermissionsProvider/
    )
  })

  it('mounts workspace toast only for routes that consume it', () => {
    const sharedLayout = readRouteSource('layout.tsx')
    const toastBoundary = readOptionalRouteSource('providers/workspace-toast-provider.tsx')
    const workflowLayout = readRouteSource('w/layout.tsx')
    const tablesLayout = readOptionalRouteSource('tables/layout.tsx')

    expect(sharedLayout).not.toContain("from '@/components/emcn'")
    expect(sharedLayout).not.toContain('WorkspaceToastProvider')
    expect(toastBoundary).toContain("from '@/components/emcn'")
    expect(workflowLayout).toContain('WorkspaceToastProvider')
    expect(tablesLayout).toContain('WorkspaceToastProvider')
  })

  it('does not mount the no-op global tooltip provider', () => {
    const rootLayout = readRouteSource('../../layout.tsx')
    const tooltipProvider = readOptionalRouteSource('../../_shell/providers/tooltip-provider.tsx')

    expect(rootLayout).not.toContain('TooltipProvider')
    expect(tooltipProvider).toBe('')
  })

  it('keeps the root not-found boundary off the landing runtime', () => {
    const rootNotFound = readRouteSource('../../not-found.tsx')
    const globalError = readRouteSource('../../global-error.tsx')

    expect(rootNotFound).not.toMatch(/not-found-view|getNavBlogPosts|navbar/)
    expect(rootNotFound).not.toContain('@/lib/blog')
    expect(rootNotFound).not.toContain("from 'next/link'")
    expect(globalError).not.toContain("from 'next/error'")
  })

  it('loads workflow-only providers from the workflow route layout', () => {
    const runtimeBoundary = readOptionalRouteSource('providers/workspace-runtime-boundary.tsx')
    const workflowIndexLayout = readOptionalRouteSource('w/layout.tsx')
    const workflowLayout = readOptionalRouteSource('w/[workflowId]/layout.tsx')
    const workflowBoundary = readOptionalRouteSource('providers/workflow-realtime-boundary.tsx')
    const modelCombobox = readOptionalRouteSource(
      'w/[workflowId]/components/panel/components/editor/components/sub-block/components/combobox/combobox.tsx'
    )

    expect(runtimeBoundary).toBe('')
    expect(workflowIndexLayout).not.toMatch(
      /WorkflowRealtimeBoundary|WorkflowNavigationPortal|WorkspaceScopeSync/
    )
    expect(workflowLayout).toContain('WorkflowRealtimeBoundary')
    expect(workflowLayout).toContain('WorkflowNavigationPortal')
    expect(workflowBoundary).toContain('SocketProvider')
    expect(workflowBoundary).not.toContain('ProviderModelsLoader')
    expect(modelCombobox).toContain(
      "import('@/app/workspace/[workspaceId]/providers/provider-models-loader')"
    )
    expect(modelCombobox).toContain("subBlockId === 'model'")
    expect(modelCombobox).toContain('useProvidersStore')
  })

  it('mounts global commands only for workflow routes that register them', () => {
    const sharedLayout = readRouteSource('layout.tsx')
    const workflowIndexLayout = readRouteSource('w/layout.tsx')

    expect(sharedLayout).not.toContain('GlobalCommandsProvider')
    expect(workflowIndexLayout).toContain('GlobalCommandsProvider')
  })

  it('keeps workflow connection state out of shared workspace permissions', () => {
    const permissionsProvider = readRouteSource('providers/workspace-permissions-provider.tsx')
    const workflowPermissionsProvider = readOptionalRouteSource(
      'providers/workflow-permissions-provider.tsx'
    )
    const workflowBoundary = readOptionalRouteSource('providers/workflow-realtime-boundary.tsx')

    expect(permissionsProvider).not.toMatch(/useSocket|useOperationQueueStore/)
    expect(workflowPermissionsProvider).toMatch(/useSocket|useOperationQueueStore/)
    expect(workflowBoundary).toContain('WorkflowPermissionsProvider')
  })

  it('keeps shared workspace providers on narrow query seams', () => {
    const permissionsProvider = readRouteSource('providers/workspace-permissions-provider.tsx')
    const brandingProvider = readRouteSource(
      '../../../ee/whitelabeling/components/branding-provider.tsx'
    )
    const workspacePermissionsQuery = readRouteSource(
      '../../../hooks/queries/workspace-permissions.ts'
    )
    const organizationListQuery = readRouteSource('../../../hooks/queries/organization-list.ts')
    const whitelabelQuery = readRouteSource('../../../ee/whitelabeling/hooks/whitelabel-query.ts')

    expect(permissionsProvider).toContain('@/hooks/queries/workspace-permissions')
    expect(permissionsProvider).not.toContain("from '@/hooks/queries/workspace'")
    expect(brandingProvider).toContain('@/hooks/queries/organization-list')
    expect(brandingProvider).not.toContain("from '@/hooks/queries/organization'")
    expect(brandingProvider).toContain('@/ee/whitelabeling/hooks/whitelabel-query')
    expect(brandingProvider).not.toContain("from '@/ee/whitelabeling/hooks/whitelabel'")
    expect(workspacePermissionsQuery).not.toContain("from '@/hooks/queries/workspace'")
    expect(organizationListQuery).not.toContain("from '@/hooks/queries/organization'")
    expect(whitelabelQuery).not.toContain("from '@/ee/whitelabeling/hooks/whitelabel'")
  })

  it('defers shared-provider API and auth clients until their queries execute', () => {
    const workspacePermissionsQuery = readRouteSource(
      '../../../hooks/queries/workspace-permissions.ts'
    )
    const organizationListQuery = readRouteSource('../../../hooks/queries/organization-list.ts')
    const whitelabelQuery = readRouteSource('../../../ee/whitelabeling/hooks/whitelabel-query.ts')

    expect(workspacePermissionsQuery).not.toMatch(
      /import\s*\{[^}]*\brequestJson\b[^}]*\}\s*from\s*['"]@\/lib\/api\/client\/request['"]/s
    )
    expect(workspacePermissionsQuery).not.toMatch(
      /import\s*\{[^}]*\bgetWorkspacePermissionsContract\b[^}]*\}\s*from\s*['"]@\/lib\/api\/contracts\/workspaces['"]/s
    )
    expect(workspacePermissionsQuery).toContain("import('@/lib/api/client/request')")
    expect(workspacePermissionsQuery).toContain("import('@/lib/api/contracts/workspaces')")

    expect(organizationListQuery).not.toMatch(/^import .*@\/lib\/auth\/auth-client/m)
    expect(organizationListQuery).toContain("await import('@/lib/auth/auth-client')")

    expect(whitelabelQuery).not.toMatch(
      /import\s*\{[^}]*\brequestJson\b[^}]*\}\s*from\s*['"]@\/lib\/api\/client\/request['"]/s
    )
    expect(whitelabelQuery).not.toMatch(
      /import\s*\{[^}]*\bgetOrganizationWhitelabelContract\b[^}]*\}\s*from\s*['"]@\/lib\/api\/contracts\/organization['"]/s
    )
    expect(whitelabelQuery).toContain("import('@/lib/api/client/request')")
    expect(whitelabelQuery).toContain("import('@/lib/api/contracts/organization')")
  })

  it('keeps chat pages on the narrow server-session boundary', () => {
    const newChatPage = readRouteSource('chat/new/page.tsx')
    const chatPage = readRouteSource('chat/[chatId]/page.tsx')

    for (const page of [newChatPage, chatPage]) {
      expect(page).toContain("from '@/lib/auth/server-session'")
      expect(page).not.toContain("from '@/lib/auth'")
    }
  })

  it('keeps the chat runtime off the aggregate API contract barrel', () => {
    const homeRuntime = readRouteSource('home/home-runtime.tsx')
    const newChatRuntime = readRouteSource('chat/new/new-chat-runtime.tsx')
    const templateRuntime = readRouteSource('chat/new/template/template-import-runtime.tsx')
    const folderQueries = readRouteSource('../../../hooks/queries/folders.ts')

    expect(templateRuntime).toContain('@/lib/api/contracts/workflows')
    expect(homeRuntime).not.toContain("from '@/lib/api/contracts'")
    expect(newChatRuntime).not.toContain("from '@/lib/api/contracts'")
    expect(templateRuntime).not.toContain("from '@/lib/api/contracts'")
    expect(folderQueries).toContain('@/lib/api/contracts/folders')
    expect(folderQueries).not.toContain("from '@/lib/api/contracts'")
  })

  it('keeps chat list reads off broad mutation modules', () => {
    const homeRuntime = readRouteSource('home/home-runtime.tsx')
    const useChat = readRouteSource('home/hooks/use-chat.ts')
    const streamContext = readRouteSource('home/hooks/stream/stream-context.ts')
    const handleSessionEvent = readRouteSource('home/hooks/stream/handle-session-event.ts')

    expect(homeRuntime).toContain('@/hooks/queries/folder-list')
    expect(homeRuntime).toContain('@/hooks/queries/workflow-list')
    expect(homeRuntime).toContain('@/hooks/queries/workspace-file-list')
    expect(homeRuntime).not.toMatch(
      /from ['"]@\/hooks\/queries\/(folders|workflows|workspace-files)['"]/
    )
    expect(homeRuntime).toContain('@/hooks/queries/mothership-chat-history')
    expect(homeRuntime).toContain('@/hooks/queries/mothership-chat-read')
    for (const source of [homeRuntime, useChat, streamContext, handleSessionEvent]) {
      expect(source).not.toContain("from '@/hooks/queries/mothership-chats'")
    }
  })

  it('keeps the Studio sidebar owned by the workflow route', () => {
    const workspaceChrome = readRouteSource('components/workspace-chrome/workspace-chrome.tsx')
    const workflowLayout = readOptionalRouteSource('w/[workflowId]/layout.tsx')
    const workflowNavigation = readOptionalRouteSource(
      'w/components/sidebar/workflow-navigation-portal.tsx'
    )

    expect(workspaceChrome).not.toMatch(
      /from ['"]@\/app\/workspace\/\[workspaceId\]\/w\/components\/sidebar\/sidebar['"]/
    )
    expect(workspaceChrome).not.toMatch(
      /import\(['"]@\/app\/workspace\/\[workspaceId\]\/w\/components\/sidebar\/sidebar['"]\)/
    )
    expect(workspaceChrome).toContain('MainWebNavigation')
    expect(workspaceChrome).toContain('workspace-navigation-root')
    expect(workflowLayout).toContain('WorkflowNavigationPortal')
    expect(workflowNavigation).toMatch(
      /from ['"]@\/app\/workspace\/\[workspaceId\]\/w\/components\/sidebar\/sidebar['"]/
    )
  })

  it('keeps the workflow redirect on narrow list and contract seams', () => {
    const redirectPage = readRouteSource('w/page.tsx')
    const workflowListQuery = readRouteSource('../../../hooks/queries/utils/workflow-list-query.ts')

    expect(redirectPage).toContain('@/hooks/queries/workflow-list')
    expect(redirectPage).not.toContain("from '@/hooks/queries/workflows'")
    expect(workflowListQuery).toContain('@/lib/api/contracts/workflows')
    expect(workflowListQuery).not.toContain("from '@/lib/api/contracts'")
  })

  it('keeps main-web navigation free of workflow runtime dependencies', () => {
    const mainWebNavigation = readOptionalRouteSource(
      'components/workspace-chrome/main-web-navigation.tsx'
    )
    const workspaceChrome = readOptionalRouteSource(
      'components/workspace-chrome/workspace-chrome.tsx'
    )

    expect(mainWebNavigation).not.toBe('')
    expect(mainWebNavigation).not.toMatch(/@\/stores\/workflows|useWorkflowStore/)
    expect(mainWebNavigation).not.toMatch(/@\/(blocks|tools|triggers)(\/|['"])/)
    expect(mainWebNavigation).not.toContain('/w/components/sidebar')
    expect(mainWebNavigation).not.toContain('@/hooks/queries/workflows')
    expect(mainWebNavigation).not.toContain("from 'next/link'")
    expect(mainWebNavigation).not.toContain("from 'lucide-react'")
    expect(mainWebNavigation).not.toContain('@/lib/core/utils/cn')
    expect(workspaceChrome).not.toContain('@/lib/core/utils/cn')
  })

  it('prefetches main-web routes only after user intent', () => {
    const mainWebNavigation = readRouteSource('components/workspace-chrome/main-web-navigation.tsx')

    expect(mainWebNavigation).toContain('router.prefetch(href)')
    expect(mainWebNavigation).not.toMatch(/navigationItems\.(?:forEach|map)\([^)]*router\.prefetch/)
    expect(mainWebNavigation).not.toMatch(/useQueryClient|prefetchQuery|@tanstack/)
  })

  it('keeps integration catalog routes off the executable block registry', () => {
    const sources = [
      readRouteSource('integrations/integrations.tsx'),
      readRouteSource('integrations/components/integrations-showcase/integrations-showcase.tsx'),
      readRouteSource('integrations/[block]/page.tsx'),
      readRouteSource('integrations/[block]/integration-block-detail.tsx'),
      readRouteSource('integrations/connected/[credentialId]/connected-credential-detail.tsx'),
      readRouteSource('skills/skills.tsx'),
    ]

    for (const source of sources) {
      expect(source).not.toMatch(/from ['"]@\/lib\/integrations['"]/)
      expect(source).not.toMatch(/from ['"]@\/blocks(?:\/registry)?['"]/)
    }
    expect(sources[0]).toContain('@/lib/integrations/client-catalog')
    expect(sources[1]).toContain('@/lib/integrations/client-catalog')
    expect(sources[2]).toContain('@/lib/integrations/catalog')
    expect(sources[2]).toContain('@/lib/integrations/integration-details')
  })

  it('renders resource chrome before client list APIs resolve', () => {
    const routes = [
      { name: 'knowledge', title: 'Knowledge Base' },
      { name: 'files', title: 'Files' },
      { name: 'tables', title: 'Tables' },
    ] as const

    for (const { name, title } of routes) {
      const page = readRouteSource(`${name}/page.tsx`)
      const loading = readRouteSource(`${name}/loading.tsx`)

      expect(page).not.toMatch(/HydrationBoundary|dehydrate|getQueryClient|prefetch[A-Z]/)
      expect(loading).toContain('ResourceChromeFallback')
      expect(loading).toContain(`title='${title}'`)
    }
  })

  it('keeps resource list routes off executable block permission metadata', () => {
    const routeSources = [
      readRouteSource('knowledge/knowledge.tsx'),
      readRouteSource('files/files.tsx'),
      readRouteSource('tables/tables.tsx'),
    ]
    const permissionConfig = readRouteSource('../../../hooks/use-permission-group-config.ts')

    for (const source of routeSources) {
      expect(source).toContain('@/hooks/use-permission-group-config')
      expect(source).not.toContain('@/hooks/use-permission-config')
    }
    expect(permissionConfig).not.toMatch(/block-access|@\/blocks/)
  })

  it('keeps resource routes on leaf UI and interaction imports', () => {
    const routeNames = ['knowledge', 'files', 'tables'] as const

    for (const name of routeNames) {
      const source = readRouteSource(`${name}/${name}.tsx`)
      const loading = readRouteSource(`${name}/loading.tsx`)
      const error = readRouteSource(`${name}/error.tsx`)

      expect(source).not.toContain("from '@/app/workspace/[workspaceId]/components'")
      expect(source).not.toContain(
        "from '@/app/workspace/[workspaceId]/w/components/sidebar/hooks'"
      )
      expect(loading).not.toContain("from '@/app/workspace/[workspaceId]/components'")
      expect(error).not.toContain("from '@/app/workspace/[workspaceId]/components'")
    }
  })

  it('defers the Files detail viewer and sharing UI from the list route', () => {
    const files = readRouteSource('files/files.tsx')
    const detail = readRouteSource('files/[fileId]/file-detail.tsx')
    const capabilities = readRouteSource('files/components/file-viewer/file-capabilities.ts')
    const viewer = readRouteSource('files/components/file-viewer/file-viewer.tsx')

    expect(files).toContain("import dynamic from 'next/dynamic'")
    expect(files).not.toContain('file-viewer/file-viewer')
    expect(detail).toContain(
      "from '@/app/workspace/[workspaceId]/files/components/file-viewer/file-viewer'"
    )
    expect(detail).toContain('FileViewerComponent={FileViewer}')
    expect(files).toContain(
      "import('@/app/workspace/[workspaceId]/files/components/share-modal/share-modal')"
    )
    expect(files).not.toMatch(
      /from ['"]@\/app\/workspace\/\[workspaceId\]\/files\/components\/file-viewer['"]/
    )
    expect(files).not.toMatch(
      /from ['"]@\/app\/workspace\/\[workspaceId\]\/files\/components\/file-viewer\/file-viewer['"]/
    )
    expect(files).not.toMatch(
      /from ['"]@\/app\/workspace\/\[workspaceId\]\/files\/components\/share-modal['"]/
    )
    expect(files).toContain(
      "from '@/app/workspace/[workspaceId]/files/components/file-viewer/file-capabilities'"
    )
    expect(viewer).toContain("from './file-capabilities'")
    expect(capabilities).not.toMatch(/from ['"](?:react|next\/|@\/hooks)/)
    expect(capabilities).not.toMatch(
      /file-viewer['"]|preview-panel|(?:csv|docx|image|pptx|xlsx)-preview|text-editor/
    )
  })

  it('provides route loading chrome for integration lists and details', () => {
    const integrationsLoading = readRouteSource('integrations/loading.tsx')
    const skillsLoading = readRouteSource('skills/loading.tsx')
    const detailLoading = readRouteSource('integrations/[block]/loading.tsx')

    expect(integrationsLoading).toContain('IntegrationTabsHeader')
    expect(skillsLoading).toContain('IntegrationTabsHeader')
    expect(detailLoading).toContain('IntegrationDetailLoading')
  })

  it('keeps shared error boundaries off the workspace component barrel', () => {
    const errorBoundary = readRouteSource('error.tsx')
    const sharedError = readRouteSource('components/error/error.tsx')
    const notFoundBoundary = readRouteSource('not-found.tsx')

    for (const boundary of [errorBoundary, notFoundBoundary]) {
      expect(boundary).not.toMatch(/from ['"]@\/app\/workspace\/\[workspaceId\]\/components['"]/)
      expect(boundary).toContain('@/app/workspace/[workspaceId]/components/error')
    }
    expect(notFoundBoundary).not.toContain("from 'next/link'")
    for (const boundary of [sharedError, notFoundBoundary]) {
      expect(boundary).not.toContain("from 'lucide-react'")
      expect(boundary).not.toContain("from '@/components/emcn'")
    }
  })

  it('resolves fixtures relative to this route directory', () => {
    expect(routeDirectory).toContain('/app/workspace/[workspaceId]/')
  })
})
