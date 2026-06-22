import { z } from 'zod'
import { defineRouteContract } from '@/lib/api/contracts/types'

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Expected lowercase SHA-256 digest')

const isoDateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Expected ISO date string',
})

export const featureCaseCommandSchema = z.object({
  cmd: z.string().min(1),
  result: z.enum(['passed', 'failed', 'blocked']),
  proves: z.array(z.string().min(1)),
})

export const featureCaseReviewSchema = z.object({
  type: z.string().min(1),
  reviewer: z.string().min(1),
  status: z.enum(['pass', 'fail', 'self_review']),
  findings: z.array(z.string()).optional(),
})

export const featureCaseSnapshotSchema = z
  .object({
    id: z.string().min(1),
    state: z.string().min(1),
    blockers: z.array(z.string()).optional(),
    evidence: z.object({
      commands: z.array(featureCaseCommandSchema),
    }),
    reviews: z.array(featureCaseReviewSchema),
    grade: z.object({
      decision: z.string().min(1),
      grade: z.string().min(1),
      capReason: z.string().optional(),
      claimsAdvanced: z.array(z.string()),
      nonClaims: z.array(z.string()),
    }),
    ledger: z.object({
      handoffPath: z.string().min(1),
    }),
    nextAction: z.string().min(1),
  })
  .passthrough()

export const featureCaseLedgerSummarySchema = z.object({
  state: z.string().min(1),
  decision: z.string().min(1),
  grade: z.string().min(1),
  nextAction: z.string().min(1),
})

export const featureCaseLedgerEventSchema = z.object({
  ledgerVersion: z.literal(1),
  sequence: z.number().int().min(1),
  eventId: z.string().min(1),
  type: z.literal('feature_case.snapshot.v1'),
  appendedAt: isoDateStringSchema,
  caseId: z.string().min(1),
  casePath: z.string().min(1),
  caseDigest: digestSchema,
  previousEntryDigest: digestSchema.nullable(),
  entryDigest: digestSchema,
  coverageAuditPath: z.string().min(1),
  handoffPath: z.string().min(1),
  summary: featureCaseLedgerSummarySchema,
  case: featureCaseSnapshotSchema,
})

export type FeatureCaseLedgerEvent = z.output<typeof featureCaseLedgerEventSchema>

export const mothershipControlPanelCaseSchema = z.object({
  sequence: z.number().int().min(1),
  eventId: z.string(),
  appendedAt: isoDateStringSchema,
  caseId: z.string(),
  casePath: z.string(),
  caseDigest: digestSchema,
  previousEntryDigest: digestSchema.nullable(),
  entryDigest: digestSchema,
  coverageAuditPath: z.string(),
  handoffPath: z.string(),
  state: z.string(),
  decision: z.string(),
  grade: z.string(),
  capReason: z.string().optional(),
  nextAction: z.string(),
  claimsAdvanced: z.array(z.string()),
  nonClaims: z.array(z.string()),
  blockers: z.array(z.string()),
  evidenceCommands: z.array(featureCaseCommandSchema),
  reviews: z.array(featureCaseReviewSchema),
})

export type MothershipControlPanelCase = z.output<typeof mothershipControlPanelCaseSchema>

export const listMothershipFeatureCasesQuerySchema = z.object({
  caseId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
})

export type ListMothershipFeatureCasesQuery = z.output<typeof listMothershipFeatureCasesQuerySchema>

export const listMothershipFeatureCasesResponseSchema = z.object({
  success: z.literal(true),
  ledgerPath: z.string(),
  eventCount: z.number().int().min(0),
  cases: z.array(mothershipControlPanelCaseSchema),
})

export type ListMothershipFeatureCasesResponse = z.output<
  typeof listMothershipFeatureCasesResponseSchema
>

export const mothershipFeatureCaseArtifactSchema = z.enum(['case', 'coverage-audit', 'handoff'])

export type MothershipFeatureCaseArtifact = z.output<typeof mothershipFeatureCaseArtifactSchema>

export const getMothershipFeatureCaseArtifactQuerySchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  artifact: mothershipFeatureCaseArtifactSchema,
})

export type GetMothershipFeatureCaseArtifactQuery = z.output<
  typeof getMothershipFeatureCaseArtifactQuerySchema
>

export const listMothershipFeatureCasesContract = defineRouteContract({
  method: 'GET',
  path: '/api/mothership/control-panel/feature-cases',
  query: listMothershipFeatureCasesQuerySchema,
  response: {
    mode: 'json',
    schema: listMothershipFeatureCasesResponseSchema,
  },
})

export const getMothershipFeatureCaseArtifactContract = defineRouteContract({
  method: 'GET',
  path: '/api/mothership/control-panel/feature-case-artifact',
  query: getMothershipFeatureCaseArtifactQuerySchema,
  response: { mode: 'text' },
})
