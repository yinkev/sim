/**
 * Block-registry dependency-injection accessor.
 *
 * Breaks a circular dependency: block modules call `getTrigger()` at module-eval
 * time (e.g. `airtable.ts:240`), which needs `TRIGGER_REGISTRY` to be populated,
 * but `triggers/index.ts` transitively imports `@/blocks` via
 * `lib/workflows/triggers/trigger-utils.ts`. Without this accessor, whichever
 * module loads first finds the other's exports undefined — producing
 * `TypeError: Cannot read properties of undefined (reading 'TRIGGER_REGISTRY')`.
 *
 * This module uses a **type-only** import of `getBlock` and `getAllBlocks` (erased
 * by Turbopack at compile time, so no runtime edge). The actual implementation
 * is wired by routes that already import `@/blocks` (editor, settings, academy)
 * via {@link setBlockResolver}. All consumers call {@link resolveBlock} /
 * {@link resolveAllBlocks} instead of importing from `@/blocks` directly.
 *
 * Consumers:
 * - `lib/workflows/triggers/trigger-utils.ts` (the cycle's backward edge)
 * - `lib/workflows/triggers/triggers.ts`
 * - `lib/workflows/triggers/run-options.ts`
 * - `stores/workflows/utils.ts` (decouples block registry from workspace chrome)
 * - `stores/workflows/subblock/store.ts`
 */

import type { getAllBlocks as GetAllBlocksFn, getBlock as GetBlockFn } from '@/blocks'
import type { BlockConfig } from '@/blocks/types'

type GetBlock = typeof GetBlockFn
type GetAllBlocks = typeof GetAllBlocksFn

let blockResolver: GetBlock | undefined
let allBlocksResolver: GetAllBlocks | undefined

/**
 * Wire the real block-registry accessors. Called at module top-level by routes
 * that already statically import `@/blocks` (editor, settings, academy), so the
 * registry is in their compile graph regardless and this adds no new edge.
 */
export function setBlockResolver(getBlock: GetBlock, getAllBlocks: GetAllBlocks): void {
  blockResolver = getBlock
  allBlocksResolver = getAllBlocks
}

/**
 * Resolve a block config by type. Returns `undefined` when no resolver has
 * been wired yet — callers guard `if (!blockConfig)` and degrade safely.
 */
export function resolveBlock(type: string): BlockConfig | undefined {
  return blockResolver?.(type)
}

/**
 * Resolve all registered block configs. Returns `[]` when no resolver has been
 * wired yet — callers iterate the result and handle empty gracefully.
 */
export function resolveAllBlocks(): BlockConfig[] {
  return allBlocksResolver?.() ?? []
}
