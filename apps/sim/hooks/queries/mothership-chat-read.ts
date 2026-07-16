import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import { updateMothershipChatContract } from '@/lib/api/contracts/mothership-chats'
import {
  type MothershipChatMetadata,
  mothershipChatKeys,
} from '@/hooks/queries/mothership-chat-keys'

async function markChatRead(chatId: string): Promise<void> {
  await requestJson(updateMothershipChatContract, {
    params: { chatId },
    body: { isUnread: false },
  })
}

export function applyMothershipChatUnreadFlag(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string | undefined,
  chatId: string,
  isUnread: boolean
): void {
  const current = queryClient.getQueryData<MothershipChatMetadata[]>(
    mothershipChatKeys.list(workspaceId)
  )
  if (!current) return
  queryClient.setQueryData<MothershipChatMetadata[]>(
    mothershipChatKeys.list(workspaceId),
    current.map((chat) => (chat.id === chatId ? { ...chat, isUnread } : chat))
  )
}

/**
 * Marks a chat as read with optimistic update.
 *
 * The server only updates `lastSeenAt`, never `updatedAt`, so we deliberately
 * do not invalidate the list cache — that would trigger a refetch that can
 * reorder the sidebar if any unrelated server-side update landed in between.
 *
 * If there is no cached list yet (initial fetch still in flight, e.g. on
 * chat-page refresh), we skip cancellation entirely so the in-flight fetch
 * can resolve normally — otherwise it would be orphaned and never refetched.
 * `onSuccess` then reconciles whichever state the fetch produced.
 */
export function useMarkMothershipChatRead(workspaceId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markChatRead,
    onMutate: async (chatId) => {
      const previousChats = queryClient.getQueryData<MothershipChatMetadata[]>(
        mothershipChatKeys.list(workspaceId)
      )
      if (!previousChats) return { previousChats }

      await queryClient.cancelQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
      applyMothershipChatUnreadFlag(queryClient, workspaceId, chatId, false)

      return { previousChats }
    },
    onSuccess: (_data, chatId) => {
      applyMothershipChatUnreadFlag(queryClient, workspaceId, chatId, false)
    },
    onError: (_err, _variables, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(mothershipChatKeys.list(workspaceId), context.previousChats)
      }
    },
  })
}
