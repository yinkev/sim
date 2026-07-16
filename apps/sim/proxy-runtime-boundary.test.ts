import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('proxy cold runtime boundary', () => {
  it('keeps heavyweight auth, analytics, and application env modules off the static path', () => {
    const proxy = readSource('./proxy.ts')

    expect(proxy).not.toMatch(/^import .*better-auth\/cookies/m)
    expect(proxy).not.toMatch(/^import .*lib\/analytics\/profound/m)
    expect(proxy).not.toMatch(/^import .*lib\/core\/config\/env(?:-flags)?['"]/m)
    expect(proxy).toContain("from './lib/core/config/proxy-env'")
  })

  it('loads auth only when required and analytics without delaying the response', () => {
    const proxy = readSource('./proxy.ts')

    expect(proxy).toContain('if (!isAuthDisabled)')
    expect(proxy).toContain("await import('better-auth/cookies')")
    expect(proxy).toContain("void import('@/lib/analytics/profound')")
  })

  it('aliases disabled local proxy services to dependency-free leaves', () => {
    const nextConfig = readSource('./next.config.ts')
    const authDisabled = readSource('./lib/auth/better-auth-cookies-disabled.ts')
    const profoundDisabled = readSource('./lib/analytics/profound-disabled.ts')

    expect(nextConfig).toMatch(
      /'better-auth\/cookies':\s*'@\/lib\/auth\/better-auth-cookies-disabled'/
    )
    expect(nextConfig).toMatch(
      /'@\/lib\/analytics\/profound':\s*'@\/lib\/analytics\/profound-disabled'/
    )
    for (const source of [authDisabled, profoundDisabled]) {
      expect(source).not.toMatch(/^import /m)
    }
  })

  it('keeps the lightweight proxy env leaf independent of the application env graph', () => {
    const proxyEnv = readSource('./lib/core/config/proxy-env.ts')

    expect(proxyEnv).not.toMatch(/^import /m)
    expect(proxyEnv).not.toContain('createEnv')
  })
})
