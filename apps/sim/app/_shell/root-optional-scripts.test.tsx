/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  RootOptionalAnalyticsScripts,
  RootOptionalBody,
  RootOptionalScripts,
} from '@/app/_shell/root-optional-scripts-disabled'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('root optional scripts boundary', () => {
  it('renders nothing when every optional root script is disabled', () => {
    const props = {
      isHosted: false,
      isReactGrabEnabled: false,
      isReactScanEnabled: false,
    }

    expect(renderToStaticMarkup(<RootOptionalScripts {...props} />)).toBe('')
    expect(renderToStaticMarkup(<RootOptionalAnalyticsScripts isHosted={false} />)).toBe('')
    expect(renderToStaticMarkup(<RootOptionalBody isHosted={false} />)).toBe('')
  })

  it('keeps next/script outside the root layout and aliases the no-op module safely', () => {
    const layout = readSource('../layout.tsx')
    const scripts = readSource('./root-optional-scripts.tsx')
    const config = readSource('../../next.config.ts')

    expect(layout).not.toContain("from 'next/script'")
    expect(layout).toContain("from '@/app/_shell/root-optional-scripts'")
    expect(scripts).toContain("from 'next/script'")
    expect(scripts).toContain("id='gtm'")
    expect(scripts).toContain("id='gtag-src'")
    expect(config).toContain("'@/app/_shell/root-optional-scripts'")
    expect(config).toContain("'@/app/_shell/root-optional-scripts-disabled'")
  })
})
