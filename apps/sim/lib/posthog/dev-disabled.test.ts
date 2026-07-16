import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('disabled PostHog development boundary', () => {
  it('aliases both PostHog entrypoints only for the disabled development server', () => {
    const nextConfig = readSource('../../next.config.ts')

    expect(nextConfig).toContain('phase === PHASE_DEVELOPMENT_SERVER')
    expect(nextConfig).toContain('!isTruthy(env.NEXT_PUBLIC_POSTHOG_ENABLED)')
    expect(nextConfig).toContain('!env.NEXT_PUBLIC_POSTHOG_KEY')
    expect(nextConfig).toContain("'posthog-js/react': '@/lib/posthog/dev-disabled-react'")
    expect(nextConfig).toContain("'posthog-js': '@/lib/posthog/dev-disabled'")
  })

  it('provides the exact no-op client and React exports used by the app', () => {
    const client = readSource('./dev-disabled.ts')
    const react = readSource('./dev-disabled-react.tsx')

    for (const method of [
      'capture',
      'group',
      'identify',
      'init',
      'reset',
      'sessionRecordingStarted',
      'startSessionRecording',
    ]) {
      expect(client).toContain(method)
    }

    expect(client).toContain('__loaded')
    expect(react).toContain('export function PostHogProvider')
    expect(react).toContain('export function usePostHog')
  })
})
