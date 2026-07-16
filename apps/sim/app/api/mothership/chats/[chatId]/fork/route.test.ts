/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAppendCopilotChatMessages,
  mockAssertActiveWorkspaceAccess,
  mockAuthenticateCopilotRequestSessionOnly,
  mockCaptureServerEvent,
  mockEnsureTaskForMothershipChat,
  mockGenerateId,
  mockGetMothershipBaseURL,
  mockLoadCopilotChatMessages,
  mockPublishStatusChanged,
  mockRequestMothershipRuntime,
  mockSelectLimit,
  mockTransaction,
  mockTxReturning,
} = vi.hoisted(() => ({
  mockAppendCopilotChatMessages: vi.fn(),
  mockAssertActiveWorkspaceAccess: vi.fn(),
  mockAuthenticateCopilotRequestSessionOnly: vi.fn(),
  mockCaptureServerEvent: vi.fn(),
  mockEnsureTaskForMothershipChat: vi.fn(),
  mockGenerateId: vi.fn(),
  mockGetMothershipBaseURL: vi.fn(),
  mockLoadCopilotChatMessages: vi.fn(),
  mockPublishStatusChanged: vi.fn(),
  mockRequestMothershipRuntime: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockTransaction: vi.fn(),
  mockTxReturning: vi.fn(),
}))

const mockTx = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: mockTxReturning,
    })),
  })),
}

vi.mock('@sim/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockSelectLimit,
        })),
      })),
    })),
    transaction: mockTransaction,
  },
}))

vi.mock('@sim/db/schema', () => ({
  copilotChats: {
    config: 'copilotChats.config',
    conversationId: 'copilotChats.conversationId',
    id: 'copilotChats.id',
    lastSeenAt: 'copilotChats.lastSeenAt',
    model: 'copilotChats.model',
    planArtifact: 'copilotChats.planArtifact',
    previewYaml: 'copilotChats.previewYaml',
    resources: 'copilotChats.resources',
    title: 'copilotChats.title',
    type: 'copilotChats.type',
    updatedAt: 'copilotChats.updatedAt',
    userId: 'copilotChats.userId',
    workspaceId: 'copilotChats.workspaceId',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}))

vi.mock('@sim/utils/id', () => ({
  generateId: mockGenerateId,
}))

vi.mock('@/lib/copilot/request/http', () => ({
  authenticateCopilotRequestSessionOnly: mockAuthenticateCopilotRequestSessionOnly,
  createBadRequestResponse: (message: string) => Response.json({ error: message }, { status: 400 }),
  createForbiddenResponse: (message: string) => Response.json({ error: message }, { status: 403 }),
  createInternalServerErrorResponse: (message: string) =>
    Response.json({ error: message }, { status: 500 }),
  createNotFoundResponse: (message: string) => Response.json({ error: message }, { status: 404 }),
  createUnauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
}))

vi.mock('@/lib/copilot/chat/lifecycle', () => ({
  loadCopilotChatMessages: mockLoadCopilotChatMessages,
}))

vi.mock('@/lib/copilot/chat/messages-store', () => ({
  appendCopilotChatMessages: mockAppendCopilotChatMessages,
}))

vi.mock('@/lib/copilot/chat-status', () => ({
  chatPubSub: {
    publishStatusChanged: mockPublishStatusChanged,
  },
}))

vi.mock('@/lib/copilot/server/agent-url', () => ({
  getMothershipBaseURL: mockGetMothershipBaseURL,
}))

vi.mock('@/lib/mothership/client', () => ({
  requestMothershipRuntime: mockRequestMothershipRuntime,
}))

vi.mock('@/lib/posthog/server', () => ({
  captureServerEvent: mockCaptureServerEvent,
}))

vi.mock('@/lib/tasks/repository', () => ({
  ensureTaskForMothershipChat: mockEnsureTaskForMothershipChat,
}))

vi.mock('@/lib/workspaces/permissions/utils', () => ({
  assertActiveWorkspaceAccess: mockAssertActiveWorkspaceAccess,
  isWorkspaceAccessDeniedError: vi.fn(() => false),
}))

import { POST } from '@/app/api/mothership/chats/[chatId]/fork/route'

function createRequest() {
  return new NextRequest('http://localhost:3000/api/mothership/chats/source-chat/fork', {
    method: 'POST',
    body: JSON.stringify({ upToMessageId: 'msg-2' }),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createContext() {
  return { params: Promise.resolve({ chatId: 'source-chat' }) }
}

describe('POST /api/mothership/chats/[chatId]/fork', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticateCopilotRequestSessionOnly.mockResolvedValue({
      userId: 'user-1',
      isAuthenticated: true,
    })
    mockGenerateId.mockReturnValue('new-chat')
    mockSelectLimit.mockResolvedValue([
      {
        id: 'source-chat',
        userId: 'user-1',
        type: 'mothership',
        workspaceId: 'ws-1',
        title: 'Source chat',
        model: 'mothership',
        resources: [],
        previewYaml: null,
        planArtifact: null,
        config: null,
      },
    ])
    mockLoadCopilotChatMessages.mockResolvedValue([{ id: 'msg-1' }, { id: 'msg-2' }])
    mockTxReturning.mockResolvedValue([{ id: 'new-chat', workspaceId: 'ws-1' }])
    mockTransaction.mockImplementation(async (callback: (tx: typeof mockTx) => Promise<unknown>) =>
      callback(mockTx)
    )
    mockGetMothershipBaseURL.mockResolvedValue('https://agent.sim.example.com')
    mockRequestMothershipRuntime.mockResolvedValue({ success: true })
  })

  it('forks local chat state and clones Mothership conversation state through the typed runtime client', async () => {
    const response = await POST(createRequest(), createContext())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, id: 'new-chat' })
    expect(mockRequestMothershipRuntime).toHaveBeenCalledWith({
      contract: expect.objectContaining({ path: '/api/chats/fork' }),
      baseUrl: 'https://agent.sim.example.com',
      input: {
        body: {
          sourceChatId: 'source-chat',
          newChatId: 'new-chat',
          upToMessageId: 'msg-2',
          userId: 'user-1',
        },
      },
      spanName: 'sim → go /api/chats/fork',
      operation: 'fork_chat',
      userId: 'user-1',
    })
    expect(mockPublishStatusChanged).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      chatId: 'new-chat',
      type: 'created',
    })
  })

  it('ensures the fork Task inside the existing chat transaction', async () => {
    const response = await POST(createRequest(), createContext())

    expect(response.status).toBe(200)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockEnsureTaskForMothershipChat).toHaveBeenCalledWith('new-chat', mockTx)
    expect(mockEnsureTaskForMothershipChat.mock.invocationCallOrder[0]).toBeLessThan(
      mockAppendCopilotChatMessages.mock.invocationCallOrder[0]
    )
  })

  it('keeps legacy Mothership forks without a workspace outside the Task cohort', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'source-chat',
        userId: 'user-1',
        type: 'mothership',
        workspaceId: null,
        title: 'Legacy source chat',
        model: 'mothership',
        resources: [],
        previewYaml: null,
        planArtifact: null,
        config: null,
      },
    ])
    mockTxReturning.mockResolvedValueOnce([{ id: 'new-chat', workspaceId: null }])

    const response = await POST(createRequest(), createContext())

    expect(response.status).toBe(200)
    expect(mockEnsureTaskForMothershipChat).not.toHaveBeenCalled()
    expect(mockAppendCopilotChatMessages).toHaveBeenCalled()
  })

  it('still returns the local fork when the Mothership clone request fails', async () => {
    mockRequestMothershipRuntime.mockRejectedValueOnce(new Error('agent down'))

    const response = await POST(createRequest(), createContext())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, id: 'new-chat' })
  })
})
