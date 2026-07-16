import { generateId } from '@sim/utils/id'
import type { CenterStorageAdapter } from '@/lib/center/local-spine'
import type { CenterDataset, CenterEvidence, CenterReviewPacket } from '@/lib/center/types'

export interface CenterReviewPacketImportRecord {
  sourceRef: string
  packetId: string
  projectId?: string
  title: string
  topic?: string
  status: CenterReviewPacket['status']
  approvalState: CenterReviewPacket['approvalState']
  workerGate: CenterReviewPacket['workerGate']
  round: number
  maxRounds: number
  createdAt?: string
  updatedAt?: string
  uri: string
  payload?: Record<string, unknown>
}

export interface CenterReviewPacketImportSummary {
  reviewPacketsAdded: number
  evidenceAdded: number
  skippedExisting: number
}

const EMPTY_SUMMARY: CenterReviewPacketImportSummary = {
  reviewPacketsAdded: 0,
  evidenceAdded: 0,
  skippedExisting: 0,
}

export async function applyCenterReviewPacketImport(
  storage: CenterStorageAdapter,
  profileId: string,
  records: CenterReviewPacketImportRecord[]
): Promise<CenterReviewPacketImportSummary> {
  const dataset = await storage.load()
  assertProfileExists(dataset, profileId)

  const summary = { ...EMPTY_SUMMARY }
  const evidenceBySourceRef = buildSourceRefIndex(dataset.evidence, profileId)
  const packetBySourceRef = buildSourceRefIndex(dataset.reviewPackets, profileId)

  for (const record of records) {
    const evidenceSourceRef = `${record.sourceRef}:evidence`
    let evidenceId = evidenceBySourceRef.get(evidenceSourceRef)
    if (!evidenceId) {
      const evidence: CenterEvidence = {
        id: generateId(),
        profileId,
        producerId: 'center-review',
        subjectType: 'review-packet',
        subjectId: record.packetId,
        kind: 'source',
        title: `Review packet source ${record.packetId}`,
        uri: record.uri,
        payload: record.payload,
        createdAt: new Date().toISOString(),
        sourceRef: evidenceSourceRef,
      }
      dataset.evidence.push(evidence)
      evidenceBySourceRef.set(evidenceSourceRef, evidence.id)
      evidenceId = evidence.id
      summary.evidenceAdded += 1
    }

    if (packetBySourceRef.has(record.sourceRef)) {
      summary.skippedExisting += 1
      continue
    }

    const reviewPacket: CenterReviewPacket = {
      id: generateId(),
      profileId,
      packetId: record.packetId,
      projectId: record.projectId,
      title: record.title,
      topic: record.topic,
      status: record.status,
      approvalState: record.approvalState,
      workerGate: record.workerGate,
      round: record.round,
      maxRounds: record.maxRounds,
      evidenceRefs: [evidenceId],
      decisionRefs: [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      sourceRef: record.sourceRef,
    }
    dataset.reviewPackets.push(reviewPacket)
    packetBySourceRef.set(record.sourceRef, reviewPacket.id)
    summary.reviewPacketsAdded += 1
  }

  await storage.save(dataset)
  return summary
}

function buildSourceRefIndex<T extends { profileId: string; id: string; sourceRef?: string }>(
  items: T[],
  profileId: string
): Map<string, string> {
  const index = new Map<string, string>()
  for (const item of items) {
    if (item.profileId === profileId && item.sourceRef) index.set(item.sourceRef, item.id)
  }
  return index
}

function assertProfileExists(dataset: CenterDataset, profileId: string) {
  if (!dataset.profiles.some((profile) => profile.id === profileId)) {
    throw new Error(`Center profile not found: ${profileId}`)
  }
}
