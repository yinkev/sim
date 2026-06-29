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
      capabilityIds: ['emit.ms2.study_activity'],
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

    const first = await applyCenterProducerImport(storage, profile.id, packet, {
      registeredCapabilityIds: ['emit.ms2.study_activity'],
    })
    const second = await applyCenterProducerImport(storage, profile.id, packet, {
      registeredCapabilityIds: ['emit.ms2.study_activity'],
    })
    const exported = await spine.exportProfile(profile.id)

    expect(first).toMatchObject({
      evidenceAdded: 1,
      rawEventsAdded: 1,
      observationsAdded: 1,
      loopsAdded: 1,
      recommendationsAdded: 1,
      actionProposalsAdded: 1,
      blockedUnknownCapabilityIds: [],
      observationsSkippedMissingEvents: 0,
      unresolvedEvidenceRefs: [],
      unresolvedSourceEventRefs: [],
      unresolvedRecommendationRefs: [],
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

  it('blocks unknown capabilities before mutating storage', async () => {
    const storage = createMemoryCenterStorage()
    const spine = new CenterLocalSpine(storage)
    const profile = await spine.createProfile({ displayName: 'Kevin' })
    const packet: CenterProducerImportPacket = {
      producerId: 'worker-lane',
      producerDisplayName: 'Worker Lane',
      capabilityIds: ['emit.agent_run_started', 'emit.agent_unregistered'],
      actor: { kind: 'agent', displayName: 'Worker Lane' },
      evidence: [],
      rawEvents: [
        {
          sourceRef: 'worker:event:1',
          occurredAt: '2026-01-01T00:00:00Z',
          eventType: 'agent.run.started',
          subjectType: 'agent-run',
          subjectId: 'run-1',
        },
      ],
      observations: [],
      loops: [],
      recommendations: [],
      actionProposals: [],
    }

    const summary = await applyCenterProducerImport(storage, profile.id, packet, {
      registeredCapabilityIds: ['emit.agent_run_started'],
    })
    const exported = await spine.exportProfile(profile.id)

    expect(summary).toMatchObject({
      blockedUnknownCapabilityIds: ['emit.agent_unregistered'],
      rawEventsAdded: 0,
      skippedExisting: 0,
    })
    expect(exported.actors).toHaveLength(0)
    expect(exported.rawEvents).toHaveLength(0)
  })

  it('reports unresolved producer references without silently treating them as success', async () => {
    const storage = createMemoryCenterStorage()
    const spine = new CenterLocalSpine(storage)
    const profile = await spine.createProfile({ displayName: 'Kevin' })
    const packet: CenterProducerImportPacket = {
      producerId: 'plane',
      producerDisplayName: 'Plane',
      capabilityIds: ['emit.plane_issue'],
      actor: { kind: 'integration', displayName: 'Plane' },
      evidence: [],
      rawEvents: [
        {
          sourceRef: 'plane:event:1',
          occurredAt: '2026-01-01T00:00:00Z',
          eventType: 'plane.issue.updated',
          subjectType: 'plane-issue',
          subjectId: 'issue-1',
          evidenceRefs: ['plane:evidence:missing'],
        },
      ],
      observations: [
        {
          sourceRef: 'plane:observation:1',
          observationType: 'plane.issue.changed',
          subjectType: 'plane-issue',
          subjectId: 'issue-1',
          sourceEventRefs: ['plane:event:missing'],
        },
      ],
      loops: [],
      recommendations: [],
      actionProposals: [
        {
          sourceRef: 'plane:action:1',
          recommendationRef: 'plane:recommendation:missing',
          actionType: 'plane.review_issue',
          targetType: 'plane-issue',
          targetId: 'issue-1',
        },
      ],
    }

    const summary = await applyCenterProducerImport(storage, profile.id, packet, {
      registeredCapabilityIds: ['emit.plane_issue'],
    })
    const exported = await spine.exportProfile(profile.id)

    expect(summary).toMatchObject({
      rawEventsAdded: 1,
      observationsAdded: 0,
      actionProposalsAdded: 1,
      observationsSkippedMissingEvents: 1,
      unresolvedEvidenceRefs: ['plane:evidence:missing'],
      unresolvedSourceEventRefs: ['plane:event:missing'],
      unresolvedRecommendationRefs: ['plane:recommendation:missing'],
    })
    expect(exported.rawEvents).toHaveLength(1)
    expect(exported.observations).toHaveLength(0)
    expect(exported.actionProposals).toHaveLength(1)
    expect(exported.actionProposals[0].recommendationId).toBeUndefined()
  })
})
