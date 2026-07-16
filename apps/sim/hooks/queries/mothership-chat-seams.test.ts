/**
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '@/lib/api/client/errors'
import {
  getMothershipChatContract,
  listMothershipChatsContract,
  updateMothershipChatContract,
} from '@/lib/api/contracts/mothership-chats'

const { keepPreviousData, queryClient, requestJson, skipToken, useMutation, useQuery } = vi.hoisted(
  () => ({
    keepPreviousData: Symbol('keepPreviousData'),
    queryClient: {
      cancelQueries: vi.fn().mockResolvedValue(undefined),
      getQueryData: vi.fn(),
      setQueryData: vi.fn(),
    },
    requestJson: vi.fn(),
    skipToken: Symbol('skipToken'),
    useMutation: vi.fn((options) => options),
    useQuery: vi.fn((options) => options),
  })
)

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient: vi.fn(() => queryClient),
}))

vi.mock('@/lib/api/client/request', () => ({ requestJson }))

import {
  fetchMothershipChatHistory,
  useMothershipChatHistory,
} from '@/hooks/queries/mothership-chat-history'
import { mothershipChatKeys } from '@/hooks/queries/mothership-chat-keys'
import { useMothershipChats } from '@/hooks/queries/mothership-chat-list'
import { useMarkMothershipChatRead } from '@/hooks/queries/mothership-chat-read'

function readQuerySource(fileName: string): string {
  try {
    return readFileSync(new URL(fileName, import.meta.url), 'utf8')
  } catch {
    return ''
  }
}

describe('mothership chat query seams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves every chat query key shape', () => {
    expect(mothershipChatKeys.all).toEqual(['mothership-chats'])
    expect(mothershipChatKeys.lists()).toEqual(['mothership-chats', 'list'])
    expect(mothershipChatKeys.list('workspace-1')).toEqual([
      'mothership-chats',
      'list',
      'workspace-1',
    ])
    expect(mothershipChatKeys.list(undefined)).toEqual(['mothership-chats', 'list', ''])
    expect(mothershipChatKeys.details()).toEqual(['mothership-chats', 'detail'])
    expect(mothershipChatKeys.detail('chat-1')).toEqual(['mothership-chats', 'detail', 'chat-1'])
    expect(mothershipChatKeys.detail(undefined)).toEqual(['mothership-chats', 'detail', ''])
  })

  it('preserves list request, mapping, placeholder, and staleness behavior', async () => {
    const signal = new AbortController().signal
    requestJson.mockResolvedValue({
      data: [
        {
          id: 'chat-1',
          title: null,
          updatedAt: '2026-04-11T10:00:00.000Z',
          activeStreamId: null,
          lastSeenAt: '2026-04-11T09:00:00.000Z',
          pinned: true,
        },
        {
          id: 'chat-2',
          title: 'Running',
          updatedAt: '2026-04-11T10:00:00.000Z',
          activeStreamId: 'stream-1',
          lastSeenAt: null,
          pinned: false,
        },
      ],
    })

    useMothershipChats('workspace-1')

    const options = useQuery.mock.calls[0][0] as {
      placeholderData: unknown
      queryFn: (context: { signal: AbortSignal }) => Promise<unknown>
      queryKey: readonly string[]
      staleTime: number
    }

    expect(options.queryKey).toEqual(['mothership-chats', 'list', 'workspace-1'])
    expect(options.placeholderData).toBe(keepPreviousData)
    expect(options.staleTime).toBe(60_000)
    await expect(options.queryFn({ signal })).resolves.toEqual([
      {
        id: 'chat-1',
        name: 'New chat',
        updatedAt: new Date('2026-04-11T10:00:00.000Z'),
        isActive: false,
        isUnread: true,
        isPinned: true,
      },
      {
        id: 'chat-2',
        name: 'Running',
        updatedAt: new Date('2026-04-11T10:00:00.000Z'),
        isActive: true,
        isUnread: false,
        isPinned: false,
      },
    ])
    expect(requestJson).toHaveBeenCalledWith(listMothershipChatsContract, {
      query: { workspaceId: 'workspace-1' },
      signal,
    })

    useMothershipChats(undefined)
    expect(useQuery.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        queryFn: skipToken,
        queryKey: ['mothership-chats', 'list', ''],
      })
    )
  })

  it('preserves history request, cancellation, and staleness behavior', async () => {
    const signal = new AbortController().signal
    requestJson.mockResolvedValue({
      chat: {
        id: 'chat-1',
        title: null,
        messages: [],
        activeStreamId: null,
        resources: [],
        streamSnapshot: null,
      },
    })

    useMothershipChatHistory('chat-1')

    const options = useQuery.mock.calls[0][0] as {
      queryFn: (context: { signal: AbortSignal }) => Promise<unknown>
      queryKey: readonly string[]
      staleTime: number
    }

    expect(options.queryKey).toEqual(['mothership-chats', 'detail', 'chat-1'])
    expect(options.staleTime).toBe(30_000)
    await expect(options.queryFn({ signal })).resolves.toEqual({
      id: 'chat-1',
      title: null,
      messages: [],
      activeStreamId: null,
      resources: [],
      streamSnapshot: null,
    })
    expect(requestJson).toHaveBeenCalledWith(getMothershipChatContract, {
      params: { chatId: 'chat-1' },
      signal,
    })

    useMothershipChatHistory(undefined)
    expect(useQuery.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        queryFn: skipToken,
        queryKey: ['mothership-chats', 'detail', ''],
      })
    )
  })

  it('preserves the legacy chat fallback for API client errors', async () => {
    const signal = new AbortController().signal
    requestJson.mockRejectedValue(
      new ApiClientError({ status: 404, message: 'Not found', body: null })
    )
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          chat: {
            id: 'legacy/chat',
            title: 'Legacy',
            messages: [],
            activeStreamId: null,
            resources: [],
          },
        }),
        { status: 200 }
      )
    )

    await expect(fetchMothershipChatHistory('legacy/chat', signal)).resolves.toEqual(
      expect.objectContaining({ id: 'legacy/chat', title: 'Legacy' })
    )
    expect(fetch).toHaveBeenCalledWith('/api/mothership/chat?chatId=legacy%2Fchat', { signal })
  })

  it('preserves read mutation cache cancellation, reconciliation, and rollback', async () => {
    const chats = [
      {
        id: 'chat-1',
        name: 'Chat',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        isActive: false,
        isUnread: true,
        isPinned: false,
      },
    ]
    queryClient.getQueryData.mockReturnValue(chats)

    useMarkMothershipChatRead('workspace-1')

    const mutation = useMutation.mock.calls[0][0] as {
      mutationFn: (chatId: string) => Promise<void>
      onError: (error: Error, chatId: string, context?: { previousChats?: typeof chats }) => void
      onMutate: (chatId: string) => Promise<{ previousChats?: typeof chats }>
      onSuccess: (data: undefined, chatId: string) => void
    }

    await mutation.onMutate('chat-1')
    expect(queryClient.cancelQueries).toHaveBeenCalledWith({
      queryKey: ['mothership-chats', 'list', 'workspace-1'],
    })
    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ['mothership-chats', 'list', 'workspace-1'],
      [{ ...chats[0], isUnread: false }]
    )

    queryClient.setQueryData.mockClear()
    mutation.onSuccess(undefined, 'chat-1')
    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ['mothership-chats', 'list', 'workspace-1'],
      [{ ...chats[0], isUnread: false }]
    )

    queryClient.setQueryData.mockClear()
    mutation.onError(new Error('failed'), 'chat-1', { previousChats: chats })
    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ['mothership-chats', 'list', 'workspace-1'],
      chats
    )

    requestJson.mockResolvedValue(undefined)
    await mutation.mutationFn('chat-1')
    expect(requestJson).toHaveBeenCalledWith(updateMothershipChatContract, {
      params: { chatId: 'chat-1' },
      body: { isUnread: false },
    })
  })

  it('does not cancel an in-flight list when no cache exists', async () => {
    queryClient.getQueryData.mockReturnValue(undefined)
    useMarkMothershipChatRead('workspace-1')

    const mutation = useMutation.mock.calls[0][0] as {
      onMutate: (chatId: string) => Promise<{ previousChats?: unknown }>
    }

    await expect(mutation.onMutate('chat-1')).resolves.toEqual({ previousChats: undefined })
    expect(queryClient.cancelQueries).not.toHaveBeenCalled()
    expect(queryClient.setQueryData).not.toHaveBeenCalled()
  })

  it('keeps narrow implementations independent with broad compatibility exports', () => {
    const keysSource = readQuerySource('mothership-chat-keys.ts')
    const historySource = readQuerySource('mothership-chat-history.ts')
    const listSource = readQuerySource('mothership-chat-list.ts')
    const readSource = readQuerySource('mothership-chat-read.ts')
    const broadSource = readQuerySource('mothership-chats.ts')

    expect(keysSource).toContain('export const mothershipChatKeys')
    expect(historySource).toContain('export function useMothershipChatHistory')
    expect(historySource).toContain('export async function fetchMothershipChatHistory')
    expect(historySource).not.toMatch(
      /useMutation|createMothershipChatContract|useMothershipQueueStore/
    )
    expect(listSource).toContain('export function useMothershipChats')
    expect(listSource).toContain('export async function fetchMothershipChats')
    expect(listSource).not.toMatch(
      /useMutation|createMothershipChatContract|useMothershipQueueStore/
    )
    expect(readSource).toContain('export function useMarkMothershipChatRead')
    expect(readSource).not.toMatch(/useQuery\(|getMothershipChatContract|useMothershipQueueStore/)
    expect(broadSource).toContain(
      "export { mothershipChatKeys } from '@/hooks/queries/mothership-chat-keys'"
    )
    expect(broadSource).toContain("from '@/hooks/queries/mothership-chat-history'")
    expect(broadSource).toContain("from '@/hooks/queries/mothership-chat-list'")
    expect(broadSource).toContain(
      "export { useMarkMothershipChatRead } from '@/hooks/queries/mothership-chat-read'"
    )
    expect(broadSource).not.toMatch(/export const mothershipChatKeys\s*=/)
    expect(broadSource).not.toMatch(/export function useMothershipChatHistory\s*\(/)
    expect(broadSource).not.toMatch(/export function useMothershipChats\s*\(/)
    expect(broadSource).not.toMatch(/async function fetchMothershipChats\s*\(/)
    expect(broadSource).not.toMatch(/export function useMarkMothershipChatRead\s*\(/)
  })
})
