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
const requiredPayloadSchema = z.record(z.string(), jsonValueSchema)

const centerStorageModeSchema = z.enum(['local-server', 'browser-local', 'workspace'])
const centerActorKindSchema = z.enum([
  'human',
  'system',
  'scheduler',
  'workflow',
  'agent',
  'integration',
  'prediction-model',
  'reviewer',
])
const centerEvidenceKindSchema = z.enum([
  'log',
  'diff',
  'test',
  'artifact',
  'screenshot',
  'note',
  'source',
  'run-output',
  'receipt',
])
const centerLoopStatusSchema = z.enum(['active', 'paused', 'blocked', 'done', 'archived'])
const centerReviewPacketStatusSchema = z.enum([
  'draft',
  'reviewing',
  'converged',
  'approved',
  'rejected',
  'deadlocked',
  'superseded',
])
const centerApprovalStateSchema = z.enum([
  'draft',
  'in-review',
  'approved',
  'approved-with-required-changes',
  'rejected',
  'deadlocked',
  'superseded',
])
const centerWorkerGateSchema = z.enum(['blocked', 'review-required', 'approved-for-execution'])

const producerActorSchema = z.object({
  kind: centerActorKindSchema,
  displayName: z.string(),
})

const producerEvidenceSchema = z.object({
  sourceRef: z.string(),
  capabilityId: z.string().optional(),
  subjectType: z.string(),
  subjectId: z.string(),
  kind: centerEvidenceKindSchema,
  title: z.string(),
  uri: z.string().optional(),
  payload: payloadSchema,
})

const producerRawEventSchema = z.object({
  sourceRef: z.string(),
  capabilityId: z.string().optional(),
  occurredAt: z.string(),
  eventType: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  payload: payloadSchema,
  evidenceRefs: z.array(z.string()).optional(),
})

const producerObservationSchema = z.object({
  sourceRef: z.string(),
  capabilityId: z.string().optional(),
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
  capabilityId: z.string().optional(),
  title: z.string(),
  domain: z.string(),
  status: centerLoopStatusSchema.optional(),
  nextAction: z.string().optional(),
  blockedBy: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
})

const producerRecommendationSchema = z.object({
  sourceRef: z.string(),
  capabilityId: z.string().optional(),
  targetType: z.string(),
  targetId: z.string(),
  title: z.string(),
  reason: z.string(),
  predictionRefs: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
})

const producerActionProposalSchema = z.object({
  sourceRef: z.string(),
  capabilityId: z.string().optional(),
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
  status: centerReviewPacketStatusSchema,
  approvalState: centerApprovalStateSchema,
  workerGate: centerWorkerGateSchema,
  round: z.number().int().min(0),
  maxRounds: z.number().int().min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  uri: z.string(),
  payload: payloadSchema,
})

export const centerDatasetSchema = z.object({
  profiles: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      createdAt: z.string(),
      status: z.enum(['active', 'archived', 'deleted']),
      storageMode: centerStorageModeSchema,
      telemetry: z.enum(['off', 'explicit-opt-in']),
    })
  ),
  actors: z.array(
    z.object({
      id: z.string(),
      profileId: z.string().optional(),
      kind: centerActorKindSchema,
      displayName: z.string(),
      producerId: z.string().optional(),
    })
  ),
  rawEvents: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      producerId: z.string(),
      actorId: z.string().optional(),
      sourceRef: z.string().optional(),
      occurredAt: z.string(),
      recordedAt: z.string(),
      eventType: z.string(),
      subjectType: z.string(),
      subjectId: z.string(),
      payload: requiredPayloadSchema,
      evidenceRefs: z.array(z.string()),
    })
  ),
  evidence: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      producerId: z.string().optional(),
      subjectType: z.string(),
      subjectId: z.string(),
      kind: centerEvidenceKindSchema,
      title: z.string(),
      uri: z.string().optional(),
      payload: payloadSchema,
      createdAt: z.string(),
      sourceRef: z.string().optional(),
    })
  ),
  observations: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      producerId: z.string(),
      actorId: z.string().optional(),
      observedAt: z.string(),
      observationType: z.string(),
      subjectType: z.string(),
      subjectId: z.string(),
      sourceEventRefs: z.array(z.string()),
      payload: requiredPayloadSchema,
      confidence: z.number().min(0).max(1).optional(),
      sourceRef: z.string().optional(),
    })
  ),
  loops: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      title: z.string(),
      domain: z.string(),
      status: centerLoopStatusSchema,
      nextAction: z.string().optional(),
      blockedBy: z.array(z.string()).optional(),
      evidenceRefs: z.array(z.string()),
      updatedAt: z.string(),
      sourceRef: z.string().optional(),
    })
  ),
  decisions: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      projectId: z.string().optional(),
      actorId: z.string(),
      title: z.string(),
      decision: z.string(),
      reason: z.string(),
      consequence: z.string(),
      evidenceRefs: z.array(z.string()),
      status: z.enum(['active', 'superseded', 'rejected']),
      decidedAt: z.string(),
      revisitIf: z.string().optional(),
    })
  ),
  recommendations: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      targetType: z.string(),
      targetId: z.string(),
      title: z.string(),
      reason: z.string(),
      predictionRefs: z.array(z.string()),
      evidenceRefs: z.array(z.string()),
      createdAt: z.string(),
      status: z.enum(['proposed', 'accepted', 'rejected', 'superseded']),
      sourceRef: z.string().optional(),
    })
  ),
  actionProposals: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      recommendationId: z.string().optional(),
      producerId: z.string().optional(),
      actionType: z.string(),
      targetType: z.string(),
      targetId: z.string(),
      payload: requiredPayloadSchema,
      evidenceRefs: z.array(z.string()),
      status: z.enum(['proposed', 'approved', 'executed', 'rejected', 'superseded']),
      createdAt: z.string(),
      sourceRef: z.string().optional(),
    })
  ),
  featureProjections: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      targetType: z.string(),
      targetId: z.string(),
      featureName: z.string(),
      value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
      window: z.string().optional(),
      sourceObservationRefs: z.array(z.string()),
      computedAt: z.string(),
      version: z.string(),
    })
  ),
  predictionSummaries: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      targetType: z.string(),
      targetId: z.string(),
      predictionType: z.string(),
      status: z.enum(['insufficient-data', 'baseline', 'calibrated']),
      probability: z.number().min(0).max(1).optional(),
      score: z.number().min(0).max(1).optional(),
      confidence: z.number().min(0).max(1),
      dataSufficiency: z.enum(['none', 'low', 'medium', 'high']),
      drivers: z.array(
        z.object({
          name: z.string(),
          direction: z.enum(['up', 'down']),
          weight: z.number().optional(),
        })
      ),
      featureRefs: z.array(z.string()),
      generatedAt: z.string(),
      modelVersion: z.string(),
    })
  ),
  outcomes: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      subjectType: z.enum(['prediction', 'recommendation', 'action', 'loop', 'task']),
      subjectId: z.string(),
      outcomeType: z.string(),
      observedAt: z.string(),
      payload: requiredPayloadSchema,
      evidenceRefs: z.array(z.string()),
    })
  ),
  reviewPackets: z.array(
    z.object({
      id: z.string(),
      profileId: z.string(),
      packetId: z.string(),
      projectId: z.string().optional(),
      title: z.string(),
      topic: z.string().optional(),
      status: centerReviewPacketStatusSchema,
      approvalState: centerApprovalStateSchema,
      workerGate: centerWorkerGateSchema,
      round: z.number().int().min(0),
      maxRounds: z.number().int().min(1),
      evidenceRefs: z.array(z.string()),
      decisionRefs: z.array(z.string()),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      sourceRef: z.string().optional(),
    })
  ),
})

export type CenterDatasetResponse = z.output<typeof centerDatasetSchema>

const centerWorkspaceStorageParamsSchema = z.object({
  workspaceId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._-]+$/),
})

const centerWorkspaceStorageSourceSchema = z.object({
  storageMode: z.literal('workspace'),
  filePath: z.string(),
})
const centerGithubImportSourceSchema = z.object({
  mode: z.enum(['sample-file', 'live-github']),
  filePath: z.string(),
  recordCount: z.number().int().min(0),
})
const centerPlaneImportSourceSchema = z.object({
  mode: z.enum(['sample-file', 'live-plane']),
  filePath: z.string(),
  recordCount: z.number().int().min(0),
})

export const centerProducerImportPacketSchema = z.object({
  producerId: z.string(),
  producerDisplayName: z.string(),
  capabilityIds: z.array(z.string()),
  actor: producerActorSchema,
  evidence: z.array(producerEvidenceSchema),
  rawEvents: z.array(producerRawEventSchema),
  observations: z.array(producerObservationSchema),
  loops: z.array(producerLoopSchema),
  recommendations: z.array(producerRecommendationSchema),
  actionProposals: z.array(producerActionProposalSchema),
})

export type CenterProducerImportPacketResponse = z.output<typeof centerProducerImportPacketSchema>

const centerCapabilityRegistrySchema = z.object({
  registeredIds: z.array(z.string()),
})

export const getCenterWorkspaceStorageContract = defineRouteContract({
  method: 'GET',
  path: '/api/center/storage/[workspaceId]',
  params: centerWorkspaceStorageParamsSchema,
  response: {
    mode: 'json',
    schema: z.object({
      dataset: centerDatasetSchema,
      source: centerWorkspaceStorageSourceSchema,
    }),
  },
})

export type GetCenterWorkspaceStorageResponse = z.output<
  typeof getCenterWorkspaceStorageContract.response.schema
>

export const putCenterWorkspaceStorageContract = defineRouteContract({
  method: 'PUT',
  path: '/api/center/storage/[workspaceId]',
  params: centerWorkspaceStorageParamsSchema,
  body: z.object({
    dataset: centerDatasetSchema,
  }),
  response: {
    mode: 'json',
    schema: z.object({
      ok: z.literal(true),
      source: centerWorkspaceStorageSourceSchema,
    }),
  },
})

export type PutCenterWorkspaceStorageResponse = z.output<
  typeof putCenterWorkspaceStorageContract.response.schema
>

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
      capabilities: centerCapabilityRegistrySchema,
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
      source: centerGithubImportSourceSchema,
      capabilities: centerCapabilityRegistrySchema,
    }),
  },
})

export type ImportCenterGithubResponse = z.output<typeof importCenterGithubContract.response.schema>

export const importCenterPlaneContract = defineRouteContract({
  method: 'GET',
  path: '/api/center/plane/import',
  response: {
    mode: 'json',
    schema: z.object({
      packet: centerProducerImportPacketSchema,
      source: centerPlaneImportSourceSchema,
      capabilities: centerCapabilityRegistrySchema,
    }),
  },
})

export type ImportCenterPlaneResponse = z.output<typeof importCenterPlaneContract.response.schema>

export const importCenterLearnUnderstandContract = defineRouteContract({
  method: 'GET',
  path: '/api/center/learn-understand/import',
  response: {
    mode: 'json',
    schema: z.object({
      packets: z.array(centerProducerImportPacketSchema),
      source: z.object({
        filePath: z.string(),
        recordCount: z.number().int().min(0),
      }),
      capabilities: centerCapabilityRegistrySchema,
    }),
  },
})

export type ImportCenterLearnUnderstandResponse = z.output<
  typeof importCenterLearnUnderstandContract.response.schema
>

export const importCenterWorkerLaneContract = defineRouteContract({
  method: 'GET',
  path: '/api/center/workers/import',
  response: {
    mode: 'json',
    schema: z.object({
      packet: centerProducerImportPacketSchema,
      source: z.object({
        filePath: z.string(),
        recordCount: z.number().int().min(0),
      }),
      capabilities: centerCapabilityRegistrySchema,
    }),
  },
})

export type ImportCenterWorkerLaneResponse = z.output<
  typeof importCenterWorkerLaneContract.response.schema
>

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
