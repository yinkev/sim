import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { centerDatasetSchema } from '@/lib/api/contracts/center'
import type { CenterDataset } from '@/lib/center/types'

const DEFAULT_CENTER_STORAGE_DIR = path.join(getRepoRoot(), 'var/center/storage')

const EMPTY_CENTER_DATASET: CenterDataset = {
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

export interface CenterWorkspaceStorageSource {
  storageMode: 'workspace'
  filePath: string
}

export function resolveCenterWorkspaceStoragePath(
  workspaceId: string,
  storageDir = process.env.CENTER_WORKSPACE_STORAGE_DIR || DEFAULT_CENTER_STORAGE_DIR
): string {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(workspaceId)) {
    throw new Error(`Invalid Center workspace id: ${workspaceId}`)
  }
  return path.join(storageDir, `${workspaceId}.json`)
}

export async function loadCenterWorkspaceDataset(
  workspaceId: string,
  storageDir?: string
): Promise<{ dataset: CenterDataset; source: CenterWorkspaceStorageSource }> {
  const filePath = resolveCenterWorkspaceStoragePath(workspaceId, storageDir)
  const text = await readFile(filePath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (!text) {
    return {
      dataset: structuredClone(EMPTY_CENTER_DATASET),
      source: { storageMode: 'workspace', filePath },
    }
  }

  return {
    dataset: centerDatasetSchema.parse(JSON.parse(text)),
    source: { storageMode: 'workspace', filePath },
  }
}

export async function saveCenterWorkspaceDataset(
  workspaceId: string,
  dataset: CenterDataset,
  storageDir?: string
): Promise<CenterWorkspaceStorageSource> {
  const filePath = resolveCenterWorkspaceStoragePath(workspaceId, storageDir)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(centerDatasetSchema.parse(dataset), null, 2)}\n`)
  return { storageMode: 'workspace', filePath }
}

function getRepoRoot(): string {
  const cwd = process.cwd()
  if (cwd.endsWith(path.join('apps', 'sim'))) return path.resolve(cwd, '../..')
  return cwd
}
