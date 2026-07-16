import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicEnvScript } from '@/lib/core/config/public-env-script'

describe('PublicEnvScript', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('serializes only public runtime environment variables', () => {
    vi.stubEnv('NEXT_PUBLIC_RUNTIME_TEST', 'visible')
    vi.stubEnv('PRIVATE_RUNTIME_TEST', 'hidden')

    const markup = renderToStaticMarkup(<PublicEnvScript />)

    expect(markup).toContain(`window['__ENV'] =`)
    expect(markup).toContain('"NEXT_PUBLIC_RUNTIME_TEST"')
    expect(markup).toContain('"visible"')
    expect(markup).not.toContain('PRIVATE_RUNTIME_TEST')
    expect(markup).not.toContain('hidden')
  })

  it('keeps the root layout off next-runtime-env and Next cache internals', () => {
    const layout = readFileSync(new URL('../../../app/layout.tsx', import.meta.url), 'utf8')

    expect(layout).toContain("from '@/lib/core/config/public-env-script'")
    expect(layout).toContain("export const dynamic = 'force-dynamic'")
    expect(layout).not.toContain('next-runtime-env')
    expect(layout).not.toContain('next/cache')
  })
})
