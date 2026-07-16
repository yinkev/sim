/**
 * @vitest-environment jsdom
 */
import type { ComponentProps } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toggleCollapsed: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'workspace-1' }),
  usePathname: () => '/workspace/workspace-1/home',
  useRouter: () => ({ push: mocks.push }),
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

  it('uses the app router for a normal primary click', () => {
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="/workspace/workspace-1/settings"]'
    )

    expect(link).not.toBeNull()
    const click = new MouseEvent('click', { bubbles: true, button: 0, cancelable: true })
    link!.dispatchEvent(click)

    expect(click.defaultPrevented).toBe(true)
    expect(mocks.push).toHaveBeenCalledWith('/workspace/workspace-1/settings')
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
