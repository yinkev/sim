/**
 * @vitest-environment node
 */
import { dbChainMock, dbChainMockFns, resetDbChainMock } from '@sim/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGenerateId } = vi.hoisted(() => ({
  mockGenerateId: vi.fn(),
}))

vi.mock('@sim/db', () => dbChainMock)

vi.mock('@sim/db/schema', () => ({
  copilotChats: {
    id: 'copilotChats.id',
    type: 'copilotChats.type',
    workspaceId: 'copilotChats.workspaceId',
  },
  tasks: {
    id: 'tasks.id',
    chatId: 'tasks.chatId',
  },
}))

vi.mock('@sim/utils/id', () => ({
  generateId: mockGenerateId,
}))

import { ensureTaskForMothershipChat } from '@/lib/tasks/repository'

const CHAT_ID = '11111111-1111-4111-8111-111111111111'
const TASK_ID = '22222222-2222-4222-8222-222222222222'
const WINNING_TASK_ID = '33333333-3333-4333-8333-333333333333'

const eligibleChat = {
  id: CHAT_ID,
  type: 'mothership',
  workspaceId: '44444444-4444-4444-8444-444444444444',
}

describe('ensureTaskForMothershipChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
    mockGenerateId.mockReturnValue(TASK_ID)
  })

  it('creates one identity-only Task for an eligible Mothership chat', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([eligibleChat])
    dbChainMockFns.returning.mockResolvedValueOnce([{ id: TASK_ID, chatId: CHAT_ID }])

    const result = await ensureTaskForMothershipChat(CHAT_ID)

    expect(result).toEqual({ id: TASK_ID, chatId: CHAT_ID })
    expect(mockGenerateId).toHaveBeenCalledOnce()
    expect(dbChainMockFns.values).toHaveBeenCalledWith({ id: TASK_ID, chatId: CHAT_ID })
    expect(dbChainMockFns.onConflictDoNothing).toHaveBeenCalledOnce()
  })

  it('returns the stable winning Task when a concurrent insert wins the conflict', async () => {
    dbChainMockFns.limit
      .mockResolvedValueOnce([eligibleChat])
      .mockResolvedValueOnce([{ id: WINNING_TASK_ID, chatId: CHAT_ID }])
    dbChainMockFns.returning.mockResolvedValueOnce([])

    const result = await ensureTaskForMothershipChat(CHAT_ID)

    expect(result).toEqual({ id: WINNING_TASK_ID, chatId: CHAT_ID })
    expect(dbChainMockFns.values).toHaveBeenCalledWith({ id: TASK_ID, chatId: CHAT_ID })
    expect(dbChainMockFns.onConflictDoNothing).toHaveBeenCalledOnce()
    expect(dbChainMockFns.limit).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['missing chat', []],
    ['non-Mothership chat', [{ ...eligibleChat, type: 'copilot' }]],
    ['Mothership chat without a workspace', [{ ...eligibleChat, workspaceId: null }]],
  ])('rejects an ineligible %s before writing', async (_label, chatRows) => {
    dbChainMockFns.limit.mockResolvedValueOnce(chatRows)

    await expect(ensureTaskForMothershipChat(CHAT_ID)).rejects.toThrow()

    expect(dbChainMockFns.insert).not.toHaveBeenCalled()
    expect(mockGenerateId).not.toHaveBeenCalled()
  })

  it('throws when a conflict reports no winning Task', async () => {
    dbChainMockFns.limit.mockResolvedValueOnce([eligibleChat]).mockResolvedValueOnce([])
    dbChainMockFns.returning.mockResolvedValueOnce([])

    await expect(ensureTaskForMothershipChat(CHAT_ID)).rejects.toThrow()

    expect(dbChainMockFns.onConflictDoNothing).toHaveBeenCalledOnce()
    expect(dbChainMockFns.limit).toHaveBeenCalledTimes(2)
  })
})
