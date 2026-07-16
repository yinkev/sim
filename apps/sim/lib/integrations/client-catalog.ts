import type { ComponentType, SVGProps } from 'react'
import { stripVersionSuffix } from '@sim/utils/string'
import { blockTypeToIconMap } from '@/lib/integrations/icon-mapping'
import integrationsJson from '@/lib/integrations/integrations.json'
import type { Integration } from '@/lib/integrations/types'

export type IntegrationIcon = ComponentType<SVGProps<SVGSVGElement>>

/** Runtime-safe integration metadata: serialized data plus SVG components, never executable blocks. */
export interface IntegrationDescriptor {
  blockType: string
  name: string
  icon: IntegrationIcon
  bgColor: string
}

/** All integrations surfaced in the catalog, ordered by scripts/generate-docs.ts. */
export const CLIENT_INTEGRATIONS: readonly Integration[] =
  integrationsJson.integrations as readonly Integration[]

const integrationByType = new Map<string, Integration>()
const descriptorByType = new Map<string, IntegrationDescriptor>()
const descriptors: IntegrationDescriptor[] = []

for (const integration of CLIENT_INTEGRATIONS) {
  const icon = blockTypeToIconMap[integration.type]
  if (!icon) continue

  const descriptor: IntegrationDescriptor = {
    blockType: integration.type,
    name: integration.name,
    icon,
    bgColor: integration.bgColor,
  }
  const baseType = stripVersionSuffix(integration.type)

  integrationByType.set(integration.type, integration)
  integrationByType.set(baseType, integration)
  descriptorByType.set(integration.type, descriptor)
  descriptorByType.set(baseType, descriptor)
  descriptors.push(descriptor)
}

export function getClientIntegration(blockType: string): Integration | undefined {
  return integrationByType.get(blockType) ?? integrationByType.get(stripVersionSuffix(blockType))
}

export function getIntegrationDescriptor(blockType: string): IntegrationDescriptor | undefined {
  return descriptorByType.get(blockType) ?? descriptorByType.get(stripVersionSuffix(blockType))
}

export function getIntegrationIcon(blockType: string): IntegrationIcon | undefined {
  return getIntegrationDescriptor(blockType)?.icon
}

export function listClientIntegrationDescriptors(): readonly IntegrationDescriptor[] {
  return descriptors
}
