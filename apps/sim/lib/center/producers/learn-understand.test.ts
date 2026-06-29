/**
 * @vitest-environment node
 */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildLearnUnderstandImportPackets } from '@/lib/center/producers/learn-understand'
import { readCenterLearnUnderstandSnapshot } from '@/lib/center/producers/learn-understand-files'

describe('Learn/Understand Center adapters', () => {
  it('maps Learn and Understand records into separate Center producer packets', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'learn-understand-center-'))
    const filePath = path.join(tempDir, 'events.json')
    await writeFile(
      filePath,
      JSON.stringify({
        records: [
          {
            kind: 'learning_gap',
            gapId: 'gap-1',
            topic: 'Cardiology',
            title: 'Differentiate preload and afterload',
            severity: 'high',
            detectedAt: '2026-06-29T03:00:00Z',
            source: 'review',
            url: 'file://learn/gap-1',
          },
          {
            kind: 'practice_task',
            taskId: 'practice-1',
            topic: 'Cardiology',
            title: 'Complete 10 hemodynamics cards',
            status: 'open',
            createdAt: '2026-06-29T03:05:00Z',
            dueAt: '2026-06-30',
            url: 'file://learn/practice-1',
          },
          {
            kind: 'review_evidence',
            evidenceId: 'review-1',
            topic: 'Cardiology',
            title: 'Hemodynamics quiz',
            result: 'partial',
            score: 0.62,
            reviewedAt: '2026-06-29T03:10:00Z',
            url: 'file://learn/review-1',
          },
          {
            kind: 'system_map',
            mapId: 'map-1',
            scope: 'Center',
            title: 'Center producer spine',
            generatedAt: '2026-06-29T03:15:00Z',
            nodeCount: 18,
            edgeCount: 27,
            url: 'file://understand/map-1',
          },
          {
            kind: 'dependency_observation',
            observationId: 'dep-1',
            scope: 'Center',
            from: 'Center route',
            to: 'producer import packet',
            relation: 'depends-on',
            risk: 'low',
            observedAt: '2026-06-29T03:20:00Z',
            url: 'file://understand/dep-1',
          },
          {
            kind: 'risk_evidence',
            riskId: 'risk-1',
            scope: 'Center',
            title: 'Producer fixture can drift from live API',
            severity: 'high',
            area: 'producer import',
            detectedAt: '2026-06-29T03:25:00Z',
            url: 'file://understand/risk-1',
          },
        ],
      })
    )

    const snapshot = await readCenterLearnUnderstandSnapshot(filePath)
    const packets = buildLearnUnderstandImportPackets(snapshot)
    const learnPacket = packets.find((packet) => packet.producerId === 'learn')
    const understandPacket = packets.find((packet) => packet.producerId === 'understand')

    expect(snapshot.records).toHaveLength(6)
    expect(packets).toHaveLength(2)
    expect(learnPacket?.rawEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'learn.learning_gap.detected',
        'learn.practice_task.created',
        'learn.review_evidence.recorded',
      ])
    )
    expect(understandPacket?.rawEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'understand.system_map.generated',
        'understand.dependency_observed',
        'understand.risk_detected',
      ])
    )
    expect(learnPacket?.loops.at(0)).toMatchObject({
      title: 'Learn Cardiology',
      domain: 'learning',
      status: 'blocked',
      nextAction: 'Complete practice task: Complete 10 hemodynamics cards',
    })
    expect(understandPacket?.loops.at(0)).toMatchObject({
      title: 'Understand Center',
      domain: 'system-comprehension',
      status: 'blocked',
      nextAction: 'Review system risk: Producer fixture can drift from live API',
    })
  })
})
