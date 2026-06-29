import { createLogger } from '@sim/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { importMs2SchedulerCenterContract } from '@/lib/api/contracts/center'
import { parseRequest } from '@/lib/api/server'
import {
  buildMs2SchedulerImportPacket,
  readMs2SchedulerSnapshot,
} from '@/lib/center/producers/ms2scheduler'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'

const logger = createLogger('CenterMS2SchedulerImportAPI')

function isLocalCenterImportEnabled(): boolean {
  return process.env.CENTER_DEV === '1' || process.env.NODE_ENV !== 'production'
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const parsed = await parseRequest(importMs2SchedulerCenterContract, request, {})
  if (!parsed.success) return parsed.response

  if (!isLocalCenterImportEnabled()) {
    return NextResponse.json(
      { error: 'MS2Scheduler import is local-development only' },
      { status: 403 }
    )
  }

  const snapshot = await readMs2SchedulerSnapshot()
  const packet = buildMs2SchedulerImportPacket(snapshot)
  logger.info('Prepared MS2Scheduler Center import packet', {
    dataDir: snapshot.dataDir,
    currentVersion: snapshot.currentVersion,
    evidence: packet.evidence.length,
    rawEvents: packet.rawEvents.length,
    observations: packet.observations.length,
    loops: packet.loops.length,
    recommendations: packet.recommendations.length,
    actionProposals: packet.actionProposals.length,
  })

  return NextResponse.json({
    packet,
    source: {
      dataDir: snapshot.dataDir,
      currentVersion: snapshot.currentVersion,
    },
  })
})
