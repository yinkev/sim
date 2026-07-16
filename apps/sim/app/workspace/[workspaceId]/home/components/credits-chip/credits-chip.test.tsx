/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    plan: {
      planView: { showCredits: true },
      isLoading: false,
      hasData: true,
    },
    subscription: {
      data: {
        data: {
          usageLimit: 10,
          creditBalance: 2,
          currentUsage: 3,
        },
      },
    },
    member: {
      data: { limitDollars: null, usedDollars: 0 },
      isLoading: false,
    },
  }

  return {
    state,
    push: vi.fn(),
    prefetch: vi.fn(),
    prefetchUpgradeBillingData: vi.fn(),
    prefetchWorkspaceSettings: vi.fn(),
    usePlanView: vi.fn(() => state.plan),
    useSubscriptionData: vi.fn(() => state.subscription),
    useMyMemberCredits: vi.fn(() => state.member),
  }
})

vi.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'workspace-1' }),
  useRouter: () => ({ push: mocks.push, prefetch: mocks.prefetch }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ id: 'query-client' }),
}))

vi.mock('@/components/emcn', () => ({
  Chip: ({ children, leftIcon: LeftIcon, ...props }: Record<string, unknown>) => (
    <button {...props}>
      {typeof LeftIcon === 'function' ? <LeftIcon /> : null}
      {children as ReactNode}
    </button>
  ),
}))

vi.mock('@/components/emcn/icons', () => ({
  Credit: () => <span data-testid='credit-icon' />,
}))

vi.mock('@/app/workspace/[workspaceId]/settings/billing-enabled', () => ({
  isBillingEnabled: true,
}))

vi.mock('@/hooks/queries/organization-member-credits', () => ({
  useMyMemberCredits: mocks.useMyMemberCredits,
}))

vi.mock('@/hooks/queries/plan-view', () => ({
  usePlanView: mocks.usePlanView,
}))

vi.mock('@/hooks/queries/subscription-data', () => ({
  prefetchUpgradeBillingData: mocks.prefetchUpgradeBillingData,
  useSubscriptionData: mocks.useSubscriptionData,
}))

vi.mock('@/hooks/queries/workspace-settings-prefetch', () => ({
  prefetchWorkspaceSettings: mocks.prefetchWorkspaceSettings,
}))

import { CreditsChip } from '@/app/workspace/[workspaceId]/home/components/credits-chip/credits-chip'

describe('CreditsChip import boundary', () => {
  it('reads the billing flag from the lightweight settings leaf', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'app/workspace/[workspaceId]/home/components/credits-chip/credits-chip.tsx'
      ),
      'utf8'
    )

    expect(source).toContain("from '@/app/workspace/[workspaceId]/settings/billing-enabled'")
    expect(source).not.toContain("from '@/app/workspace/[workspaceId]/settings/navigation'")
  })
})

describe('CreditsChip deferred data', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    mocks.state.plan = {
      planView: { showCredits: true },
      isLoading: false,
      hasData: true,
    }
    mocks.state.subscription = {
      data: {
        data: {
          usageLimit: 10,
          creditBalance: 2,
          currentUsage: 3,
        },
      },
    }
    mocks.state.member = {
      data: { limitDollars: null, usedDollars: 0 },
      isLoading: false,
    }
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function renderCreditsChip(deferData = true) {
    await act(async () => {
      root.render(<CreditsChip deferData={deferData} />)
    })
  }

  it('disables all balance queries on mount while keeping a visible upgrade chip', async () => {
    await renderCreditsChip()

    expect(mocks.usePlanView).toHaveBeenLastCalledWith({ enabled: false })
    expect(mocks.useSubscriptionData).toHaveBeenLastCalledWith({ enabled: false })
    expect(mocks.useMyMemberCredits).toHaveBeenLastCalledWith('workspace-1', { enabled: false })
    expect(container.querySelector('button')).toHaveTextContent('Credits')
    expect(container.querySelector('[data-testid="credit-icon"]')).not.toBeNull()
  })

  it('enables balance queries and prefetches upgrade data on hover', async () => {
    mocks.state.plan.isLoading = true
    mocks.state.member.isLoading = true
    await renderCreditsChip()

    await act(async () => {
      container
        .querySelector('button')
        ?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })

    expect(mocks.usePlanView).toHaveBeenLastCalledWith({ enabled: true })
    expect(mocks.useSubscriptionData).toHaveBeenLastCalledWith({ enabled: true })
    expect(mocks.useMyMemberCredits).toHaveBeenLastCalledWith('workspace-1', { enabled: true })
    expect(mocks.prefetch).toHaveBeenCalledWith('/workspace/workspace-1/upgrade?reason=credits')
    expect(mocks.prefetchUpgradeBillingData).toHaveBeenCalledOnce()
    expect(mocks.prefetchWorkspaceSettings).toHaveBeenCalledWith(
      { id: 'query-client' },
      'workspace-1'
    )
    expect(container.querySelector('button')).toHaveTextContent('Credits')
  })

  it('keeps first-click upgrade navigation and replaces the placeholder with the balance', async () => {
    await renderCreditsChip()

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(mocks.push).toHaveBeenCalledWith('/workspace/workspace-1/upgrade?reason=credits')

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    })

    expect(container.querySelector('button')).toHaveTextContent('1,800')
  })

  it('renders infinity for an unlimited plan and removes the placeholder when credits are hidden', async () => {
    mocks.state.subscription.data.data.usageLimit = 999999
    await renderCreditsChip()

    await act(async () => {
      container
        .querySelector('button')
        ?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    expect(container.querySelector('button')).toHaveTextContent('∞')

    mocks.state.plan.planView.showCredits = false
    await act(async () => {
      root.render(<CreditsChip deferData />)
    })
    expect(container.querySelector('button')).toBeNull()
  })

  it('keeps current eager query behavior by default', async () => {
    await act(async () => {
      root.render(<CreditsChip />)
    })

    expect(mocks.usePlanView).toHaveBeenLastCalledWith({ enabled: true })
    expect(mocks.useSubscriptionData).toHaveBeenLastCalledWith({ enabled: true })
    expect(mocks.useMyMemberCredits).toHaveBeenLastCalledWith('workspace-1', { enabled: true })
    expect(container.querySelector('button')).toHaveTextContent('1,800')
  })
})
