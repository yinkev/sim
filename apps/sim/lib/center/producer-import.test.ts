/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { CenterLocalSpine, createMemoryCenterStorage } from '@/lib/center/local-spine'
import type { CenterProducerImportPacket } from '@/lib/center/producer-import'
import { applyCenterProducerImport } from '@/lib/center/producer-import'

describe('applyCenterProducerImport', () => {
  it('imports producer packets idempotently by sourceRef', async () => {
    const storage = createMemoryCenterStorage()
    const spine = new CenterLocalSpine(storage)
    const profile = await spine.createProfile({ displayName: 'Kevin' })
    const packet: CenterProducerImportPacket = {
      producerId: 'ms2scheduler',
      producerDisplayName: 'MS2Scheduler',
      actor: { kind: 'scheduler', displayName: 'MS2Scheduler' },
      evidence: [
        {
          sourceRef: 'ms2:receipt:1',
          subjectType: 'study-plan',
          subjectId: 'plan-1',
          kind: 'receipt',
          title: 'Plan receipt',
        },
      ],
      rawEvents: [
        {
          sourceRef: 'ms2:event:1',
          occurredAt: '2026-01-01T00:00:00Z',
          eventType: 'study.start',
          subjectType: 'session',
          subjectId: 'task-1:2026-01-01',
          evidenceRefs: ['ms2:receipt:1'],
        },
      ],
      observations: [
        {
          sourceRef: 'ms2:observation:1',
          observationType: 'study.start',
          subjectType: 'session',
          subjectId: 'task-1:2026-01-01',
          sourceEventRefs: ['ms2:event:1'],
        },
      ],
      loops: [
        {
          sourceRef: 'ms2:loop:study',
          title: 'MS2Scheduler Study',
          domain: 'study',
          evidenceRefs: ['ms2:receipt:1'],
        },
      ],
      recommendations: [
        {
          sourceRef: 'ms2:recommendation:1',
          targetType: 'study-plan',
          targetId: 'plan-1',
          title: 'Review candidate',
          reason: 'Candidate needs review',
          evidenceRefs: ['ms2:receipt:1'],
        },
      ],
      actionProposals: [
        {
          sourceRef: 'ms2:action:1',
          recommendationRef: 'ms2:recommendation:1',
          actionType: 'ms2scheduler.review_recovery_candidate',
          targetType: 'study-plan',
          targetId: 'plan-1',
          evidenceRefs: ['ms2:receipt:1'],
        },
      ],
    }

    const first = await applyCenterProducerImport(storage, profile.id, packet)
    const second = await applyCenterProducerImport(storage, profile.id, packet)
    const exported = await spine.exportProfile(profile.id)

    expect(first).toMatchObject({
      evidenceAdded: 1,
      rawEventsAdded: 1,
      observationsAdded: 1,
      loopsAdded: 1,
      recommendationsAdded: 1,
      actionProposalsAdded: 1,
    })
    expect(second.skippedExisting).toBe(6)
    expect(exported.actors).toHaveLength(1)
    expect(exported.evidence).toHaveLength(1)
    expect(exported.rawEvents).toHaveLength(1)
    expect(exported.observations).toHaveLength(1)
    expect(exported.loops).toHaveLength(1)
    expect(exported.recommendations).toHaveLength(1)
    expect(exported.actionProposals).toHaveLength(1)
    expect(exported.actionProposals[0].recommendationId).toBe(exported.recommendations[0].id)
  })
})
