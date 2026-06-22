'use client'

import { useMemo, useState } from 'react'
import { getErrorMessage } from '@sim/utils/errors'
import { Loader } from '@/components/emcn'
import {
  CircleAlert,
  Eye,
  Library,
  Link,
  RefreshCw,
  TerminalWindow,
  Users,
} from '@/components/emcn/icons'
import type { MothershipControlPanelCase } from '@/lib/api/contracts/mothership-control-panel'
import { cn } from '@/lib/core/utils/cn'
import { Resource } from '@/app/workspace/[workspaceId]/components'
import { useMothershipFeatureCases } from '@/hooks/queries/mothership-control-panel'

const FEATURE_CASE_LIMIT = 100 as const

const GATE_DEFINITIONS = [
  {
    id: 'browser-provider-e2e',
    label: 'Browser/provider E2E',
    patterns: [/browser\/provider E2E/i, /provider\/browser E2E/i, /browser E2E/i],
  },
  {
    id: 'docker-image',
    label: 'Docker/image proof',
    patterns: [
      /Docker proof/i,
      /Docker image/i,
      /Docker build/i,
      /build\/push/i,
      /image[- ]build/i,
      /image push/i,
    ],
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes proof',
    patterns: [/Kubernetes proof/i, /Kubernetes smoke/i, /K8s/i, /cluster/i],
  },
  {
    id: 'replacement-complete',
    label: 'Replacement complete',
    patterns: [/replacement complete/i, /replacement-complete/i],
  },
] as const

const RESULT_STYLES = {
  passed: 'text-[#2f7d32]',
  failed: 'text-[#b42318]',
  blocked: 'text-[#946200]',
} as const

export type ReviewFamily = 'subagent' | 'grok' | 'oracle' | 'other'

export interface ReviewFamilyGroup {
  family: ReviewFamily
  label: string
  reviews: MothershipControlPanelCase['reviews']
}

const REVIEW_FAMILY_ORDER = ['subagent', 'grok', 'oracle'] as const

const REVIEW_FAMILY_LABELS: Record<ReviewFamily, string> = {
  subagent: 'Subagent',
  grok: 'Grok CLI',
  oracle: 'Oracle',
  other: 'Other',
} as const

const REVIEW_FAMILY_EMPTY_LABELS: Record<ReviewFamily, string> = {
  subagent: 'No Subagent evidence yet',
  grok: 'No Grok CLI evidence yet',
  oracle: 'No Oracle evidence yet',
  other: 'No Other evidence yet',
} as const

const REVIEW_FAMILY_JURISDICTION: Record<ReviewFamily, string> = {
  subagent: 'Role-separated implementation review',
  grok: 'External advisory review',
  oracle: 'High-judgment advisory',
  other: 'Other review',
} as const

const REVIEW_STATUS_LABELS: Record<
  MothershipControlPanelCase['reviews'][number]['status'],
  string
> = {
  pass: 'Pass',
  fail: 'Fail',
  self_review: 'Self review',
} as const

const REVIEW_STATUS_STYLES: Record<
  MothershipControlPanelCase['reviews'][number]['status'],
  string
> = {
  pass: 'bg-[#e7f7ec] text-[#2f7d32]',
  fail: 'bg-[#ffecec] text-[#b42318]',
  self_review: 'bg-[var(--surface-3)] text-[var(--text-muted)]',
} as const

const REVIEW_FAMILY_ICONS = {
  subagent: Users,
  grok: TerminalWindow,
  oracle: Eye,
  other: CircleAlert,
} as const

const SUBAGENT_REVIEWER_PATTERN = /subagent|kuhn|locke|leibniz/i
const GROK_REVIEWER_PATTERN = /grok/i
const ORACLE_REVIEWER_PATTERN = /oracle/i

export function classifyReviewerFamily(reviewer: string): ReviewFamily {
  if (SUBAGENT_REVIEWER_PATTERN.test(reviewer)) return 'subagent'
  if (GROK_REVIEWER_PATTERN.test(reviewer)) return 'grok'
  if (ORACLE_REVIEWER_PATTERN.test(reviewer)) return 'oracle'
  return 'other'
}

export function getReviewFamilyGroups(
  reviews: MothershipControlPanelCase['reviews']
): ReviewFamilyGroup[] {
  const groupedReviews: Record<ReviewFamily, MothershipControlPanelCase['reviews']> = {
    subagent: [],
    grok: [],
    oracle: [],
    other: [],
  }

  for (const review of reviews) {
    groupedReviews[classifyReviewerFamily(review.reviewer)].push(review)
  }

  const groups: ReviewFamilyGroup[] = REVIEW_FAMILY_ORDER.map((family) => ({
    family,
    label: REVIEW_FAMILY_LABELS[family],
    reviews: groupedReviews[family],
  }))

  if (groupedReviews.other.length > 0) {
    groups.push({
      family: 'other',
      label: REVIEW_FAMILY_LABELS.other,
      reviews: groupedReviews.other,
    })
  }

  return groups
}

const DECISION_STYLES = {
  PROMOTE: 'bg-[#e7f7ec] text-[#256a32]',
  CLOSE_SAFE_PARTIAL: 'bg-[#eef3ff] text-[#3159a6]',
  ITERATE: 'bg-[#fff5d6] text-[#856000]',
  BLOCKED: 'bg-[#fff1e8] text-[#9a4d0f]',
  REJECT_OR_REVERT: 'bg-[#ffecec] text-[#aa2f2f]',
} as const

type GateStatus = 'blocked' | 'unproven'

interface GateStatusItem {
  id: string
  label: string
  status: GateStatus
}

interface ArtifactRow {
  id: string
  label: string
  path: string
  href: string
}

function featureCaseArtifactHref(
  eventId: string,
  artifact: 'case' | 'coverage-audit' | 'handoff'
): string {
  const query = new URLSearchParams({ eventId, artifact })
  return `/api/mothership/control-panel/feature-case-artifact?${query.toString()}`
}

export function getFeatureCaseArtifactRows(caseItem: MothershipControlPanelCase): ArtifactRow[] {
  return [
    {
      id: 'case',
      label: 'Case JSON',
      path: caseItem.casePath,
      href: featureCaseArtifactHref(caseItem.eventId, 'case'),
    },
    {
      id: 'coverage-audit',
      label: 'Coverage Audit',
      path: caseItem.coverageAuditPath,
      href: featureCaseArtifactHref(caseItem.eventId, 'coverage-audit'),
    },
    {
      id: 'handoff',
      label: 'Handoff',
      path: caseItem.handoffPath,
      href: featureCaseArtifactHref(caseItem.eventId, 'handoff'),
    },
  ]
}

export function getFeatureCaseGateStatuses(cases: MothershipControlPanelCase[]): GateStatusItem[] {
  const ledgerText = cases
    .flatMap((caseItem) => [...caseItem.nonClaims, ...caseItem.blockers])
    .join('\n')

  return GATE_DEFINITIONS.map((gate) => ({
    id: gate.id,
    label: gate.label,
    status: gate.patterns.some((pattern) => pattern.test(ledgerText)) ? 'blocked' : 'unproven',
  }))
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function shortDigest(value: string): string {
  return `${value.slice(0, 8)}...${value.slice(-8)}`
}

function decisionClassName(decision: string): string {
  return DECISION_STYLES[decision as keyof typeof DECISION_STYLES] ?? 'bg-[var(--surface-3)]'
}

function matchesSearch(caseItem: MothershipControlPanelCase, search: string): boolean {
  const query = search.trim().toLowerCase()
  if (!query) return true
  return [
    caseItem.caseId,
    caseItem.state,
    caseItem.decision,
    caseItem.grade,
    caseItem.nextAction,
    ...caseItem.claimsAdvanced,
    ...caseItem.nonClaims,
    ...caseItem.blockers,
    ...caseItem.evidenceCommands.map((command) => command.cmd),
    ...caseItem.reviews.flatMap((review) => [review.type, review.reviewer, review.status]),
  ].some((value) => value.toLowerCase().includes(query))
}

function SummaryNumber({ label, value }: { label: string; value: number | string }) {
  return (
    <div className='flex min-w-[120px] flex-col gap-1 border-[var(--border)] border-r px-5 py-3 last:border-r-0'>
      <span className='text-[var(--text-muted)] text-small'>{label}</span>
      <span className='font-medium text-[var(--text-body)] text-sm'>{value}</span>
    </div>
  )
}

function GateStrip({ cases }: { cases: MothershipControlPanelCase[] }) {
  const gates = getFeatureCaseGateStatuses(cases)

  return (
    <div className='grid border-[var(--border)] border-b md:grid-cols-4'>
      {gates.map((gate) => (
        <div
          key={gate.id}
          className='flex min-w-0 items-center gap-2 border-[var(--border)] border-r px-5 py-3 last:border-r-0'
        >
          <CircleAlert className='size-[14px] shrink-0 text-[#946200]' />
          <div className='min-w-0'>
            <div className='truncate text-[var(--text-body)] text-small'>{gate.label}</div>
            <div className='text-[var(--text-muted)] text-small'>
              {gate.status === 'blocked' ? 'Blocked / unproven' : 'Unproven'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CaseListRow({
  caseItem,
  selected,
  onSelect,
}: {
  caseItem: MothershipControlPanelCase
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'grid w-full grid-cols-[minmax(0,1.35fr)_minmax(0,120px)_52px_120px] items-center gap-3 border-[var(--border)] border-b px-5 py-3 text-left text-small transition-colors',
        selected ? 'bg-[var(--surface-3)]' : 'hover-hover:bg-[var(--surface-2)]'
      )}
    >
      <div className='min-w-0'>
        <div className='truncate font-medium text-[var(--text-body)]'>{caseItem.caseId}</div>
        <div className='truncate text-[var(--text-muted)]'>{caseItem.nextAction}</div>
      </div>
      <span
        title={caseItem.decision}
        className={cn(
          'block min-w-0 max-w-full truncate rounded-[5px] px-2 py-1 font-medium text-small',
          decisionClassName(caseItem.decision)
        )}
      >
        {caseItem.decision}
      </span>
      <span className='font-medium text-[var(--text-body)]'>{caseItem.grade}</span>
      <span className='text-[var(--text-muted)]'>{formatDate(caseItem.appendedAt)}</span>
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className='flex min-h-0 flex-1 items-center justify-center px-6 py-12 text-[var(--text-muted)] text-sm'>
      {message}
    </div>
  )
}

function TextList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <div className='text-[var(--text-muted)] text-small'>{emptyLabel}</div>
  }

  return (
    <div className='flex flex-col gap-2'>
      {items.map((item) => (
        <div key={item} className='border-[var(--border)] border-b pb-2 last:border-b-0 last:pb-0'>
          <div className='text-[var(--text-body)] text-small leading-5'>{item}</div>
        </div>
      ))}
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='border-[var(--border)] border-b px-5 py-4 last:border-b-0'>
      <h2 className='mb-3 font-medium text-[var(--text-body)] text-sm'>{title}</h2>
      {children}
    </section>
  )
}

function ReviewStatusPill({
  status,
}: {
  status: MothershipControlPanelCase['reviews'][number]['status']
}) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[5px] px-2 py-0.5 font-medium text-caption',
        REVIEW_STATUS_STYLES[status]
      )}
    >
      {REVIEW_STATUS_LABELS[status]}
    </span>
  )
}

function ReviewFamilySection({ group }: { group: ReviewFamilyGroup }) {
  const Icon = REVIEW_FAMILY_ICONS[group.family]

  return (
    <div className='border-[var(--border)] border-b pb-3 last:border-b-0 last:pb-0'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <Icon className='size-[14px] shrink-0 text-[var(--text-icon)]' />
          <div className='min-w-0'>
            <div className='font-medium text-[var(--text-body)] text-small'>{group.label}</div>
            <div className='text-[var(--text-muted)] text-caption'>
              {REVIEW_FAMILY_JURISDICTION[group.family]}
            </div>
          </div>
        </div>
        <span className='shrink-0 rounded-[5px] bg-[var(--surface-3)] px-2 py-0.5 text-[var(--text-muted)] text-caption'>
          {group.reviews.length} {group.reviews.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {group.reviews.length === 0 ? (
        <div className='mt-2 rounded-[5px] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-muted)] text-small'>
          {REVIEW_FAMILY_EMPTY_LABELS[group.family]}
        </div>
      ) : (
        <div className='mt-2 flex flex-col gap-2'>
          {group.reviews.map((review, index) => (
            <div
              key={`${review.type}-${review.reviewer}-${index}`}
              className='border-[var(--border)] border-b pb-2 last:border-b-0 last:pb-0'
            >
              <div className='grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-small'>
                <div className='min-w-0'>
                  <div className='truncate font-medium text-[var(--text-body)]'>{review.type}</div>
                  <div className='truncate text-[var(--text-muted)]'>{review.reviewer}</div>
                </div>
                <ReviewStatusPill status={review.status} />
              </div>
              {review.findings && review.findings.length > 0 && (
                <ul className='mt-2 list-disc space-y-1 pl-4 text-[var(--text-muted)] text-small leading-5'>
                  {review.findings.map((finding, findingIndex) => (
                    <li key={`${review.type}-${review.reviewer}-${findingIndex}`}>{finding}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewFamilyPanels({ reviews }: { reviews: MothershipControlPanelCase['reviews'] }) {
  return (
    <div className='flex flex-col gap-3'>
      {getReviewFamilyGroups(reviews).map((group) => (
        <ReviewFamilySection key={group.family} group={group} />
      ))}
    </div>
  )
}

function ArtifactList({ caseItem }: { caseItem: MothershipControlPanelCase }) {
  const artifacts = getFeatureCaseArtifactRows(caseItem)

  return (
    <div className='flex flex-col gap-2'>
      {artifacts.map((artifact) => (
        <a
          key={artifact.id}
          href={artifact.href}
          target='_blank'
          rel='noreferrer'
          className='grid grid-cols-[110px_minmax(0,1fr)_20px] items-center gap-3 border-[var(--border)] border-b pb-2 text-small last:border-b-0 last:pb-0 hover-hover:text-[var(--text-body)]'
        >
          <span className='font-medium text-[var(--text-body)]'>{artifact.label}</span>
          <code className='truncate font-mono text-[var(--text-muted)]'>{artifact.path}</code>
          <Link className='size-[14px] text-[var(--text-muted)]' />
        </a>
      ))}
    </div>
  )
}

function CaseDetail({ caseItem }: { caseItem: MothershipControlPanelCase }) {
  return (
    <div className='min-h-0 flex-1 overflow-auto'>
      <div className='border-[var(--border)] border-b px-5 py-4'>
        <div className='mb-2 flex flex-wrap items-center gap-2'>
          <span
            className={cn(
              'rounded-[5px] px-2 py-1 font-medium text-small',
              decisionClassName(caseItem.decision)
            )}
          >
            {caseItem.decision}
          </span>
          <span className='rounded-[5px] bg-[var(--surface-3)] px-2 py-1 font-medium text-[var(--text-body)] text-small'>
            Grade {caseItem.grade}
          </span>
          <span className='rounded-[5px] bg-[var(--surface-3)] px-2 py-1 text-[var(--text-muted)] text-small'>
            seq {caseItem.sequence}
          </span>
        </div>
        <h1 className='truncate font-medium text-[var(--text-body)] text-base'>
          {caseItem.caseId}
        </h1>
        <p className='mt-1 text-[var(--text-muted)] text-small leading-5'>{caseItem.nextAction}</p>
      </div>

      <DetailSection title='Claims'>
        <TextList items={caseItem.claimsAdvanced} emptyLabel='No claims advanced' />
      </DetailSection>

      <DetailSection title='Non-Claims'>
        <TextList items={caseItem.nonClaims} emptyLabel='No non-claims recorded' />
      </DetailSection>

      <DetailSection title='Blockers'>
        <TextList items={caseItem.blockers} emptyLabel='No blockers recorded' />
      </DetailSection>

      <DetailSection title='Evidence Commands'>
        <div className='flex flex-col gap-2'>
          {caseItem.evidenceCommands.map((command) => (
            <div
              key={command.cmd}
              className='grid grid-cols-[84px_minmax(0,1fr)] gap-3 border-[var(--border)] border-b pb-2 last:border-b-0 last:pb-0'
            >
              <span
                className={cn(
                  'font-medium text-small',
                  RESULT_STYLES[command.result as keyof typeof RESULT_STYLES]
                )}
              >
                {command.result}
              </span>
              <div className='min-w-0'>
                <code className='block truncate font-mono text-[var(--text-body)] text-small'>
                  {command.cmd}
                </code>
                <div className='mt-1 text-[var(--text-muted)] text-small leading-5'>
                  {command.proves.join(', ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title='Reviews'>
        <ReviewFamilyPanels reviews={caseItem.reviews} />
      </DetailSection>

      <DetailSection title='Artifacts'>
        <ArtifactList caseItem={caseItem} />
      </DetailSection>

      <DetailSection title='Ledger'>
        <div className='grid gap-2 text-small'>
          <div className='grid grid-cols-[130px_minmax(0,1fr)] gap-3'>
            <span className='text-[var(--text-muted)]'>caseDigest</span>
            <code className='truncate font-mono text-[var(--text-body)]'>
              {shortDigest(caseItem.caseDigest)}
            </code>
          </div>
          <div className='grid grid-cols-[130px_minmax(0,1fr)] gap-3'>
            <span className='text-[var(--text-muted)]'>entryDigest</span>
            <code className='truncate font-mono text-[var(--text-body)]'>
              {shortDigest(caseItem.entryDigest)}
            </code>
          </div>
          <div className='grid grid-cols-[130px_minmax(0,1fr)] gap-3'>
            <span className='text-[var(--text-muted)]'>casePath</span>
            <code className='truncate font-mono text-[var(--text-body)]'>{caseItem.casePath}</code>
          </div>
          <div className='grid grid-cols-[130px_minmax(0,1fr)] gap-3'>
            <span className='text-[var(--text-muted)]'>handoffPath</span>
            <code className='truncate font-mono text-[var(--text-body)]'>
              {caseItem.handoffPath}
            </code>
          </div>
        </div>
      </DetailSection>
    </div>
  )
}

export default function MothershipControlPanel() {
  const [search, setSearch] = useState('')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const { data, error, isLoading, isFetching, refetch } = useMothershipFeatureCases({
    limit: FEATURE_CASE_LIMIT,
  })

  const cases = data?.cases ?? []
  const filteredCases = useMemo(
    () => cases.filter((caseItem) => matchesSearch(caseItem, search)),
    [cases, search]
  )
  const selectedCase =
    filteredCases.find((caseItem) => caseItem.eventId === selectedEventId) ??
    filteredCases[0] ??
    null

  const passedCommands = cases.reduce(
    (count, caseItem) =>
      count + caseItem.evidenceCommands.filter((command) => command.result === 'passed').length,
    0
  )
  const blockers = cases.reduce((count, caseItem) => count + caseItem.blockers.length, 0)

  return (
    <Resource>
      <Resource.Header
        icon={Library}
        title='Mothership'
        actions={[
          {
            icon: RefreshCw,
            text: isFetching ? 'Refreshing' : 'Refresh',
            onSelect: () => void refetch(),
            disabled: isFetching,
          },
        ]}
      />
      <Resource.Options
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search cases, claims, evidence...',
        }}
        aside={
          <div className='flex items-center gap-1 text-[var(--text-muted)] text-small'>
            {isFetching && <Loader className='size-[14px]' animate />}
            <span>{data ? data.ledgerPath : 'ledger unavailable'}</span>
          </div>
        }
      />

      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <div className='flex border-[var(--border)] border-b'>
          <SummaryNumber label='Cases' value={cases.length} />
          <SummaryNumber label='Evidence Passed' value={passedCommands} />
          <SummaryNumber label='Blockers' value={blockers} />
          <SummaryNumber label='Ledger Events' value={data?.eventCount ?? 0} />
        </div>
        <GateStrip cases={cases} />

        {error ? (
          <EmptyState message={getErrorMessage(error, 'Failed to load Mothership cases')} />
        ) : isLoading ? (
          <div className='flex min-h-0 flex-1 items-center justify-center'>
            <Loader className='size-[18px] text-[var(--text-secondary)]' animate />
          </div>
        ) : cases.length === 0 ? (
          <EmptyState message='No FeatureCases recorded' />
        ) : (
          <div className='grid min-h-0 flex-1 grid-cols-[minmax(520px,1.05fr)_minmax(420px,0.95fr)] overflow-hidden max-lg:grid-cols-1'>
            <div className='min-h-0 overflow-auto border-[var(--border)] border-r max-lg:border-r-0 max-lg:border-b'>
              <div className='sticky top-0 z-10 grid grid-cols-[minmax(0,1.35fr)_minmax(0,120px)_52px_120px] gap-3 border-[var(--border)] border-b bg-[var(--bg)] px-5 py-2 text-[var(--text-muted)] text-small'>
                <span>Case</span>
                <span>Decision</span>
                <span>Grade</span>
                <span>Updated</span>
              </div>
              {filteredCases.length === 0 ? (
                <EmptyState message='No cases match the search' />
              ) : (
                filteredCases.map((caseItem) => (
                  <CaseListRow
                    key={caseItem.eventId}
                    caseItem={caseItem}
                    selected={selectedCase?.eventId === caseItem.eventId}
                    onSelect={() => setSelectedEventId(caseItem.eventId)}
                  />
                ))
              )}
            </div>
            <div className='flex min-h-0 flex-col'>
              {selectedCase ? (
                <CaseDetail caseItem={selectedCase} />
              ) : (
                <EmptyState message='Select a FeatureCase' />
              )}
            </div>
          </div>
        )}
      </div>
    </Resource>
  )
}
