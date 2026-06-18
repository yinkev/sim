import { z } from 'zod'
import { defineRouteContract } from '@/lib/api/contracts/types'

const fileEntrySchema = z.object({
  path: z.string(),
  language: z.string(),
  size: z.number(),
  lines: z.number(),
})

const scanStatsSchema = z.object({
  totalFiles: z.number(),
  totalLines: z.number(),
  languages: z.record(z.string(), z.number()),
  skippedFiles: z.number(),
})

const scanResultSchema = z.object({
  files: z.array(fileEntrySchema),
  stats: scanStatsSchema,
})

const functionDefSchema = z.object({
  name: z.string(),
  line: z.number(),
  signature: z.string(),
})

const classDefSchema = z.object({
  name: z.string(),
  line: z.number(),
  methods: z.array(z.string()),
  extends: z.array(z.string()).optional(),
  implements: z.array(z.string()).optional(),
})

const importDefSchema = z.object({
  path: z.string(),
  names: z.array(z.string()),
})

const callDefSchema = z.object({
  from: z.string(),
  to: z.string(),
  line: z.number(),
})

const parsedFileSchema = z.object({
  path: z.string(),
  language: z.string(),
  functions: z.array(functionDefSchema),
  classes: z.array(classDefSchema),
  imports: z.array(importDefSchema),
  calls: z.array(callDefSchema),
})

const parseResultSchema = z.object({
  files: z.array(parsedFileSchema),
  functions: z.array(functionDefSchema.extend({ path: z.string() })),
  classes: z.array(classDefSchema.extend({ path: z.string() })),
  imports: z.array(importDefSchema.extend({ from: z.string() })),
  calls: z.array(callDefSchema.extend({ path: z.string() })),
})

const graphEdgeTypeSchema = z.enum([
  'imports',
  'calls',
  'defines',
  'depends-on',
  'extends',
  'implements',
])

const fileSummarySchema = z.object({
  path: z.string(),
  summary: z.string(),
})

const relationshipSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: graphEdgeTypeSchema,
})

const extractResultSchema = z.object({
  summaries: z.array(fileSummarySchema),
  relationships: z.array(relationshipSchema),
})

const graphNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['file', 'function', 'class', 'external']),
  path: z.string(),
  label: z.string(),
  summary: z.string().optional(),
})

const graphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: graphEdgeTypeSchema,
})

const knowledgeGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  metadata: z.object({
    generated: z.string(),
    root: z.string(),
    stats: z.object({
      nodes: z.number(),
      edges: z.number(),
      files: z.number(),
    }),
  }),
})

export const analyzeCodebaseContract = defineRouteContract({
  method: 'POST',
  path: '/api/understand/analyze',
  body: z.object({
    workspaceId: z.string().optional(),
    rootPath: z.string().min(1, 'Root path is required'),
    ignorePatterns: z.string().optional(),
    maxFiles: z.coerce.number().int().min(1).max(10000).optional(),
    projectName: z.string().optional(),
    graphOutputPath: z.string().optional(),
    htmlOutputPath: z.string().optional(),
  }),
  response: {
    mode: 'json',
    schema: z.object({
      success: z.literal(true),
      scan: scanResultSchema,
      parsed: parseResultSchema,
      extracted: extractResultSchema,
      graph: knowledgeGraphSchema,
      html: z.string(),
      outputPath: z.string().optional(),
      htmlOutputPath: z.string().optional(),
    }),
  },
})

export type AnalyzeCodebaseResponse = z.infer<(typeof analyzeCodebaseContract.response)['schema']>
