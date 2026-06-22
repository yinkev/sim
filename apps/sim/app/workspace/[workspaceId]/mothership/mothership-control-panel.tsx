'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getErrorMessage } from '@sim/utils/errors'
import { Loader } from '@/components/emcn'
import {
  Check,
  CircleAlert,
  Clipboard,
  ClipboardList,
  File,
  Hand,
  Library,
  RefreshCw,
  ShieldCheck,
  SquareArrowUpRight,
} from '@/components/emcn/icons'
import type { MothershipControlPanelCase } from '@/lib/api/contracts/mothership-control-panel'
import { cn } from '@/lib/core/utils/cn'
import { Resource } from '@/app/workspace/[workspaceId]/components'
import {
  formatCapReason,
  formatClaimsNonClaimsSummary,
  type GateRailItem,
  getGateRailItems,
  getReviewFamilyGroups,
  REVIEW_FAMILY_EMPTY_LABELS,
  REVIEW_FAMILY_ICONS,
  REVIEW_FAMILY_JURISDICTION,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_STYLES,
  type ReviewFamilyGroup,
} from '@/app/workspace/[workspaceId]/mothership/mothership-control-panel.utils'
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

const GRADE_STYLES = {
  A: 'bg-[#e7f7ec] text-[#256a32]',
  B: 'bg-[#eef3ff] text-[#3159a6]',
  C: 'bg-[#fff5d6] text-[#856000]',
  D: 'bg-[#fff1e8] text-[#9a4d0f]',
  F: 'bg-[#ffecec] text-[#aa2f2f]',
} as const

function gradeClassName(grade: string): string {
  const gradeKey = grade.trim().slice(0, 1).toUpperCase() as keyof typeof GRADE_STYLES
  return GRADE_STYLES[gradeKey] ?? 'bg-[var(--surface-3)] text-[var(--text-body)]'
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

export type FeatureCaseArtifactType = 'case' | 'coverage-audit' | 'handoff'

export interface ArtifactRow {
  id: FeatureCaseArtifactType
  label: string
  type: FeatureCaseArtifactType
  eventId: string
  path: string
  href: string
}

export const FEATURE_CASE_ARTIFACT_ICONS = {
  case: File,
  'coverage-audit': ClipboardList,
  handoff: Hand,
} as const

export function getFeatureCaseArtifactIcon(type: FeatureCaseArtifactType) {
  return FEATURE_CASE_ARTIFACT_ICONS[type]
}

function featureCaseArtifactHref(eventId: string, artifact: FeatureCaseArtifactType): string {
  const query = new URLSearchParams({ eventId, artifact })
  return `/api/mothership/control-panel/feature-case-artifact?${query.toString()}`
}

export function getFeatureCaseArtifactRows(caseItem: MothershipControlPanelCase): ArtifactRow[] {
  return [
    {
      id: 'case',
      label: 'Case JSON',
      type: 'case',
      eventId: caseItem.eventId,
      path: caseItem.casePath,
      href: featureCaseArtifactHref(caseItem.eventId, 'case'),
    },
    {
      id: 'coverage-audit',
      label: 'Coverage Audit',
      type: 'coverage-audit',
      eventId: caseItem.eventId,
      path: caseItem.coverageAuditPath,
      href: featureCaseArtifactHref(caseItem.eventId, 'coverage-audit'),
    },
    {
      id: 'handoff',
      label: 'Handoff',
      type: 'handoff',
      eventId: caseItem.eventId,
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

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setCopied(false)
        timeoutRef.current = null
      }, 1500)
    } catch {
      setCopied(false)
    }
  }

  const Icon = copied ? Check : Clipboard

  return (
    <button
      type='button'
      onClick={handleCopy}
      aria-label={copied ? `${label} path copied` : `Copy ${label} path`}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-3)] px-2 text-[var(--text-muted)] text-caption transition-colors hover-hover:text-[var(--text-body)]',
        copied && 'text-[var(--text-body)]'
      )}
    >
      <Icon className='size-[14px] shrink-0 text-[var(--text-icon)]' />
      <span aria-live='polite'>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

function ArtifactExhibit({ artifact }: { artifact: ArtifactRow }) {
  const Icon = getFeatureCaseArtifactIcon(artifact.type)

  return (
    <article className='rounded-[7px] border border-[var(--border)] border-l-2 border-l-[var(--text-muted)] bg-[var(--surface-2)] p-3 transition-colors hover-hover:bg-[var(--surface-3)]'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex min-w-0 items-start gap-3'>
          <div className='flex size-8 shrink-0 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-3)] text-[var(--text-icon)]'>
            <Icon className='size-[14px]' />
          </div>

          <div className='min-w-0'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <span className='font-medium text-[var(--text-body)] text-small'>
                {artifact.label}
              </span>
              <span className='inline-flex items-center gap-1 rounded-[5px] border border-[var(--border)] bg-[var(--surface-3)] px-1.5 py-0.5 text-[var(--text-muted)] text-caption'>
                <ShieldCheck className='size-[14px] shrink-0 text-[var(--text-icon)]' />
                Exhibit
              </span>
            </div>

            <div className='mt-1 flex min-w-0 items-center gap-2 text-caption'>
              <span className='shrink-0 text-[var(--text-muted)]'>Event</span>
              <code
                title={artifact.eventId}
                className='min-w-0 truncate font-mono text-[var(--text-muted)]'
              >
                {shortDigest(artifact.eventId)}
              </code>
            </div>
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-2'>
          <CopyButton value={artifact.path} label={artifact.label} />
          <a
            href={artifact.href}
            target='_blank'
            rel='noreferrer'
            aria-label={`Open ${artifact.label}`}
            className='inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-3)] px-2 font-medium text-[var(--text-body)] text-caption transition-colors hover-hover:bg-[var(--surface-2)]'
          >
            Open
            <SquareArrowUpRight className='size-[14px] shrink-0 text-[var(--text-icon)]' />
          </a>
        </div>
      </div>

      <div className='mt-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2'>
        <div className='mb-1 text-[var(--text-muted)] text-caption'>Path</div>
        <code
          title={artifact.path}
          className='block truncate font-mono text-[var(--text-body)] text-small'
        >
          {artifact.path}
        </code>
      </div>
    </article>
  )
}

function ArtifactList({ caseItem }: { caseItem: MothershipControlPanelCase }) {
  const artifacts = getFeatureCaseArtifactRows(caseItem)

  return (
    <div className='flex flex-col gap-2'>
      {artifacts.map((artifact) => (
        <ArtifactExhibit key={artifact.id} artifact={artifact} />
      ))}
    </div>
  )
}

function VerdictInstrument({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className: string
}) {
  return (
    <div className='min-w-0'>
      <div className='mb-1 text-[var(--text-muted)] text-caption'>{label}</div>
      <div
        title={value}
        className={cn(
          'inline-flex max-w-full items-center rounded-[7px] px-3 py-2 font-medium text-base leading-5',
          className
        )}
      >
        <span className='min-w-0 break-words'>{value}</span>
      </div>
    </div>
  )
}

function gateRailTitle(item: GateRailItem): string {
  const evidenceLabel = `${item.count} evidence ${item.count === 1 ? 'source' : 'sources'}`
  return `${item.id} ${item.label}: ${evidenceLabel}; ${item.status}`
}

function GateRail({ items }: { items: GateRailItem[] }) {
  return (
    <div
      className='mt-3 flex items-center gap-1 overflow-x-auto'
      role='list'
      aria-label='F0-F8 ledger gates'
    >
      {items.map((item) => {
        const title = gateRailTitle(item)

        return (
          <div
            key={item.id}
            role='listitem'
            title={title}
            aria-label={title}
            className={cn(
              'flex h-6 shrink-0 items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 text-caption',
              item.status === 'passed' && 'text-[#2f7d32]',
              item.status === 'partial' && 'text-[#946200]',
              item.status === 'pending' && 'text-[var(--text-muted)]'
            )}
          >
            <span className='flex size-[14px] items-center justify-center'>
              {item.status === 'passed' ? (
                <Check className='size-[14px]' />
              ) : (
                <span
                  className={cn(
                    'size-[6px] rounded-full',
                    item.status === 'partial' ? 'bg-[#946200]' : 'bg-[var(--border)]'
                  )}
                />
              )}
            </span>
            <span className='font-medium'>{item.id}</span>
          </div>
        )
      })}
    </div>
  )
}

function VerdictHeader({ caseItem }: { caseItem: MothershipControlPanelCase }) {
  const capReason = formatCapReason(caseItem.capReason)
  const gateRailItems = getGateRailItems(caseItem.gateEvidence, caseItem.decision)

  return (
    <section className='border-[var(--border)] border-b bg-[var(--surface-2)] px-5 py-5'>
      <div className='grid gap-4 sm:grid-cols-[minmax(0,1fr)_112px]'>
        <VerdictInstrument
          label='Decision'
          value={caseItem.decision}
          className={decisionClassName(caseItem.decision)}
        />
        <VerdictInstrument
          label='Grade'
          value={caseItem.grade}
          className={gradeClassName(caseItem.grade)}
        />
      </div>

      <GateRail items={gateRailItems} />

      {capReason && (
        <div className='mt-4 border-[var(--border)] border-t pt-4'>
          <div className='mb-1 text-[var(--text-muted)] text-caption'>Cap reason</div>
          <p className='font-medium text-[var(--text-body)] text-base leading-6'>{capReason}</p>
        </div>
      )}

      <div className='mt-4 border-[var(--border)] border-t pt-4'>
        <div className='mb-1 text-[var(--text-muted)] text-caption'>Next action</div>
        <p className='font-medium text-[var(--text-body)] text-base leading-6'>
          {caseItem.nextAction}
        </p>
      </div>

      <div className='mt-3 text-[var(--text-muted)] text-small'>
        {formatClaimsNonClaimsSummary(caseItem.claimsAdvanced, caseItem.nonClaims)}
      </div>
    </section>
  )
}

function QuietDetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='border-[var(--border)] border-b bg-[var(--surface-2)] px-5 py-3 last:border-b-0'>
      <h2 className='mb-2 font-medium text-[var(--text-muted)] text-caption'>{title}</h2>
      {children}
    </section>
  )
}

function LedgerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[104px_minmax(0,1fr)] gap-3 text-caption'>
      <span className='text-[var(--text-muted)]'>{label}</span>
      <div className='min-w-0 text-[var(--text-muted)]'>{children}</div>
    </div>
  )
}

function CaseDetail({ caseItem }: { caseItem: MothershipControlPanelCase }) {
  return (
    <div className='min-h-0 flex-1 overflow-auto'>
      <VerdictHeader caseItem={caseItem} />

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

      <QuietDetailSection title='Ledger'>
        <div className='grid gap-2'>
          <LedgerRow label='Case ID'>
            <code className='block truncate font-mono'>{caseItem.caseId}</code>
          </LedgerRow>
          <LedgerRow label='State'>
            <span className='block truncate'>{caseItem.state}</span>
          </LedgerRow>
          <LedgerRow label='Sequence'>
            <span>{caseItem.sequence}</span>
          </LedgerRow>
          <LedgerRow label='Appended'>
            <span>{formatDate(caseItem.appendedAt)}</span>
          </LedgerRow>
          <LedgerRow label='Event ID'>
            <code className='block truncate font-mono'>{caseItem.eventId}</code>
          </LedgerRow>
          <LedgerRow label='Case digest'>
            <code className='block truncate font-mono'>{shortDigest(caseItem.caseDigest)}</code>
          </LedgerRow>
          <LedgerRow label='Entry digest'>
            <code className='block truncate font-mono'>{shortDigest(caseItem.entryDigest)}</code>
          </LedgerRow>
          <LedgerRow label='Previous'>
            {caseItem.previousEntryDigest ? (
              <code className='block truncate font-mono'>
                {shortDigest(caseItem.previousEntryDigest)}
              </code>
            ) : (
              <span>none</span>
            )}
          </LedgerRow>
          <LedgerRow label='Case path'>
            <code className='block truncate font-mono'>{caseItem.casePath}</code>
          </LedgerRow>
          <LedgerRow label='Coverage'>
            <code className='block truncate font-mono'>{caseItem.coverageAuditPath}</code>
          </LedgerRow>
          <LedgerRow label='Handoff'>
            <code className='block truncate font-mono'>{caseItem.handoffPath}</code>
          </LedgerRow>
        </div>
      </QuietDetailSection>
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
