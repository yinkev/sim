import { getPageSession } from '@/lib/auth/page-session'
import { ImpersonationBanner } from '@/app/workspace/[workspaceId]/components/impersonation-banner'
import { WorkspaceChrome } from '@/app/workspace/[workspaceId]/components/workspace-chrome'
import { WorkspaceProviderBoundary } from '@/app/workspace/[workspaceId]/providers/workspace-provider-boundary'
import { generateOrgThemeCSS } from '@/ee/whitelabeling/org-branding-utils'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getPageSession()
  if (!session?.user) {
    const { redirect } = await import('next/navigation')
    return redirect('/login')
  }
  // The organization plugin is conditionally spread so TS can't infer activeOrganizationId on the base session type.
  const orgId = (session.session as { activeOrganizationId?: string } | null)?.activeOrganizationId
  const initialOrgSettings = orgId
    ? await import('@/ee/whitelabeling/org-branding').then(({ getOrgWhitelabelSettings }) =>
        getOrgWhitelabelSettings(orgId)
      )
    : null
  const initialThemeCSS = initialOrgSettings ? generateOrgThemeCSS(initialOrgSettings) : ''

  return (
    <div className='flex h-screen w-full flex-col overflow-hidden bg-[var(--surface-1)]'>
      <ImpersonationBanner />
      <WorkspaceChrome>
        <WorkspaceProviderBoundary
          initialOrganizationId={orgId}
          initialOrgSettings={initialOrgSettings}
          initialThemeCSS={initialThemeCSS}
        >
          {children}
        </WorkspaceProviderBoundary>
      </WorkspaceChrome>
    </div>
  )
}
