'use client'

import { type ComponentType, useEffect, useMemo, useState } from 'react'
import { randomFloat } from '@sim/utils/random'
import { useParams, useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import {
  ArrowRight,
  ChevronDown,
  chipVariants,
  Expandable,
  ExpandableContent,
} from '@/components/emcn'
import { Connections, Shuffle, Table, Workflow } from '@/components/emcn/icons'
import { cn } from '@/lib/core/utils/cn'
import { captureEvent } from '@/lib/posthog/client'
import { useWorkspaceCredentials } from '@/hooks/queries/credentials'
import {
  type HomeSuggestionCatalogCandidate,
  type HomeSuggestionCatalogService,
  useHomeSuggestionCatalog,
} from '@/hooks/queries/home-suggestion-catalog'
import { useKnowledgeBasesQuery } from '@/hooks/queries/kb/knowledge-list'
import { useTablesList } from '@/hooks/queries/table-list'

type Icon = ComponentType<{ className?: string }>

type Action =
  | { kind: 'prompt'; id: string; label: string; prompt: string; icon: Icon }
  | { kind: 'integration'; id: string; label: string; icon: Icon; slug: string }

interface Candidate extends HomeSuggestionCatalogCandidate {
  icon: Icon
}

const TABLE_STARTERS: readonly Candidate[] = [
  { label: 'Create a CRM with sample data', prompt: 'Create a CRM with sample data.' },
  { label: 'Build a project tracker', prompt: 'Build a project tracker table.' },
  { label: 'Create a content calendar', prompt: 'Create a content calendar table.' },
  { label: 'Build an expense tracker', prompt: 'Build an expense tracker table.' },
  { label: 'Create a bug tracker', prompt: 'Create a bug tracker table.' },
].map(({ label, prompt }, i) => ({
  id: `table-starter-${i}`,
  blockType: `table-starter-${i}`,
  label,
  prompt,
  icon: Table,
  modules: ['tables'] as const,
  featured: false,
  popular: true,
  providerId: null,
}))

const GITHUB_JIRA_PROMPT =
  'Build a workflow that monitors GitHub pull requests and automatically transitions linked Jira issues when PRs are opened or merged, keeping your project board accurate without any manual updates.'

const INITIAL_ACTIONS: readonly Action[] = [
  {
    kind: 'integration',
    id: 'integrate-slack',
    label: 'Integrate with Slack',
    icon: Connections,
    slug: 'slack',
  },
  {
    kind: 'integration',
    id: 'integrate-gmail',
    label: 'Integrate with Gmail',
    icon: Connections,
    slug: 'gmail',
  },
  {
    kind: 'prompt',
    id: TABLE_STARTERS[0].id,
    label: TABLE_STARTERS[0].label,
    prompt: TABLE_STARTERS[0].prompt,
    icon: Table,
  },
  {
    kind: 'prompt',
    id: 'github-6',
    label: 'Link GitHub pull requests to Jira tickets',
    prompt: GITHUB_JIRA_PROMPT,
    icon: Workflow,
  },
]

const EMPTY_CREDENTIALS: NonNullable<ReturnType<typeof useWorkspaceCredentials>['data']> = []
const EMPTY_CATALOG = { candidates: [], services: [] } as const

interface Signals {
  connectedProviders: ReadonlySet<string>
  hasTables: boolean
  hasKnowledgeBases: boolean
}

function scoreCandidate(candidate: Candidate, signals: Signals): number {
  let weight = 1
  if (candidate.featured) weight *= 3
  if (candidate.popular) weight *= 1.5
  if (candidate.providerId) {
    weight *= signals.connectedProviders.has(candidate.providerId) ? 4 : 0.4
  }
  if (candidate.modules.includes('tables') && !signals.hasTables) weight *= 1.5
  if (candidate.modules.includes('knowledge-base') && signals.hasKnowledgeBases) weight *= 0.6
  return weight
}

function weightedSample<T>(pool: readonly T[], n: number, weightOf: (item: T) => number): T[] {
  const remaining = pool.map((item) => ({ item, weight: Math.max(weightOf(item), 0) }))
  const out: T[] = []
  while (out.length < n && remaining.length > 0) {
    const total = remaining.reduce((sum, entry) => sum + entry.weight, 0)
    if (total <= 0) break
    let roll = randomFloat() * total
    const index = remaining.findIndex((entry) => {
      roll -= entry.weight
      return roll <= 0
    })
    const [picked] = remaining.splice(index === -1 ? remaining.length - 1 : index, 1)
    out.push(picked.item)
  }
  return out
}

function toPromptAction(candidate: Candidate): Action {
  return {
    kind: 'prompt',
    id: candidate.id,
    label: candidate.label,
    prompt: candidate.prompt,
    icon: candidate.icon,
  }
}

function toIntegrationAction(service: HomeSuggestionCatalogService): Action {
  return {
    kind: 'integration',
    id: `integrate-${service.providerId}`,
    label: `Integrate with ${service.name}`,
    icon: Connections,
    slug: service.slug,
  }
}

function computeActions(
  services: readonly HomeSuggestionCatalogService[],
  candidates: readonly Candidate[],
  signals: Signals
): Action[] {
  const connectCandidates = services.filter(
    (service) => !signals.connectedProviders.has(service.providerId)
  )
  const connectCount = signals.connectedProviders.size === 0 ? 2 : 1
  const integrations = weightedSample(
    connectCandidates,
    connectCount,
    (service) => service.templateCount + 1
  ).map(toIntegrationAction)

  const scored = candidates
    .map((candidate) => ({ candidate, weight: scoreCandidate(candidate, signals) }))
    .filter((entry) => entry.weight > 0)
  const prompts: Action[] = []
  const usedBlockTypes = new Set<string>()
  while (prompts.length < 4 - integrations.length) {
    const available = scored.filter((entry) => !usedBlockTypes.has(entry.candidate.blockType))
    const [pick] = weightedSample(available, 1, (entry) => entry.weight)
    if (!pick) break
    usedBlockTypes.add(pick.candidate.blockType)
    prompts.push(toPromptAction(pick.candidate))
  }

  return [...integrations, ...prompts]
}

interface SuggestedActionsProps {
  deferSignalQueries?: boolean
  onSelectPrompt: (prompt: string) => void
}

export function SuggestedActions({
  deferSignalQueries = false,
  onSelectPrompt,
}: SuggestedActionsProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const router = useRouter()
  const posthog = usePostHog()
  const [signalsRequested, setSignalsRequested] = useState(false)
  const signalsEnabled = !deferSignalQueries || signalsRequested

  const {
    data: credentials = EMPTY_CREDENTIALS,
    isFetched: credentialsFetched,
    isFetching: credentialsFetching,
  } = useWorkspaceCredentials({
    workspaceId,
    enabled: Boolean(workspaceId) && signalsEnabled,
  })
  const {
    data: catalog = EMPTY_CATALOG,
    isFetched: catalogFetched,
    isFetching: catalogFetching,
  } = useHomeSuggestionCatalog({ enabled: signalsEnabled })
  const {
    data: tables = [],
    isFetched: tablesFetched,
    isFetching: tablesFetching,
  } = useTablesList(workspaceId, 'active', { enabled: signalsEnabled })
  const {
    data: knowledgeBases = [],
    isFetched: knowledgeBasesFetched,
    isFetching: knowledgeBasesFetching,
  } = useKnowledgeBasesQuery(workspaceId, {
    enabled: Boolean(workspaceId) && signalsEnabled,
  })

  const [expanded, setExpanded] = useState(true)
  const [animationsEnabled, setAnimationsEnabled] = useState(false)
  const [shuffleNonce, setShuffleNonce] = useState(0)
  const [deferredShufflePending, setDeferredShufflePending] = useState(false)

  const candidates = useMemo<readonly Candidate[]>(
    () => [
      ...TABLE_STARTERS,
      ...catalog.candidates.map((candidate) => ({ ...candidate, icon: Workflow })),
    ],
    [catalog.candidates]
  )
  const connectedProviders = useMemo(
    () =>
      new Set(
        credentials
          .filter((credential) => ['oauth', 'service_account'].includes(credential.type))
          .map((credential) => credential.providerId)
          .filter((id): id is string => Boolean(id))
      ),
    [credentials]
  )
  const signals = useMemo<Signals>(
    () => ({
      connectedProviders,
      hasTables: tables.length > 0,
      hasKnowledgeBases: knowledgeBases.length > 0,
    }),
    [connectedProviders, knowledgeBases.length, tables.length]
  )

  const signalQueriesSettled =
    signalsEnabled &&
    credentialsFetched &&
    !credentialsFetching &&
    catalogFetched &&
    !catalogFetching &&
    tablesFetched &&
    !tablesFetching &&
    knowledgeBasesFetched &&
    !knowledgeBasesFetching

  useEffect(() => {
    if (!deferredShufflePending || !signalQueriesSettled) return
    setDeferredShufflePending(false)
    setShuffleNonce((nonce) => nonce + 1)
  }, [deferredShufflePending, signalQueriesSettled])

  const actions = useMemo(() => {
    if (deferSignalQueries && shuffleNonce === 0) return INITIAL_ACTIONS
    const personalized = catalog.services.length > 0 && connectedProviders.size > 0
    if (!personalized && shuffleNonce === 0) return INITIAL_ACTIONS
    return computeActions(catalog.services, candidates, signals)
  }, [candidates, catalog.services, connectedProviders, deferSignalQueries, signals, shuffleNonce])

  const handleSelect = (action: Action, position: number) => {
    captureEvent(posthog, 'suggested_action_clicked', {
      workspace_id: workspaceId,
      kind: action.kind,
      action_id: action.id,
      label: action.label,
      position,
      connected_provider_count: connectedProviders.size,
    })
    if (action.kind === 'prompt') {
      onSelectPrompt(action.prompt)
      return
    }
    router.push(`/workspace/${workspaceId}/integrations/${action.slug}?connect=oauth`)
  }

  const handleShuffle = () => {
    captureEvent(posthog, 'suggested_actions_shuffled', {
      workspace_id: workspaceId,
      connected_provider_count: connectedProviders.size,
    })
    if (deferSignalQueries && shuffleNonce === 0) {
      setSignalsRequested(true)
      setDeferredShufflePending(true)
      return
    }
    setShuffleNonce((nonce) => nonce + 1)
  }

  const handleToggleExpanded = () => {
    captureEvent(posthog, 'suggested_actions_toggled', {
      workspace_id: workspaceId,
      expanded: !expanded,
    })
    setAnimationsEnabled(true)
    setExpanded((previous) => !previous)
  }

  return (
    <div className='mx-auto mt-7 w-full max-w-[48rem]'>
      <div className='flex items-center justify-between'>
        <button
          type='button'
          onClick={handleToggleExpanded}
          aria-expanded={expanded}
          className='flex items-center gap-2'
        >
          <span className='text-[var(--text-muted)] text-small'>Suggested actions</span>
          <ChevronDown
            className={cn(
              'h-[7px] w-[9px] text-[var(--text-icon)] transition-transform duration-150',
              !expanded && '-rotate-90'
            )}
          />
        </button>
        <button
          type='button'
          onClick={handleShuffle}
          aria-label='Shuffle suggested actions'
          aria-hidden={!expanded}
          tabIndex={expanded ? undefined : -1}
          className={cn(
            chipVariants({ flush: true }),
            '-mr-2 gap-1.5 transition-opacity duration-150 ease-out motion-reduce:transition-none',
            expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <span className='-mt-px text-[var(--text-muted)] text-small'>Shuffle</span>
          <Shuffle className='size-[16px] flex-shrink-0 text-[var(--text-icon)]' />
        </button>
      </div>
      <Expandable expanded={expanded}>
        <ExpandableContent className={cn('mt-2', !animationsEnabled && '!animate-none')}>
          <div className='flex flex-col'>
            {actions.map((action, index) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  type='button'
                  onClick={() => handleSelect(action, index)}
                  className={cn(
                    'flex items-center gap-2 border-[var(--divider)] px-2 py-2 text-left transition-colors hover-hover:bg-[var(--surface-5)]',
                    index > 0 && 'border-t'
                  )}
                >
                  <Icon className='size-[16px] flex-shrink-0 text-[var(--text-icon)]' />
                  <span className='flex-1 truncate text-[var(--text-body)] text-sm'>
                    {action.label}
                  </span>
                  <ArrowRight className='size-[16px] shrink-0 text-[var(--text-icon)]' />
                </button>
              )
            })}
          </div>
        </ExpandableContent>
      </Expandable>
    </div>
  )
}
