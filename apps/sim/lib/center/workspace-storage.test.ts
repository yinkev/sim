/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryCenterStorage } from '@/lib/center/local-spine'
import type { CenterDataset, CenterStorageMode } from '@/lib/center/types'
import { createWorkspaceCenterStorage } from '@/lib/center/workspace-storage'

const emptyDataset: CenterDataset = {
  profiles: [],
  actors: [],
  rawEvents: [],
  evidence: [],
  observations: [],
  loops: [],
  decisions: [],
  recommendations: [],
  actionProposals: [],
  featureProjections: [],
  predictionSummaries: [],
  outcomes: [],
  reviewPackets: [],
}

const dataset: CenterDataset = {
  ...emptyDataset,
  profiles: [
    {
      id: 'profile-1',
      displayName: 'Kevin',
      createdAt: '2026-06-29T00:00:00Z',
      status: 'active',
      storageMode: 'workspace',
      telemetry: 'off',
    },
  ],
}

describe('createWorkspaceCenterStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and saves through the workspace storage route when available', async () => {
    const modes: CenterStorageMode[] = []
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          dataset,
          source: { storageMode: 'workspace', filePath: '/tmp/local-test.json' },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          source: { storageMode: 'workspace', filePath: '/tmp/local-test.json' },
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const storage = createWorkspaceCenterStorage({
      workspaceId: 'local-test',
      fallbackStorage: createMemoryCenterStorage(),
      onModeChange: (mode) => modes.push(mode),
    })

    await expect(storage.load()).resolves.toEqual(dataset)
    await storage.save(dataset)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/center/storage/local-test')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/center/storage/local-test')
    expect(modes).toEqual(['workspace', 'workspace'])
  })

  it('falls back to browser-local storage after a route failure', async () => {
    const modes: CenterStorageMode[] = []
    const fallbackStorage = createMemoryCenterStorage(dataset)
    const fetchMock = vi.fn().mockRejectedValue(new Error('route unavailable'))
    vi.stubGlobal('fetch', fetchMock)
    const storage = createWorkspaceCenterStorage({
      workspaceId: 'local-test',
      fallbackStorage,
      onModeChange: (mode) => modes.push(mode),
    })

    await expect(storage.load()).resolves.toEqual(dataset)
    await storage.save(emptyDataset)
    await expect(fallbackStorage.load()).resolves.toEqual(emptyDataset)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(modes).toEqual(['browser-local'])
  })
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
