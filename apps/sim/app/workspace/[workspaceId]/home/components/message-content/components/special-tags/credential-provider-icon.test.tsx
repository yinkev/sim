/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/oauth/oauth', () => ({
  OAUTH_PROVIDERS: {
    github: {
      name: 'GitHub',
      icon: ({ className }: { className?: string }) => (
        <svg className={className} data-icon='github' />
      ),
      services: {
        issues: {
          name: 'GitHub Issues',
          providerId: 'github-issues',
          icon: ({ className }: { className?: string }) => (
            <svg className={className} data-icon='github-issues' />
          ),
        },
      },
    },
  },
}))

import { CredentialProviderIcon } from './credential-provider-icon'

describe('credential provider icon boundary', () => {
  it('keeps OAuth provider metadata behind the dynamic credential icon child', () => {
    const specialTags = readFileSync(new URL('./special-tags.tsx', import.meta.url), 'utf8')
    const credentialIcon = readFileSync(
      new URL('./credential-provider-icon.tsx', import.meta.url),
      'utf8'
    )

    expect(specialTags).toContain("import('./credential-provider-icon')")
    expect(specialTags).not.toContain('OAUTH_PROVIDERS')
    expect(specialTags).not.toContain('@/lib/oauth')
    expect(credentialIcon).toContain('OAUTH_PROVIDERS')
    expect(credentialIcon).toContain('@/lib/oauth/oauth')
  })

  it('renders exact base-provider and service icons', () => {
    const baseProvider = renderToStaticMarkup(
      <CredentialProviderIcon
        provider='GitHub'
        className='provider-icon'
        fallback={<span data-icon='lock' />}
      />
    )
    const service = renderToStaticMarkup(
      <CredentialProviderIcon
        provider='github-issues'
        className='provider-icon'
        fallback={<span data-icon='lock' />}
      />
    )

    expect(baseProvider).toContain('data-icon="github"')
    expect(baseProvider).toContain('class="provider-icon"')
    expect(service).toContain('data-icon="github-issues"')
  })

  it('renders the supplied lock fallback for unknown providers', () => {
    const html = renderToStaticMarkup(
      <CredentialProviderIcon provider='unknown' fallback={<span data-icon='lock' />} />
    )

    expect(html).toContain('data-icon="lock"')
  })
})
