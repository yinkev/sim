import { z } from 'zod'
import { defineRouteContract } from '@/lib/api/contracts/types'

const toolEnvelopeSchema = z.object({
  success: z.boolean(),
  output: z.unknown(),
  error: z.string().optional(),
})

export const understandScanContract = defineRouteContract({
  method: 'POST',
  path: '/api/tools/understand/scan',
  body: z.object({
    rootPath: z.string().min(1, 'Root path is required'),
    ignorePatterns: z.union([z.string(), z.array(z.string())]).optional(),
    maxFiles: z.coerce.number().int().min(1).max(10000).optional(),
    maxFileBytes: z.coerce.number().int().min(1).optional(),
  }),
  response: { mode: 'json', schema: toolEnvelopeSchema },
})

export const understandParseContract = defineRouteContract({
  method: 'POST',
  path: '/api/tools/understand/parse',
  body: z.object({
    files: z.unknown(),
    maxFileBytes: z.coerce.number().int().min(1).optional(),
  }),
  response: { mode: 'json', schema: toolEnvelopeSchema },
})

export const understandExtractContract = defineRouteContract({
  method: 'POST',
  path: '/api/tools/understand/extract',
  body: z.object({
    parsedData: z.unknown(),
    model: z.string().optional(),
  }),
  response: { mode: 'json', schema: toolEnvelopeSchema },
})

export const understandGraphContract = defineRouteContract({
  method: 'POST',
  path: '/api/tools/understand/graph',
  body: z.object({
    rootPath: z.string().optional(),
    scanResult: z.unknown().optional(),
    parsedData: z.unknown().optional(),
    summaries: z.unknown().optional(),
    relationships: z.unknown().optional(),
    projectName: z.string().optional(),
    outputPath: z.string().optional(),
  }),
  response: { mode: 'json', schema: toolEnvelopeSchema },
})

export const understandViewContract = defineRouteContract({
  method: 'POST',
  path: '/api/tools/understand/view',
  body: z.object({
    graph: z.unknown(),
    outputPath: z.string().optional(),
  }),
  response: { mode: 'json', schema: toolEnvelopeSchema },
})
