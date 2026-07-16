import type { SubBlockType } from '@sim/workflow-types/blocks'
import generatedMetadata from '@/lib/workflows/migrations/subblock-metadata.generated.json'

export interface CanonicalPairMetadata {
  canonicalId: string
  basicId: string
  advancedIds: string[]
}

interface BlockMigrationMetadata {
  types: Record<string, string>
  pairs?: CanonicalPairMetadata[]
}

const metadata: Record<string, BlockMigrationMetadata> = generatedMetadata

function getBlockMetadata(blockType: string): BlockMigrationMetadata | undefined {
  if (typeof blockType !== 'string') return undefined
  return metadata[blockType] ?? metadata[blockType.replace(/-/g, '_')]
}

/**
 * Gets the generated subblock type for a registered block and subblock id.
 */
export function getConfiguredSubBlockType(
  blockType: string,
  subBlockId: string
): SubBlockType | undefined {
  return getBlockMetadata(blockType)?.types[subBlockId] as SubBlockType | undefined
}

/**
 * Gets the generated canonical swap pairs for a registered block.
 */
export function getCanonicalPairs(blockType: string): CanonicalPairMetadata[] {
  return getBlockMetadata(blockType)?.pairs ?? []
}
