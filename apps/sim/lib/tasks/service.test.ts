/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAccessibleCopilotChatAuth, mockEnsureTaskForMothershipChat } = vi.hoisted(() => ({
  mockGetAccessibleCopilotChatAuth: vi.fn(),
  mockEnsureTaskForMothershipChat: vi.fn(),
}))

vi.mock('@/lib/copilot/chat/lifecycle', () => ({
  getAccessibleCopilotChatAuth: mockGetAccessibleCopilotChatAuth,
}))

vi.mock('@/lib/tasks/repository', () => ({
  ensureTaskForMothershipChat: mockEnsureTaskForMothershipChat,
}))

import { getAccessibleMothershipTask } from '@/lib/tasks/service'

const CHAT_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const WORKSPACE_ID = '33333333-3333-4333-8333-333333333333'
const TASK_ID = '44444444-4444-4444-8444-444444444444'

const eligibleChat = {
  id: CHAT_ID,
  userId: USER_ID,
  workflowId: null,
  workspaceId: WORKSPACE_ID,
  type: 'mothership',
}

describe('getAccessibleMothershipTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['missing or unauthorized chat', null],
    ['non-Mothership chat', { ...eligibleChat, type: 'copilot' }],
    ['Mothership chat without a workspace', { ...eligibleChat, workspaceId: null }],
  ])('returns null without repair for an inaccessible %s', async (_label, chat) => {
    mockGetAccessibleCopilotChatAuth.mockResolvedValueOnce(chat)

    await expect(getAccessibleMothershipTask(CHAT_ID, USER_ID)).resolves.toBeNull()

    expect(mockGetAccessibleCopilotChatAuth).toHaveBeenCalledWith(CHAT_ID, USER_ID)
    expect(mockEnsureTaskForMothershipChat).not.toHaveBeenCalled()
  })

  it('repairs and returns the Task only after existing chat authorization succeeds', async () => {
    const task = { id: TASK_ID, chatId: CHAT_ID }
    mockGetAccessibleCopilotChatAuth.mockResolvedValueOnce(eligibleChat)
    mockEnsureTaskForMothershipChat.mockResolvedValueOnce(task)

    await expect(getAccessibleMothershipTask(CHAT_ID, USER_ID)).resolves.toEqual(task)

    expect(mockGetAccessibleCopilotChatAuth).toHaveBeenCalledWith(CHAT_ID, USER_ID)
    expect(mockEnsureTaskForMothershipChat).toHaveBeenCalledWith(CHAT_ID)
    expect(mockGetAccessibleCopilotChatAuth.mock.invocationCallOrder[0]).toBeLessThan(
      mockEnsureTaskForMothershipChat.mock.invocationCallOrder[0]
    )
  })
})
