import { db, runOutsideTransactionContext } from '@sim/db'
import { credential } from '@sim/db/schema'
import {
  loadWorkflowFromNormalizedTablesRaw,
  persistMigratedBlocks,
} from '@sim/workflow-persistence/load'
import type { DbOrTx, NormalizedWorkflowData } from '@sim/workflow-persistence/types'
import type { BlockState, Loop, Parallel } from '@sim/workflow-types/workflow'
import { and, eq, inArray } from 'drizzle-orm'
import {
  backfillCanonicalModes,
  migrateSubblockIds,
} from '@/lib/workflows/migrations/subblock-migrations'
import { sanitizeAgentToolsInBlocks } from '@/lib/workflows/sanitization/agent-tools'

interface MigrationContext {
  blocks: Record<string, BlockState>
  workspaceId: string
  executor: DbOrTx
  migrated: boolean
}

type BlockMigration = (ctx: MigrationContext) => MigrationContext | Promise<MigrationContext>

type PersistedSubBlockValue = BlockState['subBlocks'][string]['value']

/** Preserves legacy persisted payloads while the shared subblock value type remains narrower. */
function persistedSubBlockValue(value: unknown): PersistedSubBlockValue {
  return value as PersistedSubBlockValue
}

function createMigrationPipeline(migrations: BlockMigration[]) {
  return async (
    blocks: Record<string, BlockState>,
    workspaceId: string,
    executor: DbOrTx = db
  ): Promise<{ blocks: Record<string, BlockState>; migrated: boolean }> => {
    let ctx: MigrationContext = { blocks, workspaceId, executor, migrated: false }
    for (const migration of migrations) {
      ctx = await migration(ctx)
    }
    return { blocks: ctx.blocks, migrated: ctx.migrated }
  }
}

export const CREDENTIAL_SUBBLOCK_IDS = new Set([
  'credential',
  'manualCredential',
  'triggerCredentials',
])

/** Migrates agent blocks from the legacy prompt fields to the messages array. */
export function migrateAgentBlocksToMessagesFormat(
  blocks: Record<string, BlockState>
): Record<string, BlockState> {
  return Object.fromEntries(
    Object.entries(blocks).map(([id, block]) => {
      if (block.type === 'agent') {
        const systemPrompt = block.subBlocks.systemPrompt?.value
        const userPrompt = block.subBlocks.userPrompt?.value
        const messages = block.subBlocks.messages?.value

        if ((systemPrompt || userPrompt) && !messages) {
          const newMessages: Array<{ role: string; content: string }> = []

          if (systemPrompt) {
            newMessages.push({
              role: 'system',
              content: typeof systemPrompt === 'string' ? systemPrompt : String(systemPrompt),
            })
          }

          if (userPrompt) {
            let userContent: unknown = userPrompt

            if (typeof userContent === 'object' && userContent !== null) {
              if ('input' in userContent) {
                userContent = (userContent as { input: unknown }).input
              } else {
                userContent = JSON.stringify(userContent)
              }
            }

            newMessages.push({
              role: 'user',
              content: String(userContent),
            })
          }

          return [
            id,
            {
              ...block,
              subBlocks: {
                ...block.subBlocks,
                messages: {
                  id: 'messages',
                  type: 'messages-input',
                  value: newMessages,
                },
              },
            },
          ]
        }
      }
      return [id, block]
    })
  )
}

async function migrateCredentialIds(
  blocks: Record<string, BlockState>,
  workspaceId: string,
  executor: DbOrTx
): Promise<{ blocks: Record<string, BlockState>; migrated: boolean }> {
  const potentialLegacyIds = new Set<string>()

  for (const block of Object.values(blocks)) {
    for (const [subBlockId, subBlock] of Object.entries(block.subBlocks || {})) {
      if (!subBlock || typeof subBlock !== 'object') continue
      const value = (subBlock as { value?: unknown }).value
      if (
        CREDENTIAL_SUBBLOCK_IDS.has(subBlockId) &&
        typeof value === 'string' &&
        value &&
        !value.startsWith('cred_')
      ) {
        potentialLegacyIds.add(value)
      }

      if (subBlockId === 'tools' && Array.isArray(value)) {
        for (const tool of value) {
          if (!tool || typeof tool !== 'object') continue
          const params = 'params' in tool ? tool.params : undefined
          const credParam =
            params && typeof params === 'object' && 'credential' in params
              ? params.credential
              : undefined
          if (typeof credParam === 'string' && credParam && !credParam.startsWith('cred_')) {
            potentialLegacyIds.add(credParam)
          }
        }
      }
    }
  }

  if (potentialLegacyIds.size === 0) {
    return { blocks, migrated: false }
  }

  const rows = await executor
    .select({ id: credential.id, accountId: credential.accountId })
    .from(credential)
    .where(
      and(
        inArray(credential.accountId, [...potentialLegacyIds]),
        eq(credential.workspaceId, workspaceId)
      )
    )

  if (rows.length === 0) {
    return { blocks, migrated: false }
  }

  const accountToCredential = new Map(rows.map((row) => [row.accountId!, row.id]))

  const migratedBlocks = Object.fromEntries(
    Object.entries(blocks).map(([blockId, block]) => {
      let blockChanged = false
      const newSubBlocks = { ...block.subBlocks }

      for (const [subBlockId, subBlock] of Object.entries(newSubBlocks)) {
        if (CREDENTIAL_SUBBLOCK_IDS.has(subBlockId) && typeof subBlock.value === 'string') {
          const newId = accountToCredential.get(subBlock.value)
          if (newId) {
            newSubBlocks[subBlockId] = { ...subBlock, value: newId }
            blockChanged = true
          }
        }

        if (subBlockId === 'tools' && Array.isArray(subBlock.value)) {
          let toolsChanged = false
          const newTools = subBlock.value.map((tool: unknown) => {
            if (!tool || typeof tool !== 'object') return tool
            const params = 'params' in tool ? tool.params : undefined
            if (!params || typeof params !== 'object' || !('credential' in params)) return tool

            const credParam = params.credential
            if (typeof credParam !== 'string') return tool

            const newId = accountToCredential.get(credParam)
            if (!newId) return tool

            toolsChanged = true
            return { ...tool, params: { ...params, credential: newId } }
          })
          if (toolsChanged) {
            newSubBlocks[subBlockId] = {
              ...subBlock,
              value: persistedSubBlockValue(newTools),
            }
            blockChanged = true
          }
        }
      }

      return [blockId, blockChanged ? { ...block, subBlocks: newSubBlocks } : block]
    })
  )

  const anyBlockChanged = Object.keys(migratedBlocks).some(
    (id) => migratedBlocks[id] !== blocks[id]
  )

  return { blocks: migratedBlocks, migrated: anyBlockChanged }
}

export const applyBlockMigrations = createMigrationPipeline([
  (ctx) => {
    const { blocks } = sanitizeAgentToolsInBlocks(ctx.blocks)
    return { ...ctx, blocks }
  },
  (ctx) => ({
    ...ctx,
    blocks: migrateAgentBlocksToMessagesFormat(ctx.blocks),
  }),
  (ctx) => {
    const { blocks, migrated } = migrateSubblockIds(ctx.blocks)
    return { ...ctx, blocks, migrated: ctx.migrated || migrated }
  },
  async (ctx) => {
    const { blocks, migrated } = await migrateCredentialIds(
      ctx.blocks,
      ctx.workspaceId,
      ctx.executor
    )
    return { ...ctx, blocks, migrated: ctx.migrated || migrated }
  },
  (ctx) => {
    const { blocks, migrated } = backfillCanonicalModes(ctx.blocks)
    return { ...ctx, blocks, migrated: ctx.migrated || migrated }
  },
])

/** Loads normalized workflow state and applies all persisted block migrations. */
export async function loadWorkflowFromNormalizedTables(
  workflowId: string,
  externalTx?: DbOrTx
): Promise<NormalizedWorkflowData | null> {
  const raw = await loadWorkflowFromNormalizedTablesRaw(workflowId, externalTx)
  if (!raw) return null

  const { blocks: finalBlocks, migrated } = await applyBlockMigrations(
    raw.blocks,
    raw.workspaceId,
    externalTx ?? db
  )

  if (migrated) {
    runOutsideTransactionContext(() => {
      Promise.resolve().then(() =>
        persistMigratedBlocks(workflowId, raw.blocks, finalBlocks, raw.blockUpdatedAtById)
      )
    })
  }

  const patchedLoops: Record<string, Loop> = { ...raw.loops }
  const patchedParallels: Record<string, Parallel> = { ...raw.parallels }

  for (const id of Object.keys(raw.loops)) {
    if (finalBlocks[id]) {
      patchedLoops[id] = { ...raw.loops[id], enabled: finalBlocks[id].enabled ?? true }
    }
  }
  for (const id of Object.keys(raw.parallels)) {
    if (finalBlocks[id]) {
      patchedParallels[id] = {
        ...raw.parallels[id],
        enabled: finalBlocks[id].enabled ?? true,
      }
    }
  }

  return {
    blocks: finalBlocks,
    edges: raw.edges,
    loops: patchedLoops,
    parallels: patchedParallels,
    isFromNormalizedTables: true,
  }
}
