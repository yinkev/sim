import { z } from 'zod'
import { defineRouteContract } from '@/lib/api/contracts/types'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
)

const payloadSchema = z.record(z.string(), jsonValueSchema).optional()

const producerActorSchema = z.object({
  kind: z.enum([
    'human',
    'system',
    'scheduler',
    'workflow',
    'agent',
    'integration',
    'prediction-model',
    'reviewer',
  ]),
  displayName: z.string(),
})

const producerEvidenceSchema = z.object({
  sourceRef: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  kind: z.enum([
    'log',
    'diff',
    'test',
    'artifact',
    'screenshot',
    'note',
    'source',
    'run-output',
    'receipt',
  ]),
  title: z.string(),
  uri: z.string().optional(),
  payload: payloadSchema,
})

const producerRawEventSchema = z.object({
  sourceRef: z.string(),
  occurredAt: z.string(),
  eventType: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  payload: payloadSchema,
  evidenceRefs: z.array(z.string()).optional(),
})

const producerObservationSchema = z.object({
  sourceRef: z.string(),
  observedAt: z.string().optional(),
  observationType: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  sourceEventRefs: z.array(z.string()),
  payload: payloadSchema,
  confidence: z.number().min(0).max(1).optional(),
})

const producerLoopSchema = z.object({
  sourceRef: z.string(),
  title: z.string(),
  domain: z.string(),
  status: z.enum(['active', 'paused', 'blocked', 'done', 'archived']).optional(),
  nextAction: z.string().optional(),
  blockedBy: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
})

const producerRecommendationSchema = z.object({
  sourceRef: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  title: z.string(),
  reason: z.string(),
  predictionRefs: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
})

const producerActionProposalSchema = z.object({
  sourceRef: z.string(),
  recommendationRef: z.string().optional(),
  actionType: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  payload: payloadSchema,
  evidenceRefs: z.array(z.string()).optional(),
})

const reviewPacketRecordSchema = z.object({
  sourceRef: z.string(),
  packetId: z.string(),
  projectId: z.string().optional(),
  title: z.string(),
  topic: z.string().optional(),
  status: z.enum([
    'draft',
    'reviewing',
    'converged',
    'approved',
    'rejected',
    'deadlocked',
    'superseded',
  ]),
  approvalState: z.enum([
    'draft',
    'in-review',
    'approved',
    'approved-with-required-changes',
    'rejected',
    'deadlocked',
    'superseded',
  ]),
  workerGate: z.enum(['blocked', 'review-required', 'approved-for-execution']),
  round: z.number().int().min(0),
  maxRounds: z.number().int().min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  uri: z.string(),
  payload: payloadSchema,
})

export const centerProducerImportPacketSchema = z.object({
  producerId: z.string(),
  producerDisplayName: z.string(),
  actor: producerActorSchema,
  evidence: z.array(producerEvidenceSchema),
  rawEvents: z.array(producerRawEventSchema),
  observations: z.array(producerObservationSchema),
  loops: z.array(producerLoopSchema),
  recommendations: z.array(producerRecommendationSchema),
  actionProposals: z.array(producerActionProposalSchema),
})

export type CenterProducerImportPacketResponse = z.output<typeof centerProducerImportPacketSchema>

export const importMs2SchedulerCenterContract = defineRouteContract({
  method: 'GET',
  path: '/api/center/ms2scheduler/import',
  response: {
    mode: 'json',
    schema: z.object({
      packet: centerProducerImportPacketSchema,
      source: z.object({
        dataDir: z.string(),
        currentVersion: z.string().nullable(),
      }),
    }),
  },
})

export type ImportMs2SchedulerCenterResponse = z.output<
  typeof importMs2SchedulerCenterContract.response.schema
>

export const importCenterGithubContract = defineRouteContract({
  method: 'GET',
  path: '/api/center/github/import',
  response: {
    mode: 'json',
    schema: z.object({
      packet: centerProducerImportPacketSchema,
      source: z.object({
        filePath: z.string(),
        recordCount: z.number().int().min(0),
      }),
    }),
  },
})

export type ImportCenterGithubResponse = z.output<typeof importCenterGithubContract.response.schema>

export const importCenterReviewPacketsContract = defineRouteContract({
  method: 'GET',
  path: '/api/center/review-packets/import',
  response: {
    mode: 'json',
    schema: z.object({
      records: z.array(reviewPacketRecordSchema),
      source: z.object({
        reviewDir: z.string(),
      }),
    }),
  },
})

export type ImportCenterReviewPacketsResponse = z.output<
  typeof importCenterReviewPacketsContract.response.schema
>
