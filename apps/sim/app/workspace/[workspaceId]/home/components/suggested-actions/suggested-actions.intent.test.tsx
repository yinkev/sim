/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  captureEvent,
  onSelectPrompt,
  push,
  queryState,
  randomFloat,
  useHomeSuggestionCatalog,
  useKnowledgeBasesQuery,
  useTablesList,
  useWorkspaceCredentials,
} = vi.hoisted(() => ({
  captureEvent: vi.fn(),
  onSelectPrompt: vi.fn(),
  push: vi.fn(),
  queryState: {
    catalog: {
      data: {
        candidates: [
          {
            blockType: 'github',
            featured: true,
            id: 'github-6',
            label: 'Link GitHub pull requests to Jira tickets',
            modules: ['agent', 'workflows'],
            popular: false,
            prompt:
              'Build a workflow that monitors GitHub pull requests and automatically transitions linked Jira issues when PRs are opened or merged, keeping your project board accurate without any manual updates.',
            providerId: null,
          },
        ],
        services: [
          {
            blockType: 'slack',
            name: 'Slack',
            providerId: 'slack',
            slug: 'slack',
            templateCount: 12,
          },
          {
            blockType: 'gmail',
            name: 'Gmail',
            providerId: 'google-email',
            slug: 'gmail',
            templateCount: 8,
          },
        ],
      },
      isFetched: false,
      isFetching: false,
    },
    credentials: {
      data: [] as Array<{ providerId?: string; type: string }>,
      isFetched: false,
      isFetching: false,
    },
    knowledgeBases: { data: [] as unknown[], isFetched: false, isFetching: false },
    tables: { data: [] as unknown[], isFetched: false, isFetching: false },
  },
  randomFloat: vi.fn(() => 0),
  useHomeSuggestionCatalog: vi.fn(),
  useKnowledgeBasesQuery: vi.fn(),
  useTablesList: vi.fn(),
  useWorkspaceCredentials: vi.fn(),
}))

vi.mock('@sim/utils/random', () => ({ randomFloat }))
vi.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'workspace-1' }),
  useRouter: () => ({ push }),
}))
vi.mock('posthog-js/react', () => ({ usePostHog: () => ({}) }))
vi.mock('@/components/emcn', () => ({
  ArrowRight: 'svg',
  ChevronDown: 'svg',
  Expandable: ({ children }: { children: ReactNode }) => <>{children}</>,
  ExpandableContent: ({ children, ...props }: { children: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  chipVariants: () => '',
}))
vi.mock('@/components/emcn/icons', () => ({
  Connections: 'svg',
  Shuffle: 'svg',
  Table: 'svg',
  Workflow: 'svg',
}))
vi.mock('@/lib/posthog/client', () => ({ captureEvent }))
vi.mock('@/hooks/queries/credentials', () => ({ useWorkspaceCredentials }))
vi.mock('@/hooks/queries/home-suggestion-catalog', () => ({ useHomeSuggestionCatalog }))
vi.mock('@/hooks/queries/kb/knowledge-list', () => ({ useKnowledgeBasesQuery }))
vi.mock('@/hooks/queries/table-list', () => ({ useTablesList }))

import { SuggestedActions } from '@/app/workspace/[workspaceId]/home/components/suggested-actions/suggested-actions'

const INITIAL_LABELS = [
  'Integrate with Slack',
  'Integrate with Gmail',
  'Create a CRM with sample data',
  'Link GitHub pull requests to Jira tickets',
] as const

const GITHUB_JIRA_PROMPT =
  'Build a workflow that monitors GitHub pull requests and automatically transitions linked Jira issues when PRs are opened or merged, keeping your project board accurate without any manual updates.'

describe('SuggestedActions signal intent', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    queryState.catalog.isFetched = false
    queryState.catalog.isFetching = false
    queryState.credentials = { data: [], isFetched: false, isFetching: false }
    queryState.knowledgeBases = { data: [], isFetched: false, isFetching: false }
    queryState.tables = { data: [], isFetched: false, isFetching: false }
    useHomeSuggestionCatalog.mockImplementation(() => queryState.catalog)
    useWorkspaceCredentials.mockImplementation(() => queryState.credentials)
    useTablesList.mockImplementation(() => queryState.tables)
    useKnowledgeBasesQuery.mockImplementation(() => queryState.knowledgeBases)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function render(deferSignalQueries?: boolean) {
    await act(async () => {
      root.render(
        <SuggestedActions deferSignalQueries={deferSignalQueries} onSelectPrompt={onSelectPrompt} />
      )
    })
  }

  function button(label: string): HTMLButtonElement {
    const match = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label
    )
    if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`)
    return match
  }

  function expectInitialActions() {
    for (const label of INITIAL_LABELS) expect(container).toHaveTextContent(label)
  }

  it('keeps current eager signal behavior by default', async () => {
    await render()

    expect(useWorkspaceCredentials).toHaveBeenLastCalledWith({
      workspaceId: 'workspace-1',
      enabled: true,
    })
    expect(useHomeSuggestionCatalog).toHaveBeenLastCalledWith({ enabled: true })
    expect(useTablesList).toHaveBeenLastCalledWith('workspace-1', 'active', { enabled: true })
    expect(useKnowledgeBasesQuery).toHaveBeenLastCalledWith('workspace-1', { enabled: true })
  })

  it('keeps exact initial labels and prompts before intent', async () => {
    await render(true)

    expectInitialActions()
    await act(async () => button('Create a CRM with sample data').click())
    await act(async () => button('Link GitHub pull requests to Jira tickets').click())

    expect(onSelectPrompt).toHaveBeenNthCalledWith(1, 'Create a CRM with sample data.')
    expect(onSelectPrompt).toHaveBeenNthCalledWith(2, GITHUB_JIRA_PROMPT)
  })

  it('keeps every signal query disabled before intent', async () => {
    await render(true)

    expect(useWorkspaceCredentials).toHaveBeenLastCalledWith({
      workspaceId: 'workspace-1',
      enabled: false,
    })
    expect(useHomeSuggestionCatalog).toHaveBeenLastCalledWith({ enabled: false })
    expect(useTablesList).toHaveBeenLastCalledWith('workspace-1', 'active', { enabled: false })
    expect(useKnowledgeBasesQuery).toHaveBeenLastCalledWith('workspace-1', { enabled: false })
  })

  it('waits for every signal query to settle before performing first deferred shuffle', async () => {
    await render(true)

    await act(async () => button('Shuffle').click())
    expect(useWorkspaceCredentials).toHaveBeenLastCalledWith({
      workspaceId: 'workspace-1',
      enabled: true,
    })
    expect(useHomeSuggestionCatalog).toHaveBeenLastCalledWith({ enabled: true })
    expect(useTablesList).toHaveBeenLastCalledWith('workspace-1', 'active', { enabled: true })
    expect(useKnowledgeBasesQuery).toHaveBeenLastCalledWith('workspace-1', { enabled: true })
    expectInitialActions()
    expect(randomFloat).not.toHaveBeenCalled()

    queryState.catalog.isFetched = true
    queryState.credentials = { data: [], isFetched: true, isFetching: false }
    queryState.tables = { data: [], isFetched: true, isFetching: false }
    queryState.knowledgeBases = { data: [], isFetched: false, isFetching: true }
    await render(true)

    expectInitialActions()
    expect(randomFloat).not.toHaveBeenCalled()

    queryState.knowledgeBases = { data: [], isFetched: true, isFetching: false }
    await render(true)

    expect(randomFloat).toHaveBeenCalled()
  })

  it('deep-links integration OAuth without enabling deferred signal queries', async () => {
    await render(true)

    await act(async () => button('Integrate with Slack').click())

    expect(push).toHaveBeenCalledWith('/workspace/workspace-1/integrations/slack?connect=oauth')
    expect(useHomeSuggestionCatalog).toHaveBeenLastCalledWith({ enabled: false })
    expect(useWorkspaceCredentials).toHaveBeenLastCalledWith({
      workspaceId: 'workspace-1',
      enabled: false,
    })
    expect(useTablesList).toHaveBeenLastCalledWith('workspace-1', 'active', { enabled: false })
    expect(useKnowledgeBasesQuery).toHaveBeenLastCalledWith('workspace-1', { enabled: false })
  })
})
