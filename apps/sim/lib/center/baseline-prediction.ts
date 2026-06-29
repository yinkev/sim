import type {
  CenterDataset,
  CenterFeatureProjection,
  CenterPredictionDriver,
  CenterPredictionSummary,
} from '@/lib/center/types'

export const CENTER_BASELINE_MODEL_VERSION = 'center-baseline-v1'

export interface CenterBaselinePredictionProjection {
  features: CenterFeatureProjection[]
  prediction: CenterPredictionSummary
}

const BASELINE_WINDOW = '30d'

export function deriveCenterBaselinePrediction(
  dataset: CenterDataset,
  profileId: string
): CenterBaselinePredictionProjection {
  const now = new Date().toISOString()
  const recentRawEvents = dataset.rawEvents.filter(
    (event) => event.profileId === profileId && isWithinWindow(event.occurredAt, 30)
  )
  const recentObservations = dataset.observations.filter(
    (observation) =>
      observation.profileId === profileId && isWithinWindow(observation.observedAt, 30)
  )
  const activeLoops = dataset.loops.filter(
    (loop) => loop.profileId === profileId && loop.status === 'active'
  )
  const blockedLoops = dataset.loops.filter(
    (loop) => loop.profileId === profileId && loop.status === 'blocked'
  )
  const openActionProposals = dataset.actionProposals.filter(
    (proposal) => proposal.profileId === profileId && proposal.status === 'proposed'
  )
  const recentEvidence = dataset.evidence.filter(
    (evidence) => evidence.profileId === profileId && isWithinWindow(evidence.createdAt, 30)
  )
  const studyCompletions = recentRawEvents.filter((event) => event.eventType === 'study.completion')
  const outcomes = dataset.outcomes.filter((outcome) => outcome.profileId === profileId)
  const sourceObservationRefs = recentObservations.map((observation) => observation.id)

  const featureValues = [
    ['raw_event_count_30d', recentRawEvents.length],
    ['observation_count_30d', recentObservations.length],
    ['active_loop_count', activeLoops.length],
    ['blocked_loop_count', blockedLoops.length],
    ['open_action_proposal_count', openActionProposals.length],
    ['evidence_count_30d', recentEvidence.length],
    ['study_completion_count_30d', studyCompletions.length],
    ['outcome_count', outcomes.length],
  ] as const

  const features = featureValues.map(([featureName, value]) => ({
    id: stableFeatureId(profileId, featureName),
    profileId,
    targetType: 'profile',
    targetId: profileId,
    featureName,
    value,
    window: featureName.endsWith('_30d') ? BASELINE_WINDOW : undefined,
    sourceObservationRefs,
    computedAt: now,
    version: CENTER_BASELINE_MODEL_VERSION,
  }))

  const dataSufficiency = getDataSufficiency({
    eventCount: recentRawEvents.length,
    observationCount: recentObservations.length,
    outcomeCount: outcomes.length,
  })
  const status =
    dataSufficiency === 'none' || dataSufficiency === 'low' ? 'insufficient-data' : 'baseline'
  const drivers = buildDrivers({
    blockedLoopCount: blockedLoops.length,
    openProposalCount: openActionProposals.length,
    studyCompletionCount: studyCompletions.length,
    evidenceCount: recentEvidence.length,
    outcomeCount: outcomes.length,
  })
  const confidence = getConfidence(dataSufficiency)
  const score = status === 'baseline' ? getBaselineRiskScore(drivers) : undefined

  return {
    features,
    prediction: {
      id: stablePredictionId(profileId),
      profileId,
      targetType: 'profile',
      targetId: profileId,
      predictionType: 'loop_drift',
      status,
      score,
      confidence,
      dataSufficiency,
      drivers,
      featureRefs: features.map((feature) => feature.id),
      generatedAt: now,
      modelVersion: CENTER_BASELINE_MODEL_VERSION,
    },
  }
}

function buildDrivers(input: {
  blockedLoopCount: number
  openProposalCount: number
  studyCompletionCount: number
  evidenceCount: number
  outcomeCount: number
}): CenterPredictionDriver[] {
  const drivers: CenterPredictionDriver[] = []

  if (input.blockedLoopCount > 0) {
    drivers.push({
      name: `${input.blockedLoopCount} blocked loop${input.blockedLoopCount === 1 ? '' : 's'}`,
      direction: 'up',
      weight: 0.35,
    })
  }
  if (input.openProposalCount > 0) {
    drivers.push({
      name: `${input.openProposalCount} review proposal${input.openProposalCount === 1 ? '' : 's'}`,
      direction: 'up',
      weight: 0.25,
    })
  }
  if (input.studyCompletionCount > 0) {
    drivers.push({
      name: `${input.studyCompletionCount} study completion${input.studyCompletionCount === 1 ? '' : 's'}`,
      direction: 'down',
      weight: 0.25,
    })
  }
  if (input.evidenceCount > 0) {
    drivers.push({
      name: `${input.evidenceCount} evidence receipt${input.evidenceCount === 1 ? '' : 's'}`,
      direction: 'down',
      weight: 0.15,
    })
  }
  if (input.outcomeCount === 0) {
    drivers.push({
      name: 'no closed outcomes yet',
      direction: 'up',
      weight: 0.1,
    })
  }

  return drivers
}

function getDataSufficiency(input: {
  eventCount: number
  observationCount: number
  outcomeCount: number
}): CenterPredictionSummary['dataSufficiency'] {
  if (input.eventCount === 0 && input.observationCount === 0) return 'none'
  if (input.observationCount < 3 && input.eventCount < 5) return 'low'
  if (input.observationCount >= 12 && input.eventCount >= 20 && input.outcomeCount >= 5) {
    return 'high'
  }
  return 'medium'
}

function getConfidence(dataSufficiency: CenterPredictionSummary['dataSufficiency']): number {
  if (dataSufficiency === 'none') return 0
  if (dataSufficiency === 'low') return 0.2
  if (dataSufficiency === 'medium') return 0.45
  return 0.65
}

function getBaselineRiskScore(drivers: CenterPredictionDriver[]): number {
  const risk = drivers.reduce((total, driver) => {
    const weight = driver.weight ?? 0
    return total + (driver.direction === 'up' ? weight : -weight)
  }, 0.5)
  return Math.max(0, Math.min(1, Number(risk.toFixed(2))))
}

function stableFeatureId(profileId: string, featureName: string): string {
  return `center:${CENTER_BASELINE_MODEL_VERSION}:${profileId}:feature:${featureName}`
}

function stablePredictionId(profileId: string): string {
  return `center:${CENTER_BASELINE_MODEL_VERSION}:${profileId}:prediction:loop_drift`
}

function isWithinWindow(value: string, days: number): boolean {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return false
  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000
}
