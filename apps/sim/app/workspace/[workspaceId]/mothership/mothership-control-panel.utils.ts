import { CircleAlert, Eye, TerminalWindow, Users } from '@/components/emcn/icons'
import type { MothershipControlPanelCase } from '@/lib/api/contracts/mothership-control-panel'

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

export const REVIEW_FAMILY_EMPTY_LABELS: Record<ReviewFamily, string> = {
  subagent: 'No Subagent evidence yet',
  grok: 'No Grok CLI evidence yet',
  oracle: 'No Oracle evidence yet',
  other: 'No Other evidence yet',
} as const

export const REVIEW_FAMILY_JURISDICTION: Record<ReviewFamily, string> = {
  subagent: 'Role-separated implementation review',
  grok: 'External advisory review',
  oracle: 'High-judgment advisory',
  other: 'Other review',
} as const

export const REVIEW_STATUS_LABELS: Record<
  MothershipControlPanelCase['reviews'][number]['status'],
  string
> = {
  pass: 'Pass',
  fail: 'Fail',
  self_review: 'Self review',
} as const

export const REVIEW_STATUS_STYLES: Record<
  MothershipControlPanelCase['reviews'][number]['status'],
  string
> = {
  pass: 'bg-[#e7f7ec] text-[#2f7d32]',
  fail: 'bg-[#ffecec] text-[#b42318]',
  self_review: 'bg-[var(--surface-3)] text-[var(--text-muted)]',
} as const

export const REVIEW_FAMILY_ICONS: Record<ReviewFamily, typeof Users> = {
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

function formatTokenWord(word: string): string {
  const normalized = word.toLowerCase()
  if (normalized === 'e2e') return 'E2E'
  if (normalized === 'api') return 'API'
  if (normalized === 'ui') return 'UI'
  if (normalized === 'json') return 'JSON'
  return normalized
}

export function formatCapReason(capReason?: string): string | null {
  const trimmed = capReason?.trim()
  if (!trimmed) return null

  const shouldHumanize =
    !/\s/.test(trimmed) && (/[_-]/.test(trimmed) || /^[A-Z0-9]+$/.test(trimmed))
  const readable = shouldHumanize
    ? trimmed.split(/[_-]+/).filter(Boolean).map(formatTokenWord).join(' ')
    : trimmed

  if (!readable) return null

  const sentence = `${readable.charAt(0).toUpperCase()}${readable.slice(1)}`
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
}

export function formatClaimsNonClaimsSummary(
  claimsAdvanced: string[],
  nonClaims: string[]
): string {
  const claimCount = claimsAdvanced.length
  const nonClaimCount = nonClaims.length
  return `${claimCount} ${claimCount === 1 ? 'claim' : 'claims'} · ${nonClaimCount} ${
    nonClaimCount === 1 ? 'non-claim' : 'non-claims'
  }`
}
