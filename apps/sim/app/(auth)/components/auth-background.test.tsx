import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AuthBackground from '@/app/(auth)/components/auth-background'

describe('AuthBackground', () => {
  it('keeps the auth shell off the shared class merge runtime', () => {
    const source = readFileSync(new URL('./auth-background.tsx', import.meta.url), 'utf8')

    expect(source).not.toContain('@/lib/core/utils/cn')
    expect(source).not.toMatch(/\bcn\s*\(/)
  })

  it('appends the optional class to the fixed root classes', () => {
    const withoutClassName = renderToStaticMarkup(<AuthBackground />)
    const withClassName = renderToStaticMarkup(<AuthBackground className='dark font-[430]' />)

    expect(withoutClassName).toMatch(/^<div class="fixed inset-0 overflow-hidden">/)
    expect(withClassName).toMatch(/^<div class="fixed inset-0 overflow-hidden dark font-\[430\]">/)
  })
})
