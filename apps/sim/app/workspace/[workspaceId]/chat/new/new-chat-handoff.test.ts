/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileAttachmentForApi } from '@/app/workspace/[workspaceId]/home/types'
import type { ChatContext } from '@/stores/panel'
import {
  abortNewChatHandoff,
  buildNewChatResourceAttachments,
  startNewChatHandoff,
} from './new-chat-handoff'

const TRACEPARENT = '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01'

function sessionStream(chatId: string, onCancel: () => void): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"session","payload":'))
      controller.enqueue(encoder.encode(`{"kind":"chat","chatId":"${chatId}"}}\n\n`))
    },
    cancel() {
      onCancel()
    },
  })
}

describe('new chat handoff transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts the first turn and detaches after the persisted chat session arrives', async () => {
    let readerCancelled = false
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        sessionStream('chat-1', () => (readerCancelled = true)),
        {
          status: 200,
          headers: { traceparent: TRACEPARENT },
        }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'America/Los_Angeles' }),
    } as Intl.DateTimeFormat)

    const fileAttachments: FileAttachmentForApi[] = [
      {
        id: 'file-1',
        key: 'uploads/file-1',
        filename: 'notes.md',
        media_type: 'text/markdown',
        size: 42,
      },
    ]
    const contexts: ChatContext[] = [
      { kind: 'workflow', workflowId: 'workflow-1', label: 'Workflow One' },
      { kind: 'integration', blockType: 'slack', label: 'Slack' },
      { kind: 'file', fileId: 'file-2', label: 'Reference' },
    ]
    const onRequestStarted = vi.fn()

    await expect(
      startNewChatHandoff({
        workspaceId: 'workspace-1',
        message: 'Build this',
        userMessageId: 'message-1',
        fileAttachments,
        contexts,
        onRequestStarted,
      })
    ).resolves.toEqual({
      chatId: 'chat-1',
      traceparent: TRACEPARENT,
      userMessageId: 'message-1',
    })

    expect(readerCancelled).toBe(true)
    expect(onRequestStarted).toHaveBeenCalledWith({
      requestId: '0123456789abcdef0123456789abcdef',
      userMessageId: 'message-1',
    })
    const [, request] = fetchMock.mock.calls[0]
    expect(JSON.parse(request.body as string)).toEqual({
      message: 'Build this',
      workspaceId: 'workspace-1',
      userMessageId: 'message-1',
      createNewChat: true,
      fileAttachments,
      resourceAttachments: [
        { type: 'workflow', id: 'workflow-1', title: 'Workflow One', active: false },
        { type: 'file', id: 'file-2', title: 'Reference', active: true },
      ],
      contexts,
      userTimezone: 'America/Los_Angeles',
    })
  })

  it('maps only context kinds that the active chat persists as resources', () => {
    expect(
      buildNewChatResourceAttachments([
        { kind: 'knowledge', knowledgeId: 'knowledge-1', label: 'Docs' },
        { kind: 'table', tableId: 'table-1', label: 'Data' },
        { kind: 'folder', folderId: 'folder-1', label: 'Folder' },
        { kind: 'skill', skillId: 'skill-1', label: 'Skill' },
      ])
    ).toEqual([
      { type: 'knowledgebase', id: 'knowledge-1', title: 'Docs', active: false },
      { type: 'table', id: 'table-1', title: 'Data', active: true },
    ])
  })

  it('surfaces a failed first-turn request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'Cannot start chat' }, { status: 503 }))
    )

    await expect(
      startNewChatHandoff({
        workspaceId: 'workspace-1',
        message: 'Build this',
        userMessageId: 'message-1',
      })
    ).rejects.toThrow('Cannot start chat')
  })

  it('explicitly aborts a pre-navigation stream', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ aborted: true }))
    vi.stubGlobal('fetch', fetchMock)

    await abortNewChatHandoff({
      streamId: 'message-1',
      traceparent: TRACEPARENT,
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/mothership/chat/abort', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        traceparent: TRACEPARENT,
      },
      body: JSON.stringify({ streamId: 'message-1' }),
    })
  })
})
