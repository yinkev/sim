/**
 * @vitest-environment node
 */
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  loadCenterWorkspaceDataset,
  resolveCenterWorkspaceStoragePath,
  saveCenterWorkspaceDataset,
} from '@/lib/center/file-storage'
import type { CenterDataset } from '@/lib/center/types'

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

describe('Center workspace file storage', () => {
  it('loads empty workspace storage and persists a valid dataset', async () => {
    const storageDir = await mkdtemp(path.join(tmpdir(), 'center-storage-'))
    const missing = await loadCenterWorkspaceDataset('local-test', storageDir)

    expect(missing.dataset).toEqual(emptyDataset)
    expect(missing.source).toEqual({
      storageMode: 'workspace',
      filePath: path.join(storageDir, 'local-test.json'),
    })

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

    const source = await saveCenterWorkspaceDataset('local-test', dataset, storageDir)
    const loaded = await loadCenterWorkspaceDataset('local-test', storageDir)
    const raw = JSON.parse(await readFile(source.filePath, 'utf8')) as CenterDataset

    expect(source).toEqual(missing.source)
    expect(loaded.dataset).toEqual(dataset)
    expect(raw.profiles).toEqual(dataset.profiles)
  })

  it('rejects unsafe workspace ids before resolving paths', () => {
    expect(() => resolveCenterWorkspaceStoragePath('../bad')).toThrow('Invalid Center workspace id')
  })
})
