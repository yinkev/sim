export interface MothershipChatMetadata {
  id: string
  name: string
  updatedAt: Date
  isActive: boolean
  isUnread: boolean
  isPinned: boolean
}

export const mothershipChatKeys = {
  all: ['mothership-chats'] as const,
  lists: () => [...mothershipChatKeys.all, 'list'] as const,
  list: (workspaceId: string | undefined) =>
    [...mothershipChatKeys.lists(), workspaceId ?? ''] as const,
  details: () => [...mothershipChatKeys.all, 'detail'] as const,
  detail: (chatId: string | undefined) => [...mothershipChatKeys.details(), chatId ?? ''] as const,
}
