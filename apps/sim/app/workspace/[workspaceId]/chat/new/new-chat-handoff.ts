import type { FileAttachmentForApi } from '@/app/workspace/[workspaceId]/home/types'
import type { ChatContext } from '@/stores/panel'

interface ResourceAttachment {
  type: 'workflow' | 'knowledgebase' | 'table' | 'file'
  id: string
  title: string
  active: boolean
}

interface StartNewChatHandoffOptions {
  workspaceId: string
  message: string
  userMessageId: string
  fileAttachments?: FileAttachmentForApi[]
  contexts?: ChatContext[]
  signal?: AbortSignal
  onRequestStarted?: (info: { requestId: string; userMessageId: string }) => void
}

interface NewChatHandoffResult {
  chatId: string
  traceparent?: string
  userMessageId: string
}

interface AbortNewChatHandoffOptions {
  streamId: string
  chatId?: string
  traceparent?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function contextResource(context: ChatContext): Omit<ResourceAttachment, 'active'> | null {
  switch (context.kind) {
    case 'workflow':
    case 'current_workflow':
      return { type: 'workflow', id: context.workflowId, title: context.label }
    case 'knowledge':
      return context.knowledgeId
        ? { type: 'knowledgebase', id: context.knowledgeId, title: context.label }
        : null
    case 'table':
      return { type: 'table', id: context.tableId, title: context.label }
    case 'file':
      return { type: 'file', id: context.fileId, title: context.label }
    default:
      return null
  }
}

export function buildNewChatResourceAttachments(contexts: ChatContext[]): ResourceAttachment[] {
  const resources = contexts.flatMap((context) => {
    const resource = contextResource(context)
    return resource ? [resource] : []
  })

  return resources.map((resource, index) => ({
    ...resource,
    active: index === resources.length - 1,
  }))
}

function sessionChatId(eventBlock: string): string | null {
  for (const line of eventBlock.split('\n')) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trimStart()
    if (!data || data === '[DONE]') continue

    try {
      const event = JSON.parse(data) as unknown
      if (!isRecord(event) || event.type !== 'session' || !isRecord(event.payload)) continue
      if (event.payload.kind !== 'chat' || typeof event.payload.chatId !== 'string') continue
      return event.payload.chatId
    } catch {}
  }

  return null
}

async function readSessionChatId(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      buffer = buffer.replaceAll('\r\n', '\n')

      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const chatId = sessionChatId(block)
        if (!chatId) continue
        await reader.cancel('chat_route_handoff')
        return chatId
      }

      if (done) {
        const chatId = sessionChatId(buffer)
        if (chatId) return chatId
        throw new Error('Chat stream ended before returning a persisted chat ID')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function responseErrorMessage(payload: unknown, fallback: string): string {
  return isRecord(payload) && typeof payload.error === 'string' ? payload.error : fallback
}

export async function startNewChatHandoff({
  workspaceId,
  message,
  userMessageId,
  fileAttachments,
  contexts,
  signal,
  onRequestStarted,
}: StartNewChatHandoffOptions): Promise<NewChatHandoffResult> {
  const resourceAttachments = buildNewChatResourceAttachments(contexts ?? [])

  // boundary-raw-fetch: the first-turn SSE session event provides the persisted chat id for route handoff
  const response = await fetch('/api/mothership/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      workspaceId,
      userMessageId,
      createNewChat: true,
      ...(fileAttachments?.length ? { fileAttachments } : {}),
      ...(resourceAttachments.length ? { resourceAttachments } : {}),
      ...(contexts?.length ? { contexts } : {}),
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    signal,
  })

  const traceparent = response.headers.get('traceparent') ?? undefined
  const traceId = traceparent?.split('-')[1]
  if (traceId && /^[0-9a-f]{32}$/.test(traceId)) {
    onRequestStarted?.({ requestId: traceId, userMessageId })
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(responseErrorMessage(payload, `Request failed: ${response.status}`))
  }
  if (!response.body) throw new Error('Chat request returned no response body')

  const chatId = await readSessionChatId(response.body)
  return { chatId, traceparent, userMessageId }
}

export async function abortNewChatHandoff({
  streamId,
  chatId,
  traceparent,
}: AbortNewChatHandoffOptions): Promise<void> {
  // boundary-raw-fetch: explicit stream abort must work before a persisted chat id is available
  const response = await fetch('/api/mothership/chat/abort', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(traceparent ? { traceparent } : {}),
    },
    body: JSON.stringify({ streamId, ...(chatId ? { chatId } : {}) }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(responseErrorMessage(payload, 'Failed to stop chat'))
  }
}
