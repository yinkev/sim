import { createLogger } from '@sim/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { importCenterReviewPacketsContract } from '@/lib/api/contracts/center'
import { parseRequest } from '@/lib/api/server'
import { readCenterReviewPacketRecords } from '@/lib/center/review-packet-files'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'

const logger = createLogger('CenterReviewPacketImportAPI')

function isLocalReviewPacketImportEnabled(): boolean {
  return process.env.CENTER_DEV === '1' || process.env.NODE_ENV !== 'production'
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const parsed = await parseRequest(importCenterReviewPacketsContract, request, {})
  if (!parsed.success) return parsed.response

  if (!isLocalReviewPacketImportEnabled()) {
    return NextResponse.json(
      { error: 'Center review packet import is local-development only' },
      { status: 403 }
    )
  }

  const records = await readCenterReviewPacketRecords()
  const reviewDir = process.env.CENTER_REVIEW_PACKET_DIR || '.ai-bridge/projects/center/reviews'
  logger.info('Prepared Center review packet import records', {
    reviewDir,
    records: records.length,
    approvedForExecution: records.filter((record) => record.workerGate === 'approved-for-execution')
      .length,
  })

  return NextResponse.json({
    records,
    source: {
      reviewDir,
    },
  })
})
