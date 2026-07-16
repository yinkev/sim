'use client'

import type { ComponentType, MouseEvent, SVGProps } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import {
  CircleInfo,
  Database,
  File,
  Home,
  Integration,
  MoreHorizontal,
  PanelLeft,
  Settings,
  Table,
  Workflow,
} from '@/components/emcn/icons'
import { useSidebarStore } from '@/stores/sidebar/store'

interface NavigationItem {
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
}

type NavigationClickIntent = Pick<
  MouseEvent<HTMLAnchorElement>,
  'altKey' | 'button' | 'ctrlKey' | 'defaultPrevented' | 'metaKey' | 'shiftKey'
>

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

const NAVIGATION_LINK_CLASS =
  'flex h-[30px] items-center rounded-lg text-[13px] text-[var(--text-body)] hover-hover:bg-[var(--surface-active)]'

function getNavigationLinkClass(isCollapsed: boolean, isActive = false): string {
  return `${NAVIGATION_LINK_CLASS} ${isCollapsed ? 'justify-center px-0' : 'gap-2 px-2'}${isActive ? ' bg-[var(--surface-active)]' : ''}`
}

/** True when an anchor click should use App Router navigation. */
export function shouldUseAppRouter(event: NavigationClickIntent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

/** Lightweight route navigation for main-web surfaces. */
export function MainWebNavigation() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const isCollapsed = useSidebarStore((state) => state.isCollapsed)
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed)

  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!shouldUseAppRouter(event)) return
    event.preventDefault()
    router.push(href)
  }

  const basePath = `/workspace/${workspaceId}`
  const navigationItems: NavigationItem[] = [
    { href: `${basePath}/home`, icon: Home, label: 'New chat' },
    { href: `${basePath}/center`, icon: CircleInfo, label: 'Center' },
    { href: `${basePath}/w`, icon: Workflow, label: 'Workflow Studio' },
    { href: `${basePath}/tables`, icon: Table, label: 'Tables' },
    { href: `${basePath}/files`, icon: File, label: 'Files' },
    { href: `${basePath}/knowledge`, icon: Database, label: 'Knowledge base' },
    { href: `${basePath}/integrations`, icon: Integration, label: 'Integrations' },
  ]

  return (
    <aside
      className='sidebar-container flex h-full flex-col bg-[var(--surface-1)] px-2 py-3'
      data-collapsed={isCollapsed || undefined}
      aria-label='Workspace navigation'
    >
      <div className='mb-3 flex h-[30px] items-center justify-between'>
        <span
          className={
            isCollapsed
              ? 'sr-only truncate px-2 font-medium text-[13px] text-[var(--text-body)]'
              : 'truncate px-2 font-medium text-[13px] text-[var(--text-body)]'
          }
        >
          Workspace
        </span>
        <button
          type='button'
          onClick={toggleCollapsed}
          className='flex size-[30px] shrink-0 items-center justify-center rounded-lg text-[var(--text-icon)] hover-hover:bg-[var(--surface-active)]'
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <PanelLeft className='size-[16px]' />
        </button>
      </div>

      <nav className='flex flex-1 flex-col gap-1' aria-label='Workspace routes'>
        {navigationItems.map(({ href, icon: Icon, label }) => (
          <a
            key={href}
            href={href}
            onClick={(event) => navigate(event, href)}
            aria-label={label}
            aria-current={isActivePath(pathname, href) ? 'page' : undefined}
            className={getNavigationLinkClass(isCollapsed, isActivePath(pathname, href))}
          >
            <Icon className='size-[16px] shrink-0 text-[var(--text-icon)]' />
            <span className={isCollapsed ? 'sr-only truncate' : 'truncate'}>{label}</span>
          </a>
        ))}
      </nav>

      <div className='flex flex-col gap-1 border-[var(--border)] border-t pt-2'>
        <a
          href={`${basePath}/w`}
          onClick={(event) => navigate(event, `${basePath}/w`)}
          className={getNavigationLinkClass(isCollapsed)}
          aria-label='Open full workspace navigation'
        >
          <MoreHorizontal className='size-[16px] shrink-0 text-[var(--text-icon)]' />
          <span className={isCollapsed ? 'sr-only truncate' : 'truncate'}>Full navigation</span>
        </a>
        <a
          href={`${basePath}/settings`}
          onClick={(event) => navigate(event, `${basePath}/settings`)}
          aria-label='Settings'
          className={getNavigationLinkClass(
            isCollapsed,
            isActivePath(pathname, `${basePath}/settings`)
          )}
        >
          <Settings className='size-[16px] shrink-0 text-[var(--text-icon)]' />
          <span className={isCollapsed ? 'sr-only truncate' : 'truncate'}>Settings</span>
        </a>
      </div>
    </aside>
  )
}
