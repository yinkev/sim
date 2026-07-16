import { readFileSync } from 'node:fs'
import { useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SessionContext, SessionProvider } from '@/app/_shell/providers/session-provider-anonymous'
import { ImpersonationBanner } from '@/app/workspace/[workspaceId]/components/impersonation-banner/impersonation-banner-disabled'
import {
  useWorkspacePermissionsContext,
  WorkspacePermissionsProvider,
} from '@/app/workspace/[workspaceId]/providers/workspace-permissions-provider-anonymous'
import { BrandingProvider } from '@/ee/whitelabeling/components/branding-provider-disabled'

describe('anonymous workspace shell boundary', () => {
  it('provides the anonymous session and trusted-workspace permissions without queries', () => {
    let observedUserId: string | undefined
    let observedCanAdmin = false

    function Probe() {
      observedUserId = useContext(SessionContext)?.data?.user?.id
      observedCanAdmin = useWorkspacePermissionsContext().userPermissions.canAdmin
      return <span>ready</span>
    }

    const markup = renderToStaticMarkup(
      <SessionProvider authDisabled>
        <BrandingProvider initialOrganizationId={undefined} initialOrgSettings={null}>
          <WorkspacePermissionsProvider>
            <Probe />
            <ImpersonationBanner />
          </WorkspacePermissionsProvider>
        </BrandingProvider>
      </SessionProvider>
    )

    expect(markup).toBe('<span>ready</span>')
    expect(observedUserId).toBe('00000000-0000-0000-0000-000000000000')
    expect(observedCanAdmin).toBe(true)
  })

  it('aliases every disabled-auth shell compile root to a dependency-free implementation', () => {
    const nextConfig = readFileSync(new URL('../../../next.config.ts', import.meta.url), 'utf8')
    const sources = [
      './session-provider-anonymous.tsx',
      '../../workspace/[workspaceId]/providers/workspace-permissions-provider-anonymous.tsx',
      '../../../ee/whitelabeling/components/branding-provider-disabled.tsx',
      '../../workspace/[workspaceId]/components/impersonation-banner/impersonation-banner-disabled.tsx',
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))

    for (const alias of [
      '@/app/_shell/providers/session-provider-anonymous',
      '@/app/workspace/[workspaceId]/providers/workspace-permissions-provider-anonymous',
      '@/ee/whitelabeling/components/branding-provider-disabled',
      '@/app/workspace/[workspaceId]/components/impersonation-banner/impersonation-banner-disabled',
    ]) {
      expect(nextConfig).toContain(`'${alias}'`)
    }

    for (const source of sources) {
      expect(source).not.toMatch(/@tanstack|auth-client|api\/contracts|\bzod\b/)
    }
  })
})
