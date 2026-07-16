import { db } from '@sim/db'
import { copilotChats, tasks } from '@sim/db/schema'
import { generateId } from '@sim/utils/id'
import { eq } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db/types'

export interface TaskIdentity {
  id: string
  chatId: string
}

async function ensureTaskForMothershipChatWithExecutor(
  chatId: string,
  executor: DbOrTx
): Promise<TaskIdentity> {
  const [chat] = await executor
    .select({
      id: copilotChats.id,
      type: copilotChats.type,
      workspaceId: copilotChats.workspaceId,
    })
    .from(copilotChats)
    .where(eq(copilotChats.id, chatId))
    .limit(1)

  if (!chat || chat.type !== 'mothership' || !chat.workspaceId) {
    throw new Error(`Cannot create Task identity for ineligible Mothership chat: ${chatId}`)
  }

  const [created] = await executor
    .insert(tasks)
    .values({ id: generateId(), chatId })
    .onConflictDoNothing({ target: tasks.chatId })
    .returning({ id: tasks.id, chatId: tasks.chatId })

  if (created) return created

  const [existing] = await executor
    .select({ id: tasks.id, chatId: tasks.chatId })
    .from(tasks)
    .where(eq(tasks.chatId, chatId))
    .limit(1)

  if (!existing) {
    throw new Error(`Task identity conflict produced no mapping for Mothership chat: ${chatId}`)
  }

  return existing
}

/**
 * Returns the stable Task identity for an eligible Workspace Mothership chat,
 * creating it when absent. Callers with an open transaction must pass it so
 * chat creation and Task identity creation commit atomically.
 */
export async function ensureTaskForMothershipChat(
  chatId: string,
  executor?: DbOrTx
): Promise<TaskIdentity> {
  if (executor) return ensureTaskForMothershipChatWithExecutor(chatId, executor)
  return db.transaction((tx) => ensureTaskForMothershipChatWithExecutor(chatId, tx))
}
