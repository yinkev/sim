import generatedCatalog from '@/tools/client-tool-params.generated.json'
import type { OAuthConfig, ToolConfig } from '@/tools/types'

type RegistryToolParameter = ToolConfig['params'][string]

/** Serializable tool parameter metadata available to Studio clients. */
export type ClientToolParameter = Omit<RegistryToolParameter, 'default'> & {
  readonly default?: unknown
}

/** Serializable OAuth metadata available to deferred Studio UI. */
export interface ClientToolOAuth {
  readonly required: boolean
  readonly provider: OAuthConfig['provider']
  readonly requiredScopes?: readonly string[]
}

/** Deferred UI metadata only. Execution functions and output schemas stay outside this projection. */
export interface ClientToolMetadata {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly params: Readonly<Record<string, ClientToolParameter>>
  readonly oauth?: ClientToolOAuth
}

export const CLIENT_TOOLS = generatedCatalog as readonly ClientToolMetadata[]

const VERSION_SUFFIX = /_v(\d+)$/
let toolById: Map<string, ClientToolMetadata> | undefined
let latestToolByBaseId: Map<string, ClientToolMetadata> | undefined

function getToolVersion(toolId: string): number {
  const match = toolId.match(VERSION_SUFFIX)
  return match ? Number.parseInt(match[1], 10) : 1
}

function getBaseToolId(toolId: string): string {
  return toolId.replace(VERSION_SUFFIX, '')
}

function initializeToolLookup(): void {
  toolById = new Map<string, ClientToolMetadata>()
  latestToolByBaseId = new Map<string, ClientToolMetadata>()

  for (const tool of CLIENT_TOOLS) {
    toolById.set(tool.id, tool)

    const baseId = getBaseToolId(tool.id)
    const latest = latestToolByBaseId.get(baseId)
    if (!latest || getToolVersion(tool.id) > getToolVersion(latest.id)) {
      latestToolByBaseId.set(baseId, tool)
    }
  }
}

/** Resolves versioned UI metadata ids exactly and unversioned ids to their latest version. */
export function getClientTool(toolId: string): ClientToolMetadata | undefined {
  if (!toolById || !latestToolByBaseId) initializeToolLookup()
  if (VERSION_SUFFIX.test(toolId)) return toolById?.get(toolId)
  return latestToolByBaseId?.get(toolId)
}
