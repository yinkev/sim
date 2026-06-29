import { createLogger } from '@sim/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { importCenterPlaneContract } from '@/lib/api/contracts/center'
import { parseRequest } from '@/lib/api/server'
import {
  getUnknownCenterCapabilityIds,
  readCenterCapabilityRegistry,
} from '@/lib/center/capability-registry'
import { buildPlaneImportPacket } from '@/lib/center/producers/plane'
import { readCenterPlaneSnapshot } from '@/lib/center/producers/plane-files'
import {
  readCenterPlaneLiveConfig,
  readCenterPlaneLiveSnapshot,
} from '@/lib/center/producers/plane-live'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'

const logger = createLogger('CenterPlaneImportAPI')

function isLocalPlaneImportEnabled(): boolean {
  return process.env.CENTER_DEV === '1' || process.env.NODE_ENV !== 'production'
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const parsed = await parseRequest(importCenterPlaneContract, request, {})
  if (!parsed.success) return parsed.response

  if (!isLocalPlaneImportEnabled()) {
    return NextResponse.json({ error: 'Plane import is local-development only' }, { status: 403 })
  }

  const liveConfig = readCenterPlaneLiveConfig()
  const snapshot = liveConfig
    ? await readCenterPlaneLiveSnapshot(liveConfig)
    : await readCenterPlaneSnapshot()
  const packet = buildPlaneImportPacket(snapshot)
  const capabilities = await readCenterCapabilityRegistry()
  const unknownCapabilityIds = getUnknownCenterCapabilityIds(packet, capabilities)
  if (unknownCapabilityIds.length > 0) {
    return NextResponse.json(
      { error: 'Unknown Center capability ids', unknownCapabilityIds },
      { status: 422 }
    )
  }
  logger.info('Prepared Plane Center import packet', {
    sourceMode: liveConfig ? 'live-plane' : 'sample-file',
    filePath: snapshot.sourcePath,
    records: snapshot.records.length,
    evidence: packet.evidence.length,
    rawEvents: packet.rawEvents.length,
    observations: packet.observations.length,
    loops: packet.loops.length,
  })

  return NextResponse.json({
    packet,
    source: {
      mode: liveConfig ? 'live-plane' : 'sample-file',
      filePath: snapshot.sourcePath,
      recordCount: snapshot.records.length,
    },
    capabilities,
  })
})
