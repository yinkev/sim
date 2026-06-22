import { createLogger } from '@sim/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { listMothershipFeatureCasesContract } from '@/lib/api/contracts/mothership-control-panel'
import { parseRequest } from '@/lib/api/server'
import { authenticateCopilotRequestSessionOnly } from '@/lib/copilot/request/http'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { readFeatureCaseLedger } from '@/lib/mothership/control-panel/feature-case-ledger'

export const dynamic = 'force-dynamic'

const logger = createLogger('MothershipControlPanelFeatureCasesAPI')

export const GET = withRouteHandler(async (request: NextRequest) => {
  const { userId, isAuthenticated } = await authenticateCopilotRequestSessionOnly()
  if (!isAuthenticated || !userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = await parseRequest(listMothershipFeatureCasesContract, request, {})
  if (!parsed.success) return parsed.response

  try {
    const result = readFeatureCaseLedger(parsed.data.query)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logger.error('Failed to read FeatureCase ledger', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to read FeatureCase ledger' },
      { status: 500 }
    )
  }
})
