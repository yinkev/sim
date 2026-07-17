'use client'

import {
  type ComponentType,
  type MouseEvent,
  type SVGProps,
  useEffect,
  useRef,
  useState,
} from 'react'
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
  'flex h-[30px] items-center rounded-lg text-[13px] text-[var(--text-body)] transition-transform duration-100 ease-out hover-hover:bg-[var(--surface-active)] active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:transition-none'

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
interface MainWebNavigationProps {
  isCollapsed: boolean
}

export function MainWebNavigation({ isCollapsed }: MainWebNavigationProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed)
  const prefetchedHrefsRef = useRef<Set<string>>(new Set())
  const [pendingNavigation, setPendingNavigation] = useState<{
    fromPathname: string
    href: string
  } | null>(null)

  const visualPathname =
    pendingNavigation?.fromPathname === pathname ? pendingNavigation.href : pathname

  useEffect(() => {
    setPendingNavigation(null)
  }, [pathname])

  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!shouldUseAppRouter(event)) return
    event.preventDefault()
    setPendingNavigation({ fromPathname: pathname, href })
    router.push(href)
  }

  const prefetchRoute = (href: string) => {
    if (isActivePath(pathname, href) || prefetchedHrefsRef.current.has(href)) return
    prefetchedHrefsRef.current.add(href)
    router.prefetch(href)
  }

  const prefetchOnHover = (href: string) => {
    if (href.endsWith('/w')) return
    prefetchRoute(href)
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
        {navigationItems.map(({ href, icon: Icon, label }) => {
          const isCurrent = isActivePath(pathname, href)
          const isPending = visualPathname !== pathname && visualPathname === href

          return (
            <a
              key={href}
              href={href}
              onMouseEnter={() => prefetchOnHover(href)}
              onFocus={() => prefetchRoute(href)}
              onClick={(event) => navigate(event, href)}
              aria-label={label}
              aria-current={isCurrent ? 'page' : undefined}
              data-navigation-pending={isPending || undefined}
              className={getNavigationLinkClass(isCollapsed, isActivePath(visualPathname, href))}
            >
              <Icon className='size-[16px] shrink-0 text-[var(--text-icon)]' />
              <span className={isCollapsed ? 'sr-only truncate' : 'truncate'}>{label}</span>
            </a>
          )
        })}
      </nav>

      <div className='flex flex-col gap-1 border-[var(--border)] border-t pt-2'>
        <a
          href={`${basePath}/w`}
          onMouseEnter={() => prefetchOnHover(`${basePath}/w`)}
          onFocus={() => prefetchRoute(`${basePath}/w`)}
          onClick={(event) => navigate(event, `${basePath}/w`)}
          className={getNavigationLinkClass(isCollapsed)}
          aria-label='Open full workspace navigation'
        >
          <MoreHorizontal className='size-[16px] shrink-0 text-[var(--text-icon)]' />
          <span className={isCollapsed ? 'sr-only truncate' : 'truncate'}>Full navigation</span>
        </a>
        <a
          href={`${basePath}/settings`}
          onMouseEnter={() => prefetchRoute(`${basePath}/settings`)}
          onFocus={() => prefetchRoute(`${basePath}/settings`)}
          onClick={(event) => navigate(event, `${basePath}/settings`)}
          aria-label='Settings'
          data-navigation-pending={
            (visualPathname !== pathname && visualPathname === `${basePath}/settings`) || undefined
          }
          className={getNavigationLinkClass(
            isCollapsed,
            isActivePath(visualPathname, `${basePath}/settings`)
          )}
        >
          <Settings className='size-[16px] shrink-0 text-[var(--text-icon)]' />
          <span className={isCollapsed ? 'sr-only truncate' : 'truncate'}>Settings</span>
        </a>
      </div>
    </aside>
  )
}
