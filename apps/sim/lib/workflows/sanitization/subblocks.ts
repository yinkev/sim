import { createLogger } from '@sim/logger'
import { sanitizeMalformedSubBlocksWithResolver } from '@/lib/workflows/sanitization/subblocks-core'
import { getBlock } from '@/blocks'
import type { BlockState } from '@/stores/workflows/workflow/types'

const logger = createLogger('WorkflowSubblockSanitization')

interface SanitizeMalformedSubBlocksOptions {
  convertEmptyStringToNull?: boolean
}

interface SanitizableBlock {
  id: string
  type: string
  subBlocks?: Record<string, unknown>
}

/**
 * Repairs legacy subBlock metadata when the map key identifies a real field,
 * and drops entries that cannot be associated with a stable subBlock.
 */
export function sanitizeMalformedSubBlocks(
  block: SanitizableBlock,
  options: SanitizeMalformedSubBlocksOptions = {}
): { subBlocks: Record<string, BlockState['subBlocks'][string]>; changed: boolean } {
  const blockConfig = getBlock(block.type)
  return sanitizeMalformedSubBlocksWithResolver(
    block,
    (_blockType, subBlockId) =>
      blockConfig?.subBlocks?.find((config) => config.id === subBlockId)?.type,
    options,
    logger
  )
}
