import { getAccessibleCopilotChatAuth } from '@/lib/copilot/chat/lifecycle'
import { ensureTaskForMothershipChat, type TaskIdentity } from '@/lib/tasks/repository'

/**
 * Resolves or repairs a Task identity only after the existing chat ownership
 * and workspace authorization checks succeed.
 */
export async function getAccessibleMothershipTask(
  chatId: string,
  userId: string
): Promise<TaskIdentity | null> {
  const chat = await getAccessibleCopilotChatAuth(chatId, userId)
  if (!chat || chat.type !== 'mothership' || !chat.workspaceId) return null
  return ensureTaskForMothershipChat(chatId)
}
