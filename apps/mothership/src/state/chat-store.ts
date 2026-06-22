import { db } from '@sim/db'
import { copilotChats } from '@sim/db/schema'
import { and, eq } from 'drizzle-orm'

export type AcknowledgeMothershipChatForkResult =
  | { status: 'ready'; copied: false }
  | { status: 'source_missing' }
  | { status: 'new_missing' }

async function hasOwnedMothershipChat(chatId: string, userId: string): Promise<boolean> {
  const [chat] = await db
    .select({ id: copilotChats.id })
    .from(copilotChats)
    .where(
      and(
        eq(copilotChats.id, chatId),
        eq(copilotChats.userId, userId),
        eq(copilotChats.type, 'mothership')
      )
    )
    .limit(1)

  return Boolean(chat)
}

export async function acknowledgeMothershipChatFork(input: {
  sourceChatId: string
  newChatId: string
  userId: string
}): Promise<AcknowledgeMothershipChatForkResult> {
  const sourceExists = await hasOwnedMothershipChat(input.sourceChatId, input.userId)
  if (!sourceExists) return { status: 'source_missing' }

  const newExists = await hasOwnedMothershipChat(input.newChatId, input.userId)
  if (!newExists) return { status: 'new_missing' }

  return { status: 'ready', copied: false }
}
