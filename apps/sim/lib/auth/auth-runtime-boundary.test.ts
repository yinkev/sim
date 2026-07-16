import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('auth runtime boundary', () => {
  it('loads workflow cleanup only when a user is banned', () => {
    const source = readSource('./auth.ts')

    expect(source).not.toMatch(
      /^import .*from ['"]@\/lib\/workflows\/lifecycle['"]|^import \{[\s\S]*?\} from ['"]@\/lib\/workflows\/lifecycle['"]/m
    )
    expect(source).toContain("await import('@/lib/workflows/lifecycle')")
  })

  it('keeps workflow lifecycle off broad workflow construction utilities', () => {
    const lifecycle = readSource('../workflows/lifecycle.ts')
    const workflowQuery = readSource('../workflows/get-workflow-by-id.ts')

    expect(lifecycle).not.toContain('@/lib/workflows/utils')
    expect(lifecycle).toContain('@/lib/workflows/get-workflow-by-id')
    expect(workflowQuery).not.toMatch(/@\/blocks|@\/tools|@\/triggers|@\/stores/)
  })

  it('keeps webhook file processing off the workflow registry graph', () => {
    const executionFiles = readSource('../execution/files.ts')
    const triggerTypes = readSource('../workflows/triggers/trigger-types.ts')

    expect(executionFiles).toContain('@/lib/workflows/triggers/trigger-types')
    expect(executionFiles).not.toContain('@/lib/workflows/triggers/triggers')
    expect(triggerTypes).not.toMatch(/@\/blocks|@\/tools|@\/triggers|@\/stores/)
  })

  it('keeps lightweight workspace pages on the page-session boundary', () => {
    const workspaceLayout = readSource('../../app/workspace/[workspaceId]/layout.tsx')
    const homePage = readSource('../../app/workspace/[workspaceId]/home/page.tsx')
    const pageSession = readSource('./page-session.ts')

    for (const entrypoint of [workspaceLayout, homePage]) {
      expect(entrypoint).toContain('@/lib/auth/page-session')
      expect(entrypoint).not.toContain('@/lib/auth/server-session')
      expect(entrypoint).not.toContain("from '@/lib/auth'")
      expect(entrypoint).not.toContain("from '@/lib/auth/auth'")
      expect(entrypoint).not.toMatch(/^import \{ redirect \} from ['"]next\/navigation['"]/m)
      expect(entrypoint).toContain("await import('next/navigation')")
    }

    expect(pageSession).toContain('@/lib/auth/server-session')
    expect(pageSession).not.toMatch(/@\/lib\/(billing|webhooks|workflows)/)
  })

  it('uses the anonymous-only session boundary only in the disabled-auth dev server', () => {
    const nextConfig = readSource('../../next.config.ts')
    const anonymous = readSource('./anonymous.ts')
    const anonymousSessionFactory = readSource('./anonymous-session.ts')
    const anonymousPageSession = readSource('./page-session-anonymous.ts')
    const anonymousSession = readSource('./server-session-anonymous.ts')
    const workspaceLayout = readSource('../../app/workspace/[workspaceId]/layout.tsx')

    expect(nextConfig).toContain('PHASE_DEVELOPMENT_SERVER')
    expect(nextConfig).toMatch(/phase === PHASE_DEVELOPMENT_SERVER\s*&&/)
    expect(nextConfig).toMatch(/\(isAuthDisabled\s*\|\|\s*isPostHogDisabled/)
    expect(nextConfig).toContain('...(isAuthDisabled && {')
    expect(nextConfig).toContain("'@/lib/auth/server-session'")
    expect(nextConfig).toContain("'@/lib/auth/server-session-anonymous'")
    expect(nextConfig).toContain("'@/lib/auth/page-session'")
    expect(nextConfig).toContain("'@/lib/auth/page-session-anonymous'")
    expect(anonymousSession).not.toContain('@sim/auth/verify')
    expect(anonymousSession).toContain('if (!isAuthDisabled)')
    expect(anonymousSession).toContain('await ensureAnonymousUserExists()')
    expect(anonymousPageSession).toContain('@/lib/auth/anonymous-session')
    expect(anonymousPageSession).not.toMatch(
      /ensureAnonymousUserExists|['"]@\/lib\/auth\/anonymous['"]/
    )
    expect(anonymousSessionFactory).not.toMatch(/postgres|@sim\/logger|@sim\/utils\/id/)
    expect(anonymous).not.toMatch(/@sim\/db|drizzle-orm/)
    expect(workspaceLayout).not.toMatch(
      /^import \{ getOrgWhitelabelSettings \} from ['"]@\/ee\/whitelabeling\/org-branding['"]/m
    )
    expect(workspaceLayout).toContain("await import('@/ee/whitelabeling/org-branding')")
  })
})
