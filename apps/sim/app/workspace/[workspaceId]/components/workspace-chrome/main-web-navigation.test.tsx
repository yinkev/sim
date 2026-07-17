/**
 * @vitest-environment jsdom
 */
import type { ComponentProps } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pathname: '/workspace/workspace-1/home',
  prefetch: vi.fn(),
  push: vi.fn(),
  toggleCollapsed: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'workspace-1' }),
  usePathname: () => mocks.pathname,
  useRouter: () => ({ prefetch: mocks.prefetch, push: mocks.push }),
}))

vi.mock('@/components/emcn/icons', () => {
  const Icon = (props: ComponentProps<'svg'>) => <svg {...props} />
  return {
    CircleInfo: Icon,
    Database: Icon,
    File: Icon,
    Home: Icon,
    Integration: Icon,
    MoreHorizontal: Icon,
    PanelLeft: Icon,
    Settings: Icon,
    Table: Icon,
    Workflow: Icon,
  }
})

vi.mock('@/stores/sidebar/store', () => ({
  useSidebarStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ isCollapsed: false, toggleCollapsed: mocks.toggleCollapsed }),
}))

import {
  MainWebNavigation,
  shouldUseAppRouter,
} from '@/app/workspace/[workspaceId]/components/workspace-chrome/main-web-navigation'

describe('MainWebNavigation links', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.pathname = '/workspace/workspace-1/home'
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<MainWebNavigation isCollapsed={false} />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('uses the app router for a normal primary click', async () => {
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="/workspace/workspace-1/settings"]'
    )

    expect(link).not.toBeNull()
    const click = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    await act(async () => link!.dispatchEvent(click))

    expect(click.defaultPrevented).toBe(true)
    expect(mocks.push).toHaveBeenCalledWith('/workspace/workspace-1/settings')
  })

  it('shows the destination as selected while navigation resolves', async () => {
    const homeLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/workspace/workspace-1/home"]'
    )
    const tablesLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/workspace/workspace-1/tables"]'
    )

    expect(homeLink).not.toBeNull()
    expect(tablesLink).not.toBeNull()

    await act(async () =>
      tablesLink!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
      )
    )

    expect(homeLink!.getAttribute('aria-current')).toBe('page')
    expect(homeLink!.className).not.toContain(' bg-[var(--surface-active)]')
    expect(tablesLink!.dataset.navigationPending).toBe('true')
    expect(tablesLink!.className).toContain(' bg-[var(--surface-active)]')
    expect(tablesLink!.className).toContain('active:scale-[0.97]')
    expect(tablesLink!.className).toContain('motion-reduce:active:scale-100')

    mocks.pathname = '/workspace/workspace-1/tables'
    await act(async () => root.render(<MainWebNavigation isCollapsed={false} />))

    expect(tablesLink!.getAttribute('aria-current')).toBe('page')
    expect(tablesLink!.dataset.navigationPending).toBeUndefined()

    mocks.pathname = '/workspace/workspace-1/home'
    await act(async () => root.render(<MainWebNavigation isCollapsed={false} />))

    expect(homeLink!.className).toContain(' bg-[var(--surface-active)]')
    expect(tablesLink!.dataset.navigationPending).toBeUndefined()
  })

  it('prefetches a route once when the user shows intent', () => {
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="/workspace/workspace-1/tables"]'
    )

    expect(link).not.toBeNull()
    link!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    link!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    link!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

    expect(mocks.prefetch).toHaveBeenCalledTimes(1)
    expect(mocks.prefetch).toHaveBeenCalledWith('/workspace/workspace-1/tables')
  })

  it('does not prefetch routes on mount', () => {
    expect(mocks.prefetch).not.toHaveBeenCalled()
  })

  it('does not compile Workflow Studio on incidental hover', () => {
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="/workspace/workspace-1/w"][aria-label="Workflow Studio"]'
    )

    expect(link).not.toBeNull()
    link!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(mocks.prefetch).not.toHaveBeenCalled()

    link!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(mocks.prefetch).toHaveBeenCalledWith('/workspace/workspace-1/w')
  })

  it.each([
    ['meta click', { metaKey: true }],
    ['control click', { ctrlKey: true }],
    ['shift click', { shiftKey: true }],
    ['alt click', { altKey: true }],
    ['middle click', { button: 1 }],
    ['handled click', { defaultPrevented: true }],
  ])('leaves a %s to the native anchor', (_label, override) => {
    expect(
      shouldUseAppRouter({
        altKey: false,
        button: 0,
        ctrlKey: false,
        defaultPrevented: false,
        metaKey: false,
        shiftKey: false,
        ...override,
      })
    ).toBe(false)
  })
})
