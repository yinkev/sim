import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getOrgWhitelabelSettings } from '@/ee/whitelabeling/org-branding-disabled'

describe('disabled-auth organization branding boundary', () => {
  it('returns no organization settings without persistence', async () => {
    await expect(getOrgWhitelabelSettings('org-1')).resolves.toBeNull()
  })

  it('aliases the organization branding loader in disabled-auth development', () => {
    const nextConfig = readFileSync(new URL('../../next.config.ts', import.meta.url), 'utf8')

    expect(nextConfig).toContain(
      "'@/ee/whitelabeling/org-branding': '@/ee/whitelabeling/org-branding-disabled'"
    )
  })
})
