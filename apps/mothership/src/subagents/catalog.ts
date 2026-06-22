import {
  getMothershipToolCatalogEntry,
  OWNED_SUBAGENT_SPECS,
  type OwnedSubagentSpec,
} from '@sim/mothership-contracts'

export type { OwnedSubagentId, OwnedSubagentSpec } from '@sim/mothership-contracts'
export { OWNED_SUBAGENT_SPECS } from '@sim/mothership-contracts'

export function getOwnedSubagentSpec(toolName: string): OwnedSubagentSpec | undefined {
  const entry = getMothershipToolCatalogEntry(toolName)
  if (entry?.route !== 'subagent') return undefined
  if (entry.subagentId === 'workflow') return OWNED_SUBAGENT_SPECS.workflow
  return undefined
}

export function requireOwnedSubagentSpec(toolName: string): OwnedSubagentSpec {
  const spec = getOwnedSubagentSpec(toolName)
  if (!spec) {
    throw new Error(`Owned Mothership subagent ${toolName} is not specified`)
  }
  return spec
}
