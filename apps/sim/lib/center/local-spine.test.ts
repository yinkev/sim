/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { CenterLocalSpine, createMemoryCenterStorage } from '@/lib/center/local-spine'

describe('CenterLocalSpine', () => {
  it('captures a profile-isolated execution loop with evidence and a decision', async () => {
    const spine = new CenterLocalSpine(createMemoryCenterStorage())
    const profile = await spine.createProfile({ displayName: 'Kevin' })
    const actor = await spine.createActor({
      profileId: profile.id,
      kind: 'human',
      displayName: 'Kevin',
    })
    const evidence = await spine.attachEvidence({
      profileId: profile.id,
      subjectType: 'study-session',
      subjectId: 'session-1',
      kind: 'receipt',
      title: 'MS2Scheduler receipt',
      payload: { cardsReviewed: 40 },
    })
    const rawEvent = await spine.appendRawEvent({
      profileId: profile.id,
      producerId: 'ms2scheduler',
      actorId: actor.id,
      eventType: 'study_activity',
      subjectType: 'study-session',
      subjectId: 'session-1',
      payload: { startedAt: '2026-06-28T20:00:00-07:00' },
      evidenceRefs: [evidence.id],
    })
    const observation = await spine.deriveObservation({
      profileId: profile.id,
      producerId: 'center',
      actorId: actor.id,
      observationType: 'study_started',
      subjectType: 'study-session',
      subjectId: 'session-1',
      sourceEventRefs: [rawEvent.id],
      payload: { lateByMinutes: 12 },
      confidence: 1,
    })
    const loop = await spine.createLoop({
      profileId: profile.id,
      title: 'Cardio review',
      domain: 'study',
      nextAction: 'Review missed concepts',
      evidenceRefs: [evidence.id],
    })
    const decision = await spine.recordDecision({
      profileId: profile.id,
      actorId: actor.id,
      title: 'Keep recovery proposal reviewable',
      decision: 'MS2Scheduler recovery proposals require review before execution',
      reason: 'Recovery changes affect study plan truth',
      consequence: 'Center stores proposals as action proposals before mutation',
      evidenceRefs: [evidence.id],
    })

    const exported = await spine.exportProfile(profile.id)

    expect(exported.profiles).toEqual([profile])
    expect(exported.actors).toEqual([actor])
    expect(exported.evidence).toEqual([evidence])
    expect(exported.rawEvents).toEqual([rawEvent])
    expect(exported.observations).toEqual([observation])
    expect(exported.loops).toEqual([loop])
    expect(exported.decisions).toEqual([decision])
  })

  it('deletes one profile without leaking or deleting another profile', async () => {
    const storage = createMemoryCenterStorage()
    const spine = new CenterLocalSpine(storage)
    const firstProfile = await spine.createProfile({ displayName: 'First' })
    const secondProfile = await spine.createProfile({ displayName: 'Second' })
    const secondActor = await spine.createActor({
      profileId: secondProfile.id,
      kind: 'human',
      displayName: 'Second',
    })

    await spine.appendRawEvent({
      profileId: firstProfile.id,
      producerId: 'manual',
      eventType: 'note',
      subjectType: 'loop',
      subjectId: 'first-loop',
    })
    const secondEvent = await spine.appendRawEvent({
      profileId: secondProfile.id,
      producerId: 'manual',
      actorId: secondActor.id,
      eventType: 'note',
      subjectType: 'loop',
      subjectId: 'second-loop',
    })

    await spine.deleteProfile(firstProfile.id)

    await expect(spine.exportProfile(firstProfile.id)).rejects.toThrow(
      `Center profile not found: ${firstProfile.id}`
    )
    expect(await spine.exportProfile(secondProfile.id)).toMatchObject({
      profiles: [secondProfile],
      actors: [secondActor],
      rawEvents: [secondEvent],
    })
  })

  it('rejects observations that cite missing or cross-profile source events', async () => {
    const spine = new CenterLocalSpine(createMemoryCenterStorage())
    const firstProfile = await spine.createProfile({ displayName: 'First' })
    const secondProfile = await spine.createProfile({ displayName: 'Second' })
    const secondEvent = await spine.appendRawEvent({
      profileId: secondProfile.id,
      producerId: 'manual',
      eventType: 'note',
      subjectType: 'loop',
      subjectId: 'second-loop',
    })

    await expect(
      spine.deriveObservation({
        profileId: firstProfile.id,
        producerId: 'center',
        observationType: 'invalid',
        subjectType: 'loop',
        subjectId: 'first-loop',
        sourceEventRefs: [],
      })
    ).rejects.toThrow('Center observation requires at least one source event')

    await expect(
      spine.deriveObservation({
        profileId: firstProfile.id,
        producerId: 'center',
        observationType: 'invalid',
        subjectType: 'loop',
        subjectId: 'first-loop',
        sourceEventRefs: [secondEvent.id],
      })
    ).rejects.toThrow(
      `Center raw event ${secondEvent.id} does not belong to profile ${firstProfile.id}`
    )
  })

  it('stores prediction features, summaries, and outcomes with profile-scoped refs', async () => {
    const spine = new CenterLocalSpine(createMemoryCenterStorage())
    const profile = await spine.createProfile({ displayName: 'Kevin' })
    const actor = await spine.createActor({
      profileId: profile.id,
      kind: 'human',
      displayName: 'Kevin',
    })
    const rawEvent = await spine.appendRawEvent({
      profileId: profile.id,
      producerId: 'manual',
      actorId: actor.id,
      eventType: 'manual.capture',
      subjectType: 'loop',
      subjectId: 'loop-1',
    })
    const observation = await spine.deriveObservation({
      profileId: profile.id,
      producerId: 'center',
      actorId: actor.id,
      observationType: 'manual.summary',
      subjectType: 'loop',
      subjectId: 'loop-1',
      sourceEventRefs: [rawEvent.id],
    })
    const evidence = await spine.attachEvidence({
      profileId: profile.id,
      producerId: 'manual',
      subjectType: 'prediction',
      subjectId: 'prediction-1',
      kind: 'receipt',
      title: 'Prediction review receipt',
    })
    const feature = await spine.createFeatureProjection({
      profileId: profile.id,
      targetType: 'profile',
      targetId: profile.id,
      featureName: 'observation_count_30d',
      value: 1,
      window: '30d',
      sourceObservationRefs: [observation.id],
      version: 'center-baseline-v1',
    })
    const prediction = await spine.createPredictionSummary({
      profileId: profile.id,
      targetType: 'profile',
      targetId: profile.id,
      predictionType: 'loop_drift',
      status: 'insufficient-data',
      confidence: 0.2,
      dataSufficiency: 'low',
      drivers: [{ name: 'no closed outcomes yet', direction: 'up', weight: 0.1 }],
      featureRefs: [feature.id],
      modelVersion: 'center-baseline-v1',
    })
    const outcome = await spine.recordOutcome({
      profileId: profile.id,
      subjectType: 'prediction',
      subjectId: prediction.id,
      outcomeType: 'reviewed',
      payload: { accepted: true },
      evidenceRefs: [evidence.id],
    })

    const exported = await spine.exportProfile(profile.id)

    expect(exported.featureProjections).toEqual([feature])
    expect(exported.predictionSummaries).toEqual([prediction])
    expect(exported.outcomes).toEqual([outcome])
  })

  it('stores review packets with evidence and decision refs', async () => {
    const spine = new CenterLocalSpine(createMemoryCenterStorage())
    const profile = await spine.createProfile({ displayName: 'Kevin' })
    const actor = await spine.createActor({
      profileId: profile.id,
      kind: 'human',
      displayName: 'Kevin',
    })
    const evidence = await spine.attachEvidence({
      profileId: profile.id,
      producerId: 'center-review',
      subjectType: 'review-packet',
      subjectId: 'RP-1',
      kind: 'source',
      title: 'Review source',
    })
    const decision = await spine.recordDecision({
      profileId: profile.id,
      actorId: actor.id,
      title: 'Approve packet',
      decision: 'Packet is approved for execution',
      reason: 'Governor converged',
      consequence: 'Workers may execute approved scope',
    })
    const packet = await spine.createReviewPacket({
      profileId: profile.id,
      packetId: 'RP-1',
      projectId: 'center',
      title: 'Review packet',
      status: 'converged',
      approvalState: 'approved-with-required-changes',
      workerGate: 'approved-for-execution',
      round: 2,
      maxRounds: 20,
      evidenceRefs: [evidence.id],
      decisionRefs: [decision.id],
      sourceRef: 'center-review:packet:RP-1',
    })

    const exported = await spine.exportProfile(profile.id)

    expect(exported.reviewPackets).toEqual([packet])
  })
})
