import toolCatalogJson from '../contracts/tool-catalog-v1.json' with { type: 'json' }

export type MothershipToolRoute = 'sim' | 'go' | 'client' | 'subagent'
export type MothershipToolMode = 'sync' | 'async'

export interface MothershipToolCatalogEntry {
  id: string
  name: string
  route: MothershipToolRoute
  mode: MothershipToolMode
  subagentId?: string
  internal?: boolean
}

function isToolRoute(value: unknown): value is MothershipToolRoute {
  return value === 'sim' || value === 'go' || value === 'client' || value === 'subagent'
}

function isToolMode(value: unknown): value is MothershipToolMode {
  return value === 'sync' || value === 'async'
}

function parseCatalogEntry(value: unknown): MothershipToolCatalogEntry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    !isToolRoute(record.route) ||
    !isToolMode(record.mode)
  ) {
    return undefined
  }

  return {
    id: record.id,
    name: record.name,
    route: record.route,
    mode: record.mode,
    ...(typeof record.subagentId === 'string' ? { subagentId: record.subagentId } : {}),
    ...(typeof record.internal === 'boolean' ? { internal: record.internal } : {}),
  }
}

const CATALOG_ENTRIES = Array.isArray(toolCatalogJson.tools)
  ? toolCatalogJson.tools.flatMap((tool) => {
      const entry = parseCatalogEntry(tool)
      return entry ? [entry] : []
    })
  : []

export const MOTHERSHIP_TOOL_CATALOG: Record<string, MothershipToolCatalogEntry> =
  Object.fromEntries(CATALOG_ENTRIES.map((entry) => [entry.id, entry]))

export function getMothershipToolCatalogEntry(
  toolId: string
): MothershipToolCatalogEntry | undefined {
  return MOTHERSHIP_TOOL_CATALOG[toolId]
}
