/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { deriveCenterBaselinePrediction } from '@/lib/center/baseline-prediction'
import type { CenterDataset } from '@/lib/center/types'

const baseDataset: CenterDataset = {
  profiles: [],
  actors: [],
  rawEvents: [],
  evidence: [],
  observations: [],
  loops: [],
  decisions: [],
  recommendations: [],
  actionProposals: [],
  featureProjections: [],
  predictionSummaries: [],
  outcomes: [],
}

describe('deriveCenterBaselinePrediction', () => {
  it('stays insufficient with no evidence and emits deterministic feature refs', () => {
    const projection = deriveCenterBaselinePrediction(baseDataset, 'profile-1')

    expect(projection.prediction).toMatchObject({
      id: 'center:center-baseline-v1:profile-1:prediction:loop_drift',
      status: 'insufficient-data',
      confidence: 0,
      dataSufficiency: 'none',
      score: undefined,
      modelVersion: 'center-baseline-v1',
    })
    expect(projection.features.map((feature) => feature.featureName)).toEqual([
      'raw_event_count_30d',
      'observation_count_30d',
      'active_loop_count',
      'blocked_loop_count',
      'open_action_proposal_count',
      'evidence_count_30d',
      'study_completion_count_30d',
      'outcome_count',
    ])
    expect(projection.prediction.featureRefs).toEqual(
      projection.features.map((feature) => feature.id)
    )
  })

  it('creates a baseline prediction only after enough local signals exist', () => {
    const now = new Date().toISOString()
    const dataset: CenterDataset = {
      ...baseDataset,
      rawEvents: Array.from({ length: 5 }, (_, index) => ({
        id: `event-${index}`,
        profileId: 'profile-1',
        producerId: 'ms2scheduler',
        occurredAt: now,
        recordedAt: now,
        eventType: index === 0 ? 'study.completion' : 'manual.capture',
        subjectType: 'task',
        subjectId: `task-${index}`,
        payload: {},
        evidenceRefs: [],
      })),
      evidence: [
        {
          id: 'evidence-1',
          profileId: 'profile-1',
          subjectType: 'study-plan',
          subjectId: 'plan-1',
          kind: 'receipt',
          title: 'Plan receipt',
          createdAt: now,
        },
      ],
      observations: Array.from({ length: 3 }, (_, index) => ({
        id: `observation-${index}`,
        profileId: 'profile-1',
        producerId: 'center',
        observedAt: now,
        observationType: 'manual.summary',
        subjectType: 'task',
        subjectId: `task-${index}`,
        sourceEventRefs: [`event-${index}`],
        payload: {},
      })),
      loops: [
        {
          id: 'loop-1',
          profileId: 'profile-1',
          title: 'Blocked loop',
          domain: 'study',
          status: 'blocked',
          blockedBy: ['needs review'],
          evidenceRefs: [],
          updatedAt: now,
        },
      ],
      actionProposals: [
        {
          id: 'proposal-1',
          profileId: 'profile-1',
          actionType: 'ms2scheduler.review_recovery_candidate',
          targetType: 'study-plan',
          targetId: 'plan-1',
          payload: {},
          evidenceRefs: [],
          status: 'proposed',
          createdAt: now,
        },
      ],
    }

    const projection = deriveCenterBaselinePrediction(dataset, 'profile-1')

    expect(projection.prediction.status).toBe('baseline')
    expect(projection.prediction.confidence).toBe(0.45)
    expect(projection.prediction.dataSufficiency).toBe('medium')
    expect(projection.prediction.score).toBeGreaterThan(0)
    expect(projection.prediction.score).toBeLessThanOrEqual(1)
    expect(projection.prediction.drivers.map((driver) => driver.name)).toEqual(
      expect.arrayContaining([
        '1 blocked loop',
        '1 review proposal',
        '1 study completion',
        '1 evidence receipt',
      ])
    )
  })
})
