import { requestJson } from '@/lib/api/client/request'
import {
  getCenterWorkspaceStorageContract,
  putCenterWorkspaceStorageContract,
} from '@/lib/api/contracts/center'
import type { CenterStorageAdapter } from '@/lib/center/local-spine'
import type { CenterStorageMode } from '@/lib/center/types'

export interface CreateWorkspaceCenterStorageOptions {
  workspaceId: string
  fallbackStorage: CenterStorageAdapter
  onModeChange?: (mode: CenterStorageMode) => void
}

export function createWorkspaceCenterStorage({
  workspaceId,
  fallbackStorage,
  onModeChange,
}: CreateWorkspaceCenterStorageOptions): CenterStorageAdapter {
  let fallbackActive = false

  return {
    async load() {
      try {
        const response = await requestJson(getCenterWorkspaceStorageContract, {
          params: { workspaceId },
        })
        fallbackActive = false
        onModeChange?.(response.source.storageMode)
        return response.dataset
      } catch {
        fallbackActive = true
        onModeChange?.('browser-local')
        return fallbackStorage.load()
      }
    },
    async save(dataset) {
      if (!fallbackActive) {
        try {
          const response = await requestJson(putCenterWorkspaceStorageContract, {
            params: { workspaceId },
            body: { dataset },
          })
          onModeChange?.(response.source.storageMode)
          return
        } catch {
          fallbackActive = true
          onModeChange?.('browser-local')
        }
      }
      await fallbackStorage.save(dataset)
    },
  }
}
