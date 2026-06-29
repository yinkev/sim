import { createLogger } from '@sim/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { importCenterWorkerLaneContract } from '@/lib/api/contracts/center'
import { parseRequest } from '@/lib/api/server'
import {
  getUnknownCenterCapabilityIds,
  readCenterCapabilityRegistry,
} from '@/lib/center/capability-registry'
import { buildWorkerLaneImportPacket } from '@/lib/center/producers/worker-lane'
import { readCenterWorkerLaneSnapshot } from '@/lib/center/producers/worker-lane-files'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'

const logger = createLogger('CenterWorkerLaneImportAPI')

function isLocalWorkerLaneImportEnabled(): boolean {
  return process.env.CENTER_DEV === '1' || process.env.NODE_ENV !== 'production'
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const parsed = await parseRequest(importCenterWorkerLaneContract, request, {})
  if (!parsed.success) return parsed.response

  if (!isLocalWorkerLaneImportEnabled()) {
    return NextResponse.json(
      { error: 'Worker lane import is local-development only' },
      { status: 403 }
    )
  }

  const snapshot = await readCenterWorkerLaneSnapshot()
  const packet = buildWorkerLaneImportPacket(snapshot)
  const capabilities = await readCenterCapabilityRegistry()
  const unknownCapabilityIds = getUnknownCenterCapabilityIds(packet, capabilities)
  if (unknownCapabilityIds.length > 0) {
    return NextResponse.json(
      { error: 'Unknown Center capability ids', unknownCapabilityIds },
      { status: 422 }
    )
  }
  logger.info('Prepared Worker Lane Center import packet', {
    filePath: snapshot.sourcePath,
    records: snapshot.records.length,
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
      filePath: snapshot.sourcePath,
      recordCount: snapshot.records.length,
    },
    capabilities,
  })
})
