import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '@/lib/api/client/request'
import {
  addMothershipChatResourceContract,
  createMothershipChatContract,
  deleteMothershipChatContract,
  forkMothershipChatContract,
  removeMothershipChatResourceContract,
  reorderMothershipChatResourcesContract,
  updateMothershipChatContract,
} from '@/lib/api/contracts/mothership-chats'
import type { MothershipResource } from '@/lib/copilot/resources/types'
import {
  type MothershipChatHistory,
  parseMothershipChatResourcesResponse,
} from '@/hooks/queries/mothership-chat-history'
import {
  type MothershipChatMetadata,
  mothershipChatKeys,
} from '@/hooks/queries/mothership-chat-keys'
import { applyMothershipChatUnreadFlag } from '@/hooks/queries/mothership-chat-read'
import { useMothershipQueueStore } from '@/stores/mothership-queue/store'

export {
  fetchMothershipChatHistory,
  type MothershipChatHistory,
  useMothershipChatHistory,
} from '@/hooks/queries/mothership-chat-history'
export type { MothershipChatMetadata } from '@/hooks/queries/mothership-chat-keys'
export { mothershipChatKeys } from '@/hooks/queries/mothership-chat-keys'
export { fetchMothershipChats, useMothershipChats } from '@/hooks/queries/mothership-chat-list'
export { useMarkMothershipChatRead } from '@/hooks/queries/mothership-chat-read'

async function deleteChat(chatId: string): Promise<void> {
  await requestJson(deleteMothershipChatContract, {
    params: { chatId },
  })
}

/**
 * Deletes a mothership chat chat and invalidates the chat list.
 */
export function useDeleteMothershipChat(workspaceId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteChat,
    onSettled: (_data, _error, chatId) => {
      queryClient.invalidateQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
      queryClient.removeQueries({ queryKey: mothershipChatKeys.detail(chatId) })
      useMothershipQueueStore.getState().clearChat(chatId)
    },
  })
}

/**
 * Deletes multiple mothership chat chats and invalidates the chat list.
 */
export function useDeleteMothershipChats(workspaceId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (chatIds: string[]) => {
      await Promise.all(chatIds.map(deleteChat))
    },
    onSettled: (_data, _error, chatIds) => {
      queryClient.invalidateQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
      const queueStore = useMothershipQueueStore.getState()
      for (const chatId of chatIds) {
        queryClient.removeQueries({ queryKey: mothershipChatKeys.detail(chatId) })
        queueStore.clearChat(chatId)
      }
    },
  })
}

async function renameChat({ chatId, title }: { chatId: string; title: string }): Promise<void> {
  await requestJson(updateMothershipChatContract, {
    params: { chatId },
    body: { title },
  })
}

/**
 * Renames a mothership chat chat with optimistic update.
 */
export function useRenameMothershipChat(workspaceId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: renameChat,
    onMutate: async ({ chatId, title }) => {
      await queryClient.cancelQueries({ queryKey: mothershipChatKeys.list(workspaceId) })

      const previousChats = queryClient.getQueryData<MothershipChatMetadata[]>(
        mothershipChatKeys.list(workspaceId)
      )

      queryClient.setQueryData<MothershipChatMetadata[]>(
        mothershipChatKeys.list(workspaceId),
        (old) => old?.map((chat) => (chat.id === chatId ? { ...chat, name: title } : chat))
      )

      return { previousChats }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(mothershipChatKeys.list(workspaceId), context.previousChats)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
      queryClient.invalidateQueries({ queryKey: mothershipChatKeys.detail(variables.chatId) })
    },
  })
}

async function addChatResource(params: {
  chatId: string
  resource: MothershipResource
}): Promise<{ resources: MothershipResource[] }> {
  const data = await requestJson(addMothershipChatResourceContract, {
    body: { chatId: params.chatId, resource: params.resource },
  })
  return parseMothershipChatResourcesResponse(data)
}

export function useAddChatResource(chatId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addChatResource,
    onMutate: async ({ resource }) => {
      if (!chatId) return
      await queryClient.cancelQueries({ queryKey: mothershipChatKeys.detail(chatId) })
      const previous = queryClient.getQueryData<MothershipChatHistory>(
        mothershipChatKeys.detail(chatId)
      )
      if (previous) {
        const exists = previous.resources.some(
          (r) => r.type === resource.type && r.id === resource.id
        )
        if (!exists) {
          queryClient.setQueryData<MothershipChatHistory>(mothershipChatKeys.detail(chatId), {
            ...previous,
            resources: [...previous.resources, resource],
          })
        }
      }
      return { previous }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous && chatId) {
        queryClient.setQueryData(mothershipChatKeys.detail(chatId), context.previous)
      }
    },
    onSettled: () => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: mothershipChatKeys.detail(chatId) })
      }
    },
  })
}

async function reorderChatResources(params: {
  chatId: string
  resources: MothershipResource[]
}): Promise<{ resources: MothershipResource[] }> {
  const data = await requestJson(reorderMothershipChatResourcesContract, {
    body: { chatId: params.chatId, resources: params.resources },
  })
  return parseMothershipChatResourcesResponse(data)
}

export function useReorderChatResources(chatId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reorderChatResources,
    onMutate: async ({ resources }) => {
      if (!chatId) return
      await queryClient.cancelQueries({ queryKey: mothershipChatKeys.detail(chatId) })
      const previous = queryClient.getQueryData<MothershipChatHistory>(
        mothershipChatKeys.detail(chatId)
      )
      if (previous) {
        queryClient.setQueryData<MothershipChatHistory>(mothershipChatKeys.detail(chatId), {
          ...previous,
          resources,
        })
      }
      return { previous }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous && chatId) {
        queryClient.setQueryData(mothershipChatKeys.detail(chatId), context.previous)
      }
    },
    onSettled: () => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: mothershipChatKeys.detail(chatId) })
      }
    },
  })
}

async function removeChatResource(params: {
  chatId: string
  resourceType: string
  resourceId: string
}): Promise<{ resources: MothershipResource[] }> {
  const data = await requestJson(removeMothershipChatResourceContract, {
    body: params,
  })
  return parseMothershipChatResourcesResponse(data)
}

export function useRemoveChatResource(chatId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeChatResource,
    onMutate: async ({ resourceType, resourceId }) => {
      if (!chatId) return
      await queryClient.cancelQueries({ queryKey: mothershipChatKeys.detail(chatId) })
      const removed: MothershipChatHistory['resources'] = []
      queryClient.setQueryData<MothershipChatHistory>(mothershipChatKeys.detail(chatId), (prev) => {
        if (!prev) return prev
        const next: MothershipChatHistory['resources'] = []
        for (const r of prev.resources) {
          if (r.type === resourceType && r.id === resourceId) removed.push(r)
          else next.push(r)
        }
        return removed.length > 0 ? { ...prev, resources: next } : prev
      })
      return { removed }
    },
    onError: (_err, _variables, context) => {
      if (!chatId || !context?.removed.length) return
      queryClient.setQueryData<MothershipChatHistory>(mothershipChatKeys.detail(chatId), (prev) =>
        prev ? { ...prev, resources: [...prev.resources, ...context.removed] } : prev
      )
    },
    onSettled: () => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: mothershipChatKeys.detail(chatId) })
      }
    },
  })
}

async function markChatUnread(chatId: string): Promise<void> {
  await requestJson(updateMothershipChatContract, {
    params: { chatId },
    body: { isUnread: true },
  })
}

/**
 * Marks a chat as unread with optimistic update.
 *
 * Same rationale as `useMarkMothershipChatRead` — no list invalidation, since the server
 * only flips `lastSeenAt` and the optimistic update fully reflects the change.
 */
export function useMarkMothershipChatUnread(workspaceId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markChatUnread,
    onMutate: async (chatId) => {
      const previousChats = queryClient.getQueryData<MothershipChatMetadata[]>(
        mothershipChatKeys.list(workspaceId)
      )
      if (!previousChats) return { previousChats }

      await queryClient.cancelQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
      applyMothershipChatUnreadFlag(queryClient, workspaceId, chatId, true)

      return { previousChats }
    },
    onSuccess: (_data, chatId) => {
      applyMothershipChatUnreadFlag(queryClient, workspaceId, chatId, true)
    },
    onError: (_err, _variables, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(mothershipChatKeys.list(workspaceId), context.previousChats)
      }
    },
  })
}

async function setChatPinned({
  chatId,
  pinned,
}: {
  chatId: string
  pinned: boolean
}): Promise<void> {
  await requestJson(updateMothershipChatContract, {
    params: { chatId },
    body: { pinned },
  })
}

/**
 * Pins or unpins a chat with optimistic update. Pinned chats are sorted to
 * the top of the list by the server; the optimistic reducer preserves that
 * ordering by partitioning pinned and unpinned chats while keeping each
 * partition in its existing order (server returns desc(updatedAt) within).
 */
export function useSetMothershipChatPinned(workspaceId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setChatPinned,
    onMutate: async ({ chatId, pinned }) => {
      await queryClient.cancelQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
      const previousChats = queryClient.getQueryData<MothershipChatMetadata[]>(
        mothershipChatKeys.list(workspaceId)
      )
      if (!previousChats) return { previousChats: undefined }

      const updated = previousChats.map((chat) =>
        chat.id === chatId ? { ...chat, isPinned: pinned } : chat
      )
      const pinnedChats = updated.filter((chat) => chat.isPinned)
      const unpinnedChats = updated.filter((chat) => !chat.isPinned)
      queryClient.setQueryData<MothershipChatMetadata[]>(mothershipChatKeys.list(workspaceId), [
        ...pinnedChats,
        ...unpinnedChats,
      ])

      return { previousChats }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousChats) {
        queryClient.setQueryData(mothershipChatKeys.list(workspaceId), context.previousChats)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
    },
  })
}

async function createChat(workspaceId: string): Promise<{ id: string }> {
  const { id } = await requestJson(createMothershipChatContract, { body: { workspaceId } })
  return { id }
}

export function useCreateMothershipChat(workspaceId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => {
      if (!workspaceId) throw new Error('workspaceId is required')
      return createChat(workspaceId)
    },
    onSuccess: (data) => {
      if (!workspaceId) return
      const existing =
        queryClient.getQueryData<MothershipChatMetadata[]>(mothershipChatKeys.list(workspaceId)) ??
        []
      const newChat: MothershipChatMetadata = {
        id: data.id,
        name: 'New chat',
        updatedAt: new Date(),
        isActive: false,
        isUnread: false,
        isPinned: false,
      }
      const pinnedCount = existing.findIndex((chat) => !chat.isPinned)
      const insertAt = pinnedCount === -1 ? existing.length : pinnedCount
      queryClient.setQueryData<MothershipChatMetadata[]>(mothershipChatKeys.list(workspaceId), [
        ...existing.slice(0, insertAt),
        newChat,
        ...existing.slice(insertAt),
      ])
    },
    onSettled: () => {
      if (!workspaceId) return
      queryClient.invalidateQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
    },
  })
}

async function forkChat(params: {
  chatId: string
  upToMessageId: string
}): Promise<{ id: string }> {
  const data = await requestJson(forkMothershipChatContract, {
    params: { chatId: params.chatId },
    body: { upToMessageId: params.upToMessageId },
  })
  return { id: data.id }
}

export function useForkMothershipChat(workspaceId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: forkChat,
    onSuccess: async (data, variables) => {
      if (!workspaceId) return
      await queryClient.cancelQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
      const existing = queryClient.getQueryData<MothershipChatMetadata[]>(
        mothershipChatKeys.list(workspaceId)
      )
      if (existing) {
        const sourceChat = existing.find((t) => t.id === variables.chatId)
        const baseName = (sourceChat?.name ?? 'New chat').replace(/^Fork \| /, '')
        const optimisticChat: MothershipChatMetadata = {
          id: data.id,
          name: `Fork | ${baseName}`,
          updatedAt: new Date(),
          isActive: false,
          isUnread: false,
          isPinned: false,
        }
        const pinnedCount = existing.findIndex((chat) => !chat.isPinned)
        const insertAt = pinnedCount === -1 ? existing.length : pinnedCount
        queryClient.setQueryData<MothershipChatMetadata[]>(mothershipChatKeys.list(workspaceId), [
          ...existing.slice(0, insertAt),
          optimisticChat,
          ...existing.slice(insertAt),
        ])
      }
    },
    onSettled: () => {
      if (!workspaceId) return
      queryClient.invalidateQueries({ queryKey: mothershipChatKeys.list(workspaceId) })
    },
  })
}
