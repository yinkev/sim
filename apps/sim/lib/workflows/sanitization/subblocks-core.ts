import { isPlainRecord } from '@sim/utils/object'
import { DEFAULT_SUBBLOCK_TYPE } from '@sim/workflow-persistence/subblocks'
import type { BlockState } from '@sim/workflow-types/workflow'

interface SanitizeMalformedSubBlocksOptions {
  convertEmptyStringToNull?: boolean
}

interface SanitizableBlock {
  id: string
  type: string
  subBlocks?: Record<string, unknown>
}

interface SanitizeMalformedSubBlocksLogger {
  warn(message: string, metadata: { blockId: string; subBlockId?: string }): void
}

export type ResolveConfiguredSubBlockType = (
  blockType: string,
  subBlockId: string
) => BlockState['subBlocks'][string]['type'] | undefined

/**
 * Repairs malformed subblock data using an injected configured-type resolver.
 */
export function sanitizeMalformedSubBlocksWithResolver(
  block: SanitizableBlock,
  resolveConfiguredType: ResolveConfiguredSubBlockType,
  options: SanitizeMalformedSubBlocksOptions = {},
  logger?: SanitizeMalformedSubBlocksLogger
): { subBlocks: Record<string, BlockState['subBlocks'][string]>; changed: boolean } {
  let changed = false
  const result: Record<string, BlockState['subBlocks'][string]> = {}

  for (const [subBlockId, subBlock] of Object.entries(block.subBlocks || {})) {
    if (subBlockId === 'undefined') {
      logger?.warn('Skipping malformed subBlock with key "undefined"', { blockId: block.id })
      changed = true
      continue
    }

    const configuredType = resolveConfiguredType(block.type, subBlockId)

    if (!isPlainRecord(subBlock)) {
      if (!configuredType) {
        logger?.warn('Skipping malformed subBlock: unrecognized value entry', {
          blockId: block.id,
          subBlockId,
        })
        changed = true
        continue
      }

      logger?.warn('Repairing malformed subBlock value', { blockId: block.id, subBlockId })
      result[subBlockId] = {
        id: subBlockId,
        type: configuredType || DEFAULT_SUBBLOCK_TYPE,
        value: options.convertEmptyStringToNull && subBlock === '' ? null : subBlock,
      } as BlockState['subBlocks'][string]
      changed = true
      continue
    }

    if (subBlock.type === 'unknown' && !configuredType) {
      logger?.warn('Skipping malformed subBlock: type is "unknown"', {
        blockId: block.id,
        subBlockId,
      })
      changed = true
      continue
    }

    const id = typeof subBlock.id === 'string' && subBlock.id.length > 0 ? subBlock.id : subBlockId
    const typeFromConfig = configuredType || resolveConfiguredType(block.type, id)
    const missingMetadata =
      typeof subBlock.id !== 'string' ||
      subBlock.id.length === 0 ||
      typeof subBlock.type !== 'string' ||
      subBlock.type.length === 0

    if (missingMetadata && !typeFromConfig) {
      logger?.warn('Skipping malformed subBlock: unrecognized metadata entry', {
        blockId: block.id,
        subBlockId,
      })
      changed = true
      continue
    }

    const type =
      typeof subBlock.type === 'string' && subBlock.type.length > 0 && subBlock.type !== 'unknown'
        ? subBlock.type
        : typeFromConfig || DEFAULT_SUBBLOCK_TYPE
    const hasValue = Object.hasOwn(subBlock, 'value')
    const value =
      options.convertEmptyStringToNull && subBlock.value === ''
        ? null
        : hasValue
          ? subBlock.value
          : null

    const repairedMetadata = id !== subBlock.id || type !== subBlock.type
    const normalizedValue = hasValue && value !== subBlock.value

    if (repairedMetadata) {
      logger?.warn('Repairing malformed subBlock metadata', { blockId: block.id, subBlockId })
      changed = true
    } else if (normalizedValue) {
      logger?.warn('Normalizing malformed subBlock value', { blockId: block.id, subBlockId })
      changed = true
    }

    result[subBlockId] = { ...subBlock, id, type, value } as BlockState['subBlocks'][string]
  }

  return { subBlocks: changed ? result : (block.subBlocks as BlockState['subBlocks']), changed }
}
