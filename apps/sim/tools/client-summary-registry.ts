import generatedSummaries from '@/tools/client-tool-summary.generated.json'
import type { ToolConfig } from '@/tools/types'

type RegistryToolOutput = NonNullable<ToolConfig['outputs']>[string]

/** Serializable tool output metadata available to initial Studio validation. */
export type ClientToolOutput = Readonly<RegistryToolOutput>

/** Minimal required-user parameter marker used by serializer validation. */
export interface ClientToolRequiredParameter {
  readonly required: true
  readonly visibility: 'user-only'
}

/** Initial metadata used by serializer validation and output discovery. */
export interface ClientToolSummary {
  readonly id: string
  readonly params: Readonly<Record<string, ClientToolRequiredParameter>>
  readonly outputs?: Readonly<Record<string, ClientToolOutput>>
}

export const CLIENT_TOOL_SUMMARIES = generatedSummaries as readonly ClientToolSummary[]

const VERSION_SUFFIX = /_v(\d+)$/
let toolById: Map<string, ClientToolSummary> | undefined
let latestToolByBaseId: Map<string, ClientToolSummary> | undefined

function getToolVersion(toolId: string): number {
  const match = toolId.match(VERSION_SUFFIX)
  return match ? Number.parseInt(match[1], 10) : 1
}

function getBaseToolId(toolId: string): string {
  return toolId.replace(VERSION_SUFFIX, '')
}

function initializeToolLookup(): void {
  toolById = new Map<string, ClientToolSummary>()
  latestToolByBaseId = new Map<string, ClientToolSummary>()

  for (const tool of CLIENT_TOOL_SUMMARIES) {
    toolById.set(tool.id, tool)

    const baseId = getBaseToolId(tool.id)
    const latest = latestToolByBaseId.get(baseId)
    if (!latest || getToolVersion(tool.id) > getToolVersion(latest.id)) {
      latestToolByBaseId.set(baseId, tool)
    }
  }
}

/** Resolves versioned summary ids exactly and unversioned ids to their latest version. */
export function getClientToolSummary(toolId: string): ClientToolSummary | undefined {
  if (!toolById || !latestToolByBaseId) initializeToolLookup()
  if (VERSION_SUFFIX.test(toolId)) return toolById?.get(toolId)
  return latestToolByBaseId?.get(toolId)
}
