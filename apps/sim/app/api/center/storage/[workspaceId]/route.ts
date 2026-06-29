import { createLogger } from '@sim/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  getCenterWorkspaceStorageContract,
  putCenterWorkspaceStorageContract,
} from '@/lib/api/contracts/center'
import { parseRequest } from '@/lib/api/server'
import { loadCenterWorkspaceDataset, saveCenterWorkspaceDataset } from '@/lib/center/file-storage'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'

const logger = createLogger('CenterWorkspaceStorageAPI')

interface CenterWorkspaceStorageRouteContext {
  params: Promise<{ workspaceId: string }>
}

function isLocalWorkspaceStorageEnabled(): boolean {
  return process.env.CENTER_DEV === '1' || process.env.NODE_ENV !== 'production'
}

export const GET = withRouteHandler(
  async (request: NextRequest, context: CenterWorkspaceStorageRouteContext) => {
    const parsed = await parseRequest(getCenterWorkspaceStorageContract, request, context)
    if (!parsed.success) return parsed.response

    if (!isLocalWorkspaceStorageEnabled()) {
      return NextResponse.json({ error: 'Center workspace storage is local-only' }, { status: 403 })
    }

    const { workspaceId } = parsed.data.params
    const { dataset, source } = await loadCenterWorkspaceDataset(workspaceId)
    logger.info('Loaded Center workspace storage', {
      workspaceId,
      filePath: source.filePath,
      profiles: dataset.profiles.length,
    })

    return NextResponse.json({ dataset, source })
  }
)

export const PUT = withRouteHandler(
  async (request: NextRequest, context: CenterWorkspaceStorageRouteContext) => {
    const parsed = await parseRequest(putCenterWorkspaceStorageContract, request, context)
    if (!parsed.success) return parsed.response

    if (!isLocalWorkspaceStorageEnabled()) {
      return NextResponse.json({ error: 'Center workspace storage is local-only' }, { status: 403 })
    }

    const { workspaceId } = parsed.data.params
    const source = await saveCenterWorkspaceDataset(workspaceId, parsed.data.body.dataset)
    logger.info('Saved Center workspace storage', {
      workspaceId,
      filePath: source.filePath,
      profiles: parsed.data.body.dataset.profiles.length,
    })

    return NextResponse.json({ ok: true, source })
  }
)
