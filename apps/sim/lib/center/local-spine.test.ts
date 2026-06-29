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
})
