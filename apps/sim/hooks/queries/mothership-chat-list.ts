import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import {
  listMothershipChatsContract,
  type MothershipChat,
} from '@/lib/api/contracts/mothership-chats'
import {
  type MothershipChatMetadata,
  mothershipChatKeys,
} from '@/hooks/queries/mothership-chat-keys'

export const MOTHERSHIP_CHAT_LIST_STALE_TIME = 60 * 1000

export function mapChat(chat: MothershipChat): MothershipChatMetadata {
  const updatedAt = new Date(chat.updatedAt)
  return {
    id: chat.id,
    name: chat.title ?? 'New chat',
    updatedAt,
    isActive: chat.activeStreamId !== null,
    isUnread:
      chat.activeStreamId === null &&
      (chat.lastSeenAt === null || updatedAt > new Date(chat.lastSeenAt)),
    isPinned: chat.pinned,
  }
}

export async function fetchMothershipChats(
  workspaceId: string,
  signal?: AbortSignal
): Promise<MothershipChatMetadata[]> {
  const data = await requestJson(listMothershipChatsContract, {
    query: { workspaceId },
    signal,
  })
  return data.data.map(mapChat)
}

/**
 * Fetches mothership chat chats for a workspace.
 * These are workspace-scoped conversations from the Home page.
 */
export function useMothershipChats(workspaceId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: mothershipChatKeys.list(workspaceId),
    queryFn: workspaceId ? ({ signal }) => fetchMothershipChats(workspaceId, signal) : skipToken,
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: MOTHERSHIP_CHAT_LIST_STALE_TIME,
  })
}
