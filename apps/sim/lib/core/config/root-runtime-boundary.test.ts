/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('root runtime import boundary', () => {
  it('keeps root and shared browser seams off the validated env graph', () => {
    const sources = [
      readSource('../../../app/layout.tsx'),
      readSource('../../../app/_shell/providers/posthog-provider.tsx'),
      readSource('../../../ee/whitelabeling/branding.ts'),
      readSource('../utils/urls.ts'),
      readSource('../../../instrumentation-client.ts'),
    ]

    for (const source of sources) {
      expect(source).not.toMatch(/@\/lib\/core\/config\/(?:env|env-flags)['"]/)
    }

    expect(sources[0]).toContain('@/lib/core/config/root-layout-flags')
    expect(sources[1]).toContain('@/lib/core/config/public-env')
    expect(sources[2]).toContain('@/lib/core/config/public-env')
    expect(sources[3]).toContain('@/lib/core/config/public-env')
    expect(sources[4]).toContain('@/lib/core/config/public-env')
    expect(sources[0]).toContain('@/app/_shell/providers/root-query-boundary')
    expect(sources[0]).not.toContain('@/app/_shell/providers/query-provider')
  })

  it('keeps the client branding wrapper off the server branding barrel', () => {
    const brandedLayout = readSource('../../../components/branded-layout.tsx')

    expect(brandedLayout).toContain("from '@/ee/whitelabeling/branding'")
    expect(brandedLayout).not.toContain("from '@/ee/whitelabeling'")
  })

  it('keeps next.config-compatible env helpers and flags self-contained', () => {
    const envSource = readSource('./env.ts')
    const envFlagsSource = readSource('./env-flags.ts')
    const rootFlagsSource = readSource('./root-layout-flags.ts')

    expect(envSource).not.toContain('/config/public-env')
    expect(envSource).toContain('export const getEnv')
    expect(envSource).toContain('export const isTruthy')
    expect(envFlagsSource).not.toContain('/config/root-layout-flags')
    expect(envFlagsSource).toContain('export const isAuthDisabled')
    expect(rootFlagsSource).not.toMatch(
      /@t3-oss\/env-nextjs|from ['"]zod['"]|\/config\/env['"]|\/config\/env-flags['"]/
    )
  })

  it('aliases the entire PostHog root provider when analytics is disabled', () => {
    const nextConfig = readSource('../../../next.config.ts')
    const disabledProvider = readSource(
      '../../../app/_shell/providers/posthog-provider-disabled.tsx'
    )

    expect(nextConfig).toMatch(
      /'@\/app\/_shell\/providers\/posthog-provider':\s*'@\/app\/_shell\/providers\/posthog-provider-disabled'/
    )
    expect(disabledProvider).not.toMatch(/posthog-js|useEffect|usePathname|createLogger/)
    expect(disabledProvider).toContain('return <>{children}</>')
  })
})
