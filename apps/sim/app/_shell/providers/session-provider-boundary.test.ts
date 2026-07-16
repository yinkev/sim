/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('SessionProvider import boundary', () => {
  it('keeps Better Auth off the static provider graph', () => {
    const source = readSource('./session-provider.tsx')

    expect(source).not.toContain("import { client } from '@/lib/auth/auth-client'")
    expect(source).toContain("await import('@/lib/auth/auth-client')")
  })

  it('loads the upgrade-only organization request after an upgrade redirect', () => {
    const source = readSource('./session-provider.tsx')

    expect(source).not.toMatch(
      /import\s*\{[^}]*\brequestJson\b[^}]*\}\s*from\s*['"]@\/lib\/api\/client\/request['"]/s
    )
    expect(source).not.toMatch(
      /import\s*\{[^}]*\blistCreatorOrganizationsContract\b[^}]*\}\s*from\s*['"]@\/lib\/api\/contracts\/organizations['"]/s
    )
    expect(source).toContain("import('@/lib/api/client/request')")
    expect(source).toContain("import('@/lib/api/contracts/organizations')")
    expect(source).not.toContain("from '@tanstack/react-query'")
    expect(source).toContain("import('@/app/_shell/providers/get-query-client')")
  })

  it('keeps shared session consumers on the lightweight context leaf', () => {
    const hook = readSource('./use-session.ts')
    const authClient = readSource('../../../lib/auth/auth-client.ts')
    const permissions = readSource('../../../hooks/use-user-permissions.ts')
    const impersonationBanner = readSource(
      '../../workspace/[workspaceId]/components/impersonation-banner/impersonation-banner.tsx'
    )

    expect(hook).toContain('export function useSession()')
    expect(hook).toContain('SessionContext')
    expect(hook).not.toMatch(/better-auth|@better-auth|@\/lib\/auth\/auth-client/)

    expect(authClient).toContain("export { useSession } from '@/app/_shell/providers/use-session'")
    expect(authClient).not.toContain('useContext')
    expect(authClient).not.toContain('SessionContext')

    for (const source of [permissions, impersonationBanner]) {
      expect(source).toContain("from '@/app/_shell/providers/use-session'")
      expect(source).not.toContain("from '@/lib/auth/auth-client'")
    }
  })

  it('loads the admin auth client only inside query and mutation operations', () => {
    const source = readSource('../../../hooks/queries/admin-users.ts')

    expect(source).not.toMatch(/^import .*['"]@\/lib\/auth\/auth-client['"]/m)
    expect(source).toContain("await import('@/lib/auth/auth-client')")
  })
})
