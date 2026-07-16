import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('toast motion boundary', () => {
  it('keeps workspace toast animation local to the toast component', () => {
    const toast = readSource('toast.tsx')
    const styles = readSource('toast.module.css')

    expect(toast).not.toContain('framer-motion')
    expect(toast).toContain('@/components/emcn/components/toast/toast.module.css')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(styles).toMatch(/\.toastItem[\s\S]*transition:/)
    expect(styles).toMatch(/\.toastItemExiting[\s\S]*opacity:\s*0/)
    expect(styles).toMatch(/\.stackExiting[\s\S]*opacity:\s*0/)
    expect(styles).toMatch(/\.revealOpen[\s\S]*grid-template-rows:\s*1fr/)
  })

  it('preserves notification accessibility and native exit retention', () => {
    const toast = readSource('toast.tsx')

    expect(toast).toContain("aria-live='polite'")
    expect(toast).toContain("aria-label='Notifications'")
    expect(toast).toContain("aria-label='Dismiss notification'")
    expect(toast).toContain('TOAST_EXIT_MS')
    expect(toast).toContain('STACK_EXIT_MS')
    expect(toast).toContain("matchMedia?.('(prefers-reduced-motion: reduce)')")
  })

  it('keeps native presence reconciliation passive and idempotent', () => {
    const toast = readSource('toast.tsx')
    const start = toast.indexOf('/** Retain removed cards')
    const end = toast.indexOf('/**', start + 3)
    const retentionEffect = toast.slice(start, end)

    expect(retentionEffect).toContain('useEffect(() =>')
    expect(retentionEffect).not.toContain('useLayoutEffect(() =>')
    expect(retentionEffect).toContain(
      'previousToasts.every((toast, index) => toast.id === toasts[index]?.id)'
    )
    expect(retentionEffect).toContain('return changed ? next : prev')
    expect(retentionEffect).toContain('}, [toastIds])')
  })
})
