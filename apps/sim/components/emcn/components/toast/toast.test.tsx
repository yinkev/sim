/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode, StrictMode } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/workspace/workspace-1/home',
}))

vi.mock('@/components/emcn/components/button/button', () => ({
  Button: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/emcn/components/chip/chip', () => ({
  Chip: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
}))

import { ToastProvider, toast } from '@/components/emcn/components/toast/toast'

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }

  disconnect() {}
}

describe('ToastProvider', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    await act(async () => {
      root = hydrateRoot(
        container,
        <StrictMode>
          <ToastProvider />
        </StrictMode>
      )
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('keeps the public toast API and accessible notification region', () => {
    act(() => {
      toast.success('Saved', { description: 'Workflow saved', duration: 0 })
    })

    const region = document.querySelector('[aria-live="polite"]')
    expect(region).toHaveAttribute('aria-label', 'Notifications')
    expect(region).toHaveTextContent('Saved')
    expect(region).toHaveTextContent('Workflow saved')
    expect(region?.querySelector('[aria-label="Dismiss notification"]')).not.toBeNull()
  })

  it('retains toast and stack nodes through their exit transitions', () => {
    let id = ''
    act(() => {
      id = toast.info('Exiting toast', { duration: 0 })
    })

    act(() => toast.dismiss(id))
    expect(document.body).toHaveTextContent('Exiting toast')

    act(() => vi.advanceTimersByTime(149))
    expect(document.body).toHaveTextContent('Exiting toast')

    act(() => vi.advanceTimersByTime(1))
    expect(document.body).not.toHaveTextContent('Exiting toast')
    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull()

    act(() => vi.advanceTimersByTime(50))
    expect(document.querySelector('[aria-live="polite"]')).toBeNull()
  })

  it('removes exiting nodes without delay when reduced motion is requested', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true }))
    )

    let id = ''
    act(() => {
      id = toast.info('Reduced motion toast', { duration: 0 })
    })
    act(() => toast.dismiss(id))
    act(() => vi.advanceTimersByTime(0))

    expect(document.body).not.toHaveTextContent('Reduced motion toast')
    expect(document.querySelector('[aria-live="polite"]')).toBeNull()
  })
})
