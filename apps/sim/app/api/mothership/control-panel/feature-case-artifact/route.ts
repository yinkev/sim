import { createLogger } from '@sim/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { getMothershipFeatureCaseArtifactContract } from '@/lib/api/contracts/mothership-control-panel'
import { parseRequest } from '@/lib/api/server'
import { authenticateCopilotRequestSessionOnly } from '@/lib/copilot/request/http'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import {
  FeatureCaseArtifactForbiddenError,
  FeatureCaseArtifactNotFoundError,
  readFeatureCaseArtifact,
} from '@/lib/mothership/control-panel/feature-case-ledger'

export const dynamic = 'force-dynamic'

const logger = createLogger('MothershipControlPanelArtifactAPI')

function contentDispositionFilename(filename: string): string {
  return filename.replace(/["\\\r\n]/g, '_')
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const { userId, isAuthenticated } = await authenticateCopilotRequestSessionOnly()
  if (!isAuthenticated || !userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseRequest(getMothershipFeatureCaseArtifactContract, request, {})
  if (!parsed.success) return parsed.response

  try {
    const artifact = readFeatureCaseArtifact(parsed.data.query)
    return new NextResponse(artifact.content, {
      status: 200,
      headers: {
        'Content-Type': artifact.contentType,
        'Content-Disposition': `inline; filename="${contentDispositionFilename(artifact.filename)}"`,
        'X-Mothership-Artifact-Path': artifact.path,
      },
    })
  } catch (error) {
    if (error instanceof FeatureCaseArtifactNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 })
    }
    if (error instanceof FeatureCaseArtifactForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }

    logger.error('Failed to read FeatureCase artifact', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to read FeatureCase artifact' },
      { status: 500 }
    )
  }
})
