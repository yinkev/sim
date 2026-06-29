'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '@sim/utils/errors'
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  FileText,
  GitBranch,
  GitPullRequestArrow,
  Lightbulb,
  ListChecks,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { Button, ChipInput, ChipTag, ChipTextarea } from '@/components/emcn'
import { requestJson } from '@/lib/api/client/request'
import {
  importCenterGithubContract,
  importCenterReviewPacketsContract,
  importMs2SchedulerCenterContract,
} from '@/lib/api/contracts/center'
import {
  applyCenterProducerImport,
  applyCenterReviewPacketImport,
  type CenterActor,
  type CenterDataset,
  CenterLocalSpine,
  type CenterLoop,
  type CenterProfile,
  type CenterStorageAdapter,
  createBrowserCenterStorage,
  deriveCenterBaselinePrediction,
} from '@/lib/center'
import { cn } from '@/lib/core/utils/cn'

type CaptureMode = 'event' | 'loop' | 'evidence' | 'decision'

const EMPTY_CENTER_DATASET: CenterDataset = {
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
  reviewPackets: [],
}

const CAPTURE_MODES: Array<{ id: CaptureMode; label: string }> = [
  { id: 'event', label: 'Event' },
  { id: 'loop', label: 'Loop' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'decision', label: 'Decision' },
]

function createCenterStorage(): CenterStorageAdapter | null {
  if (typeof window === 'undefined') return null
  return createBrowserCenterStorage()
}

function profileDataset(dataset: CenterDataset, profileId: string | null): CenterDataset {
  if (!profileId) return EMPTY_CENTER_DATASET
  return {
    profiles: dataset.profiles.filter((profile) => profile.id === profileId),
    actors: dataset.actors.filter((actor) => actor.profileId === profileId),
    rawEvents: dataset.rawEvents.filter((event) => event.profileId === profileId),
    evidence: dataset.evidence.filter((evidence) => evidence.profileId === profileId),
    observations: dataset.observations.filter((observation) => observation.profileId === profileId),
    loops: dataset.loops.filter((loop) => loop.profileId === profileId),
    decisions: dataset.decisions.filter((decision) => decision.profileId === profileId),
    recommendations: dataset.recommendations.filter(
      (recommendation) => recommendation.profileId === profileId
    ),
    actionProposals: dataset.actionProposals.filter((proposal) => proposal.profileId === profileId),
    featureProjections: dataset.featureProjections.filter(
      (projection) => projection.profileId === profileId
    ),
    predictionSummaries: dataset.predictionSummaries.filter(
      (prediction) => prediction.profileId === profileId
    ),
    outcomes: dataset.outcomes.filter((outcome) => outcome.profileId === profileId),
    reviewPackets: dataset.reviewPackets.filter((packet) => packet.profileId === profileId),
  }
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function isToday(value: string): boolean {
  return new Date(value).toDateString() === new Date().toDateString()
}

function getLoopTone(status: CenterLoop['status']): string {
  if (status === 'blocked') return 'text-[var(--text-error)]'
  if (status === 'done') return 'text-[var(--text-success)]'
  return 'text-[var(--text-body)]'
}

function newestFirst<T>(items: T[], getDate: (item: T) => string): T[] {
  return [...items].sort((left, right) => getDate(right).localeCompare(getDate(left)))
}

function findHumanActor(dataset: CenterDataset, profileId: string): CenterActor | undefined {
  return dataset.actors.find((actor) => actor.profileId === profileId && actor.kind === 'human')
}

function Section({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string
  count?: number
  icon: typeof Activity
  children: React.ReactNode
}) {
  return (
    <section className='min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)]'>
      <div className='flex h-11 items-center justify-between border-[var(--border)] border-b px-4'>
        <div className='flex min-w-0 items-center gap-2'>
          <Icon className='size-[14px] flex-shrink-0 text-[var(--text-icon)]' />
          <h2 className='truncate font-medium text-[var(--text-body)] text-sm'>{title}</h2>
        </div>
        {typeof count === 'number' ? <ChipTag variant='gray'>{count}</ChipTag> : null}
      </div>
      <div className='p-3'>{children}</div>
    </section>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className='flex min-h-[92px] items-center justify-center rounded-[6px] border border-[var(--border)] border-dashed text-[var(--text-muted)] text-small'>
      {label}
    </div>
  )
}

function RecordRow({
  title,
  meta,
  detail,
  tone,
}: {
  title: string
  meta?: string
  detail?: string
  tone?: string
}) {
  return (
    <div className='rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2'>
      <div className='flex min-w-0 items-center justify-between gap-3'>
        <div className={cn('truncate font-medium text-sm', tone ?? 'text-[var(--text-body)]')}>
          {title}
        </div>
        {meta ? (
          <div className='flex-shrink-0 font-mono text-[11px] text-[var(--text-muted)]'>{meta}</div>
        ) : null}
      </div>
      {detail ? (
        <div className='mt-1 line-clamp-2 text-[var(--text-muted)] text-small'>{detail}</div>
      ) : null}
    </div>
  )
}

export function CenterSurface() {
  const [storage, setStorage] = useState<CenterStorageAdapter | null>(null)
  const [dataset, setDataset] = useState<CenterDataset>(EMPTY_CENTER_DATASET)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('event')
  const [profileName, setProfileName] = useState('Local profile')
  const [eventText, setEventText] = useState('')
  const [loopTitle, setLoopTitle] = useState('')
  const [loopNextAction, setLoopNextAction] = useState('')
  const [loopBlockedBy, setLoopBlockedBy] = useState('')
  const [evidenceTitle, setEvidenceTitle] = useState('')
  const [evidenceUri, setEvidenceUri] = useState('')
  const [decisionTitle, setDecisionTitle] = useState('')
  const [decisionText, setDecisionText] = useState('')
  const [decisionReason, setDecisionReason] = useState('')
  const [decisionConsequence, setDecisionConsequence] = useState('')
  const [decisionRevisitIf, setDecisionRevisitIf] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [githubImportSummary, setGithubImportSummary] = useState<string | null>(null)
  const [reviewImportSummary, setReviewImportSummary] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isImportingGithub, setIsImportingGithub] = useState(false)
  const [isImportingReviews, setIsImportingReviews] = useState(false)

  useEffect(() => {
    setStorage(createCenterStorage())
  }, [])

  const spine = useMemo(() => (storage ? new CenterLocalSpine(storage) : null), [storage])

  const reloadDataset = useCallback(
    async (nextProfileId?: string) => {
      if (!storage) return
      const nextDataset = await storage.load()
      setDataset(nextDataset)
      const preferredProfileId =
        nextProfileId ??
        selectedProfileId ??
        nextDataset.profiles.find((profile) => profile.status === 'active')?.id ??
        null
      setSelectedProfileId(preferredProfileId)
    },
    [selectedProfileId, storage]
  )

  useEffect(() => {
    void reloadDataset()
  }, [reloadDataset])

  const selectedProfile = useMemo(
    () => dataset.profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [dataset.profiles, selectedProfileId]
  )

  const scoped = useMemo(
    () => profileDataset(dataset, selectedProfileId),
    [dataset, selectedProfileId]
  )

  const activeLoops = useMemo(
    () => scoped.loops.filter((loop) => loop.status === 'active'),
    [scoped.loops]
  )
  const blockedLoops = useMemo(
    () => scoped.loops.filter((loop) => loop.status === 'blocked'),
    [scoped.loops]
  )
  const recentObservations = useMemo(
    () => newestFirst(scoped.observations, (observation) => observation.observedAt).slice(0, 5),
    [scoped.observations]
  )
  const recentEvidence = useMemo(
    () => newestFirst(scoped.evidence, (evidence) => evidence.createdAt).slice(0, 5),
    [scoped.evidence]
  )
  const engineeringObservations = useMemo(
    () =>
      newestFirst(
        scoped.observations.filter((observation) =>
          observation.observationType.startsWith('engineering.')
        ),
        (observation) => observation.observedAt
      ).slice(0, 5),
    [scoped.observations]
  )
  const todayEvents = useMemo(
    () =>
      newestFirst(
        scoped.rawEvents.filter((event) => isToday(event.occurredAt)),
        (event) => event.occurredAt
      ),
    [scoped.rawEvents]
  )
  const nextActions = useMemo(
    () => scoped.loops.filter((loop) => loop.nextAction && loop.status !== 'done').slice(0, 6),
    [scoped.loops]
  )
  const reviewDecisions = useMemo(
    () => scoped.decisions.filter((decision) => decision.status === 'active' && decision.revisitIf),
    [scoped.decisions]
  )
  const reviewActionProposals = useMemo(
    () => scoped.actionProposals.filter((proposal) => proposal.status === 'proposed'),
    [scoped.actionProposals]
  )
  const reviewPackets = useMemo(
    () =>
      [...scoped.reviewPackets].sort((left, right) => {
        const leftUpdated = left.updatedAt ?? left.createdAt ?? ''
        const rightUpdated = right.updatedAt ?? right.createdAt ?? ''
        return rightUpdated.localeCompare(leftUpdated)
      }),
    [scoped.reviewPackets]
  )
  const baselineProjection = useMemo(
    () => (selectedProfile ? deriveCenterBaselinePrediction(scoped, selectedProfile.id) : null),
    [scoped, selectedProfile]
  )
  const predictionState = baselineProjection?.prediction

  const ensureHumanActor = async (profile: CenterProfile): Promise<CenterActor> => {
    const existing = findHumanActor(dataset, profile.id)
    if (existing) return existing
    if (!spine) throw new Error('Center spine is not ready')
    const actor = await spine.createActor({
      profileId: profile.id,
      kind: 'human',
      displayName: profile.displayName,
    })
    await reloadDataset(profile.id)
    return actor
  }

  const createProfile = async () => {
    if (!spine) return
    const displayName = profileName.trim()
    if (!displayName) return
    setIsSaving(true)
    setError(null)
    try {
      const profile = await spine.createProfile({ displayName })
      await spine.createActor({ profileId: profile.id, kind: 'human', displayName })
      setProfileName('')
      await reloadDataset(profile.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create profile'))
    } finally {
      setIsSaving(false)
    }
  }

  const importMs2Scheduler = async () => {
    if (!storage || !selectedProfile) return
    setIsImporting(true)
    setError(null)
    setImportSummary(null)
    try {
      const response = await requestJson(importMs2SchedulerCenterContract, {})
      const summary = await applyCenterProducerImport(storage, selectedProfile.id, response.packet)
      await reloadDataset(selectedProfile.id)
      setImportSummary(
        `MS2 import: ${summary.evidenceAdded} evidence, ${summary.rawEventsAdded} events, ${summary.observationsAdded} observations, ${summary.loopsAdded} loops, ${summary.actionProposalsAdded} proposals.`
      )
    } catch (err) {
      setError(getErrorMessage(err, 'MS2Scheduler import failed'))
    } finally {
      setIsImporting(false)
    }
  }

  const importGithub = async () => {
    if (!storage || !selectedProfile) return
    setIsImportingGithub(true)
    setError(null)
    setGithubImportSummary(null)
    try {
      const response = await requestJson(importCenterGithubContract, {})
      const summary = await applyCenterProducerImport(storage, selectedProfile.id, response.packet)
      await reloadDataset(selectedProfile.id)
      setGithubImportSummary(
        `GitHub import: ${summary.evidenceAdded} evidence, ${summary.rawEventsAdded} events, ${summary.observationsAdded} observations, ${summary.loopsAdded} loops from ${response.source.recordCount} records.`
      )
    } catch (err) {
      setError(getErrorMessage(err, 'GitHub import failed'))
    } finally {
      setIsImportingGithub(false)
    }
  }

  const importReviewPackets = async () => {
    if (!storage || !selectedProfile) return
    setIsImportingReviews(true)
    setError(null)
    setReviewImportSummary(null)
    try {
      const response = await requestJson(importCenterReviewPacketsContract, {})
      const summary = await applyCenterReviewPacketImport(
        storage,
        selectedProfile.id,
        response.records
      )
      await reloadDataset(selectedProfile.id)
      setReviewImportSummary(
        `Review import: ${summary.reviewPacketsAdded} packets, ${summary.evidenceAdded} evidence.`
      )
    } catch (err) {
      setError(getErrorMessage(err, 'Review packet import failed'))
    } finally {
      setIsImportingReviews(false)
    }
  }

  const submitCapture = async () => {
    if (!spine || !selectedProfile) return
    setIsSaving(true)
    setError(null)
    try {
      const actor = await ensureHumanActor(selectedProfile)
      if (captureMode === 'event') {
        const text = eventText.trim()
        if (!text) return
        const rawEvent = await spine.appendRawEvent({
          profileId: selectedProfile.id,
          producerId: 'manual.capture',
          actorId: actor.id,
          eventType: 'manual.capture',
          subjectType: 'center.capture',
          subjectId: selectedProfile.id,
          payload: { text },
        })
        await spine.deriveObservation({
          profileId: selectedProfile.id,
          producerId: 'center.manual',
          actorId: actor.id,
          observationType: 'manual.summary',
          subjectType: 'center.capture',
          subjectId: rawEvent.id,
          sourceEventRefs: [rawEvent.id],
          payload: { summary: text },
        })
        setEventText('')
      } else if (captureMode === 'loop') {
        const title = loopTitle.trim()
        if (!title) return
        const blockedBy = loopBlockedBy.trim()
        await spine.createLoop({
          profileId: selectedProfile.id,
          title,
          domain: 'manual',
          status: blockedBy ? 'blocked' : 'active',
          nextAction: loopNextAction.trim() || undefined,
          blockedBy: blockedBy ? [blockedBy] : undefined,
        })
        setLoopTitle('')
        setLoopNextAction('')
        setLoopBlockedBy('')
      } else if (captureMode === 'evidence') {
        const title = evidenceTitle.trim()
        if (!title) return
        await spine.attachEvidence({
          profileId: selectedProfile.id,
          producerId: 'manual.capture',
          subjectType: 'center.profile',
          subjectId: selectedProfile.id,
          kind: 'note',
          title,
          uri: evidenceUri.trim() || undefined,
        })
        setEvidenceTitle('')
        setEvidenceUri('')
      } else {
        const title = decisionTitle.trim()
        const decision = decisionText.trim()
        const reason = decisionReason.trim()
        const consequence = decisionConsequence.trim()
        if (!title || !decision || !reason || !consequence) return
        await spine.recordDecision({
          profileId: selectedProfile.id,
          actorId: actor.id,
          title,
          decision,
          reason,
          consequence,
          revisitIf: decisionRevisitIf.trim() || undefined,
        })
        setDecisionTitle('')
        setDecisionText('')
        setDecisionReason('')
        setDecisionConsequence('')
        setDecisionRevisitIf('')
      }
      await reloadDataset(selectedProfile.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Center capture failed'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='flex h-full flex-col bg-[var(--bg)]'>
      <div className='border-[var(--border)] border-b px-5 py-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h1 className='font-medium text-[20px] text-[var(--text-body)]'>Center</h1>
              <ChipTag variant='gray' leftIcon={ShieldCheck}>
                telemetry off
              </ChipTag>
            </div>
            <div className='mt-1 truncate text-[var(--text-muted)] text-small'>
              {selectedProfile ? selectedProfile.displayName : 'No profile selected'}
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <ChipTag variant='mono'>{scoped.rawEvents.length} events</ChipTag>
            <ChipTag variant='mono'>{scoped.evidence.length} evidence</ChipTag>
            <ChipTag variant='mono'>{scoped.loops.length} loops</ChipTag>
            <ChipTag variant='mono'>{scoped.actionProposals.length} proposals</ChipTag>
            <ChipTag variant='mono'>{scoped.reviewPackets.length} reviews</ChipTag>
          </div>
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-gutter:stable_both-edges]'>
        <div className='mx-auto flex max-w-[96rem] flex-col gap-4'>
          <section className='flex flex-wrap items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] p-3'>
            {dataset.profiles
              .filter((profile) => profile.status === 'active')
              .map((profile) => (
                <Button
                  key={profile.id}
                  type='button'
                  variant={profile.id === selectedProfileId ? 'active' : 'default'}
                  onClick={() => setSelectedProfileId(profile.id)}
                >
                  {profile.displayName}
                </Button>
              ))}
            <div className='flex min-w-[260px] flex-1 items-center gap-2'>
              <ChipInput
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder='Profile name'
              />
              <Button type='button' variant='primary' disabled={isSaving} onClick={createProfile}>
                <Plus className='size-[14px]' />
                Create
              </Button>
              <Button
                type='button'
                disabled={!selectedProfile || isImporting}
                onClick={importMs2Scheduler}
              >
                Import MS2
              </Button>
              <Button
                type='button'
                disabled={!selectedProfile || isImportingGithub}
                onClick={importGithub}
              >
                Import GitHub
              </Button>
              <Button
                type='button'
                disabled={!selectedProfile || isImportingReviews}
                onClick={importReviewPackets}
              >
                Import Reviews
              </Button>
            </div>
          </section>

          {error ? (
            <div className='rounded-[8px] border border-[var(--text-error)] bg-[var(--badge-error-bg)] px-3 py-2 text-[var(--text-error)] text-sm'>
              {error}
            </div>
          ) : null}

          {importSummary ? (
            <div className='rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-[var(--text-muted)] text-sm'>
              {importSummary}
            </div>
          ) : null}

          {githubImportSummary ? (
            <div className='rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-[var(--text-muted)] text-sm'>
              {githubImportSummary}
            </div>
          ) : null}

          {reviewImportSummary ? (
            <div className='rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-[var(--text-muted)] text-sm'>
              {reviewImportSummary}
            </div>
          ) : null}

          <div className='grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]'>
            <div className='grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2'>
              <Section title='Today' count={todayEvents.length} icon={Activity}>
                <div className='flex flex-col gap-2'>
                  {todayEvents.length === 0 ? (
                    <EmptyState label='No events today' />
                  ) : (
                    todayEvents
                      .slice(0, 5)
                      .map((event) => (
                        <RecordRow
                          key={event.id}
                          title={String(event.payload.text ?? event.eventType)}
                          meta={formatTime(event.occurredAt)}
                          detail={event.eventType}
                        />
                      ))
                  )}
                </div>
              </Section>

              <Section title='Next Actions' count={nextActions.length} icon={ListChecks}>
                <div className='flex flex-col gap-2'>
                  {nextActions.length === 0 ? (
                    <EmptyState label='No next actions' />
                  ) : (
                    nextActions.map((loop) => (
                      <RecordRow
                        key={loop.id}
                        title={loop.nextAction ?? loop.title}
                        meta={loop.status}
                        detail={loop.title}
                        tone={getLoopTone(loop.status)}
                      />
                    ))
                  )}
                </div>
              </Section>

              <Section title='Active Loops' count={activeLoops.length} icon={CircleDot}>
                <div className='flex flex-col gap-2'>
                  {activeLoops.length === 0 ? (
                    <EmptyState label='No active loops' />
                  ) : (
                    activeLoops.map((loop) => (
                      <RecordRow
                        key={loop.id}
                        title={loop.title}
                        meta={formatDate(loop.updatedAt)}
                        detail={loop.nextAction}
                      />
                    ))
                  )}
                </div>
              </Section>

              <Section title='Blocked Loops' count={blockedLoops.length} icon={AlertTriangle}>
                <div className='flex flex-col gap-2'>
                  {blockedLoops.length === 0 ? (
                    <EmptyState label='No blocked loops' />
                  ) : (
                    blockedLoops.map((loop) => (
                      <RecordRow
                        key={loop.id}
                        title={loop.title}
                        meta='blocked'
                        detail={loop.blockedBy?.join(', ')}
                        tone='text-[var(--text-error)]'
                      />
                    ))
                  )}
                </div>
              </Section>

              <Section title='Engineering' count={engineeringObservations.length} icon={GitBranch}>
                <div className='flex flex-col gap-2'>
                  {engineeringObservations.length === 0 ? (
                    <EmptyState label='No engineering observations' />
                  ) : (
                    engineeringObservations.map((observation) => (
                      <RecordRow
                        key={observation.id}
                        title={String(observation.payload.summary ?? observation.observationType)}
                        meta={String(observation.payload.repo ?? observation.observationType)}
                        detail={String(observation.payload.url ?? observation.observationType)}
                        tone={
                          observation.observationType === 'engineering.ci_failed' ||
                          observation.observationType === 'engineering.review_blocking'
                            ? 'text-[var(--text-error)]'
                            : undefined
                        }
                      />
                    ))
                  )}
                </div>
              </Section>

              <Section
                title='Recent Observations'
                count={recentObservations.length}
                icon={Lightbulb}
              >
                <div className='flex flex-col gap-2'>
                  {recentObservations.length === 0 ? (
                    <EmptyState label='No observations' />
                  ) : (
                    recentObservations.map((observation) => (
                      <RecordRow
                        key={observation.id}
                        title={String(observation.payload.summary ?? observation.observationType)}
                        meta={formatTime(observation.observedAt)}
                        detail={observation.observationType}
                      />
                    ))
                  )}
                </div>
              </Section>

              <Section title='Evidence' count={recentEvidence.length} icon={Archive}>
                <div className='flex flex-col gap-2'>
                  {recentEvidence.length === 0 ? (
                    <EmptyState label='No evidence' />
                  ) : (
                    recentEvidence.map((evidence) => (
                      <RecordRow
                        key={evidence.id}
                        title={evidence.title}
                        meta={evidence.kind}
                        detail={evidence.uri}
                      />
                    ))
                  )}
                </div>
              </Section>

              <Section title='Prediction Summary' icon={GitPullRequestArrow}>
                {predictionState ? (
                  <div className='flex flex-col gap-2'>
                    <RecordRow
                      title={
                        predictionState.status === 'insufficient-data'
                          ? 'Insufficient data'
                          : 'Baseline loop drift'
                      }
                      meta={predictionState.dataSufficiency}
                      detail={`confidence ${Math.round(predictionState.confidence * 100)}% · model ${predictionState.modelVersion}`}
                    />
                    {predictionState.score === undefined ? null : (
                      <RecordRow
                        title={`Risk score ${Math.round(predictionState.score * 100)}%`}
                        detail='Baseline heuristic from visible Center features; not a calibrated probability.'
                      />
                    )}
                    {predictionState.drivers.length === 0 ? (
                      <RecordRow
                        title='No drivers yet'
                        detail='Capture events, observations, evidence, or outcomes before producing baseline drivers.'
                      />
                    ) : (
                      predictionState.drivers
                        .slice(0, 4)
                        .map((driver) => (
                          <RecordRow
                            key={`${driver.name}-${driver.direction}`}
                            title={driver.name}
                            meta={driver.direction}
                            detail={
                              driver.weight === undefined
                                ? undefined
                                : `weight ${Math.round(driver.weight * 100)}%`
                            }
                          />
                        ))
                    )}
                    <RecordRow
                      title={`${baselineProjection.features.length} feature refs`}
                      detail={baselineProjection.features
                        .slice(0, 3)
                        .map((feature) => `${feature.featureName}=${String(feature.value)}`)
                        .join(', ')}
                    />
                  </div>
                ) : (
                  <EmptyState label='Create a profile to compute predictions' />
                )}
              </Section>

              <Section
                title='Review Needed'
                count={reviewDecisions.length + reviewActionProposals.length}
                icon={ClipboardList}
              >
                <div className='flex flex-col gap-2'>
                  {reviewDecisions.length === 0 && reviewActionProposals.length === 0 ? (
                    <EmptyState label='No decisions need review' />
                  ) : (
                    <>
                      {reviewActionProposals.map((proposal) => {
                        const recommendation = scoped.recommendations.find(
                          (item) => item.id === proposal.recommendationId
                        )
                        return (
                          <RecordRow
                            key={proposal.id}
                            title={recommendation?.title ?? proposal.actionType}
                            meta='proposal'
                            detail={
                              recommendation?.reason ??
                              String(proposal.payload.candidateVersion ?? '')
                            }
                          />
                        )
                      })}
                      {reviewDecisions.map((decision) => (
                        <RecordRow
                          key={decision.id}
                          title={decision.title}
                          meta='decision'
                          detail={decision.revisitIf}
                        />
                      ))}
                    </>
                  )}
                </div>
              </Section>

              <Section title='Review Packets' count={reviewPackets.length} icon={ShieldCheck}>
                <div className='flex flex-col gap-2'>
                  {reviewPackets.length === 0 ? (
                    <EmptyState label='No review packets imported' />
                  ) : (
                    reviewPackets
                      .slice(0, 5)
                      .map((packet) => (
                        <RecordRow
                          key={packet.id}
                          title={packet.title}
                          meta={packet.workerGate}
                          detail={`round ${packet.round}/${packet.maxRounds} · ${packet.approvalState}`}
                          tone={
                            packet.workerGate === 'approved-for-execution'
                              ? 'text-[var(--text-success)]'
                              : undefined
                          }
                        />
                      ))
                  )}
                </div>
              </Section>
            </div>

            <aside className='min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)]'>
              <div className='flex h-11 items-center justify-between border-[var(--border)] border-b px-4'>
                <div className='flex items-center gap-2'>
                  <FileText className='size-[14px] text-[var(--text-icon)]' />
                  <h2 className='font-medium text-[var(--text-body)] text-sm'>Capture</h2>
                </div>
                <ChipTag variant='gray'>local</ChipTag>
              </div>
              <div className='flex flex-col gap-3 p-3'>
                <div className='grid grid-cols-4 gap-1'>
                  {CAPTURE_MODES.map((mode) => (
                    <Button
                      key={mode.id}
                      type='button'
                      variant={captureMode === mode.id ? 'active' : 'default'}
                      onClick={() => setCaptureMode(mode.id)}
                    >
                      {mode.label}
                    </Button>
                  ))}
                </div>

                {captureMode === 'event' ? (
                  <ChipTextarea
                    rows={6}
                    value={eventText}
                    onChange={(event) => setEventText(event.target.value)}
                    placeholder='What happened?'
                  />
                ) : null}

                {captureMode === 'loop' ? (
                  <div className='flex flex-col gap-2'>
                    <ChipInput
                      value={loopTitle}
                      onChange={(event) => setLoopTitle(event.target.value)}
                      placeholder='Loop title'
                    />
                    <ChipInput
                      value={loopNextAction}
                      onChange={(event) => setLoopNextAction(event.target.value)}
                      placeholder='Next action'
                    />
                    <ChipInput
                      value={loopBlockedBy}
                      onChange={(event) => setLoopBlockedBy(event.target.value)}
                      placeholder='Blocked by'
                    />
                  </div>
                ) : null}

                {captureMode === 'evidence' ? (
                  <div className='flex flex-col gap-2'>
                    <ChipInput
                      value={evidenceTitle}
                      onChange={(event) => setEvidenceTitle(event.target.value)}
                      placeholder='Evidence title'
                    />
                    <ChipInput
                      value={evidenceUri}
                      onChange={(event) => setEvidenceUri(event.target.value)}
                      placeholder='URI or path'
                    />
                  </div>
                ) : null}

                {captureMode === 'decision' ? (
                  <div className='flex flex-col gap-2'>
                    <ChipInput
                      value={decisionTitle}
                      onChange={(event) => setDecisionTitle(event.target.value)}
                      placeholder='Decision title'
                    />
                    <ChipTextarea
                      rows={3}
                      value={decisionText}
                      onChange={(event) => setDecisionText(event.target.value)}
                      placeholder='Decision'
                    />
                    <ChipTextarea
                      rows={3}
                      value={decisionReason}
                      onChange={(event) => setDecisionReason(event.target.value)}
                      placeholder='Reason'
                    />
                    <ChipTextarea
                      rows={3}
                      value={decisionConsequence}
                      onChange={(event) => setDecisionConsequence(event.target.value)}
                      placeholder='Consequence'
                    />
                    <ChipInput
                      value={decisionRevisitIf}
                      onChange={(event) => setDecisionRevisitIf(event.target.value)}
                      placeholder='Revisit if'
                    />
                  </div>
                ) : null}

                <Button
                  type='button'
                  variant='primary'
                  disabled={!selectedProfile || isSaving}
                  onClick={submitCapture}
                >
                  <CheckCircle2 className='size-[14px]' />
                  Save
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
