import { isRecordLike } from '@sim/utils/object'
import { skipToken, useQuery } from '@tanstack/react-query'
import { isApiClientError } from '@/lib/api/client/errors'
import { requestJson } from '@/lib/api/client/request'
import { getMothershipChatContract } from '@/lib/api/contracts/mothership-chats'
import type { PersistedMessage } from '@/lib/copilot/chat/persisted-message'
import { normalizeMessage } from '@/lib/copilot/chat/persisted-message'
import {
  type FilePreviewSession,
  isFilePreviewSession,
} from '@/lib/copilot/request/session/file-preview-session-contract'
import { isStreamBatchEvent, type StreamBatchEvent } from '@/lib/copilot/request/session/types'
import { type MothershipResource, MothershipResourceType } from '@/lib/copilot/resources/types'
import { mothershipChatKeys } from '@/hooks/queries/mothership-chat-keys'

export interface MothershipChatHistory {
  id: string
  title: string | null
  messages: PersistedMessage[]
  activeStreamId: string | null
  resources: MothershipResource[]
  streamSnapshot?: {
    events: StreamBatchEvent[]
    previewSessions: FilePreviewSession[]
    status: string
  } | null
}

function assertValid(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isResourceType(value: unknown): value is MothershipResource['type'] {
  return (
    typeof value === 'string' &&
    Object.values(MothershipResourceType).some((type) => type === value)
  )
}

function parseStreamSnapshot(value: unknown): MothershipChatHistory['streamSnapshot'] {
  if (!isRecordLike(value)) {
    return null
  }

  const rawEvents = Array.isArray(value.events) ? value.events : []
  const events: StreamBatchEvent[] = []
  for (const entry of rawEvents) {
    if (!isStreamBatchEvent(entry)) {
      return null
    }
    events.push(entry)
  }

  const rawPreviewSessions = Array.isArray(value.previewSessions) ? value.previewSessions : []
  const previewSessions: FilePreviewSession[] = []
  for (const session of rawPreviewSessions) {
    if (!isFilePreviewSession(session)) {
      return null
    }
    previewSessions.push(session)
  }

  return {
    events,
    previewSessions,
    status: typeof value.status === 'string' ? value.status : 'unknown',
  }
}

function normalizeMessages(value: unknown): PersistedMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecordLike).map((message) => normalizeMessage(message))
}

function parseResource(value: unknown, context: string): MothershipResource {
  assertValid(isRecordLike(value), `${context} must be an object`)
  assertValid(isResourceType(value.type), `${context}.type is invalid`)
  assertValid(typeof value.id === 'string', `${context}.id must be a string`)
  assertValid(typeof value.title === 'string', `${context}.title must be a string`)

  return {
    type: value.type,
    id: value.id,
    title: value.title,
  }
}

function parseResources(value: unknown, context: string): MothershipResource[] {
  assertValid(Array.isArray(value), `${context} must be an array`)

  return value.map((resource, index) => parseResource(resource, `${context}[${index}]`))
}

function parseStrictStreamSnapshot(
  value: unknown,
  context: string
): MothershipChatHistory['streamSnapshot'] {
  if (value === undefined || value === null) {
    return null
  }

  const snapshot = parseStreamSnapshot(value)
  assertValid(snapshot !== null, `${context} is invalid`)
  return snapshot
}

function parseChatHistory(value: unknown): MothershipChatHistory {
  const responseContext = 'Invalid chat response'
  const chatContext = `${responseContext}: chat`

  assertValid(isRecordLike(value), `${responseContext}: body must be an object`)
  assertValid(isRecordLike(value.chat), `${chatContext} must be an object`)

  const chat = value.chat

  assertValid(typeof chat.id === 'string', `${chatContext}.id must be a string`)
  assertValid(isNullableString(chat.title), `${chatContext}.title must be a string or null`)
  assertValid(Array.isArray(chat.messages), `${chatContext}.messages must be an array`)
  assertValid(
    isNullableString(chat.activeStreamId),
    `${chatContext}.activeStreamId must be a string or null`
  )

  return {
    id: chat.id,
    title: chat.title,
    messages: normalizeMessages(chat.messages),
    activeStreamId: chat.activeStreamId,
    resources: parseResources(chat.resources, `${chatContext}.resources`),
    streamSnapshot: parseStrictStreamSnapshot(chat.streamSnapshot, `${chatContext}.streamSnapshot`),
  }
}

export function parseMothershipChatResourcesResponse(value: unknown): {
  resources: MothershipResource[]
} {
  assertValid(isRecordLike(value), 'Invalid chat resources response: body must be an object')

  return {
    resources: parseResources(value.resources, 'Invalid chat resources response: resources'),
  }
}

export async function fetchMothershipChatHistory(
  chatId: string,
  signal?: AbortSignal
): Promise<MothershipChatHistory> {
  try {
    const data = await requestJson(getMothershipChatContract, {
      params: { chatId },
      signal,
    })
    return parseChatHistory(data)
  } catch (error) {
    if (!isApiClientError(error)) throw error
    // Fall through to the legacy copilot-shape alias on any HTTP error (typically 404
    // when the chat lives in the older copilot table and isn't a mothership-typed row).
  }

  // boundary-raw-fetch: legacy alias path /api/mothership/chat?chatId=... returns the
  // copilot lifecycle shape (activeStreamId, not conversationId) for chats stored under
  // the older copilot table; no contract exists for this alias path
  const copilotRes = await fetch(`/api/mothership/chat?chatId=${encodeURIComponent(chatId)}`, {
    signal,
  })

  if (!copilotRes.ok) {
    throw new Error('Failed to load chat')
  }

  return parseChatHistory(await copilotRes.json())
}

/**
 * Fetches chat history for a single chat (mothership chat).
 * Used by the chat page to load an existing conversation.
 */
export function useMothershipChatHistory(chatId: string | undefined) {
  return useQuery({
    queryKey: mothershipChatKeys.detail(chatId),
    queryFn: chatId ? ({ signal }) => fetchMothershipChatHistory(chatId, signal) : skipToken,
    staleTime: 30 * 1000,
  })
}
