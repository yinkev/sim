/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateRuntimeCSP } from '@/lib/core/security/runtime-csp'

describe('runtime CSP boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves request-time URLs without the validated env graph', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://self-hosted.example.com')
    vi.stubEnv('NEXT_PUBLIC_SOCKET_URL', 'https://socket.example.com')
    vi.stubEnv('OLLAMA_URL', 'http://ollama.example.com')
    vi.stubEnv('NEXT_PUBLIC_BRAND_LOGO_URL', 'https://brand.example.com/logo.png')

    const csp = generateRuntimeCSP()

    expect(csp).toContain('https://self-hosted.example.com')
    expect(csp).toContain('https://socket.example.com')
    expect(csp).toContain('wss://socket.example.com')
    expect(csp).toContain('http://ollama.example.com')
    expect(csp).toContain('https://brand.example.com')
  })

  it('keeps proxy off env validation and the build-time CSP module', () => {
    const runtimeSource = readFileSync(new URL('./runtime-csp.ts', import.meta.url), 'utf8')
    const proxySource = readFileSync(new URL('../../../proxy.ts', import.meta.url), 'utf8')

    expect(runtimeSource).not.toMatch(/config\/(?:env|env-flags)['"]/)
    expect(proxySource).toContain("from './lib/core/security/runtime-csp'")
    expect(proxySource).not.toContain("from './lib/core/security/csp'")
  })
})
