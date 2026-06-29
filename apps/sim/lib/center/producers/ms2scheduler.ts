import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CenterProducerImportPacket } from '@/lib/center/producer-import'

export const MS2SCHEDULER_PRODUCER_ID = 'ms2scheduler'
export const DEFAULT_MS2SCHEDULER_DATA_DIR = '/Users/kyin/Projects/MS2Scheduler/app/data'

interface Ms2Task {
  id: string
  resource_title?: string
  phase?: string
  priority?: string
  est_minutes?: number
}

interface Ms2Plan {
  version: string
  parent_version?: string | null
  created_at?: string
  cfg?: { today?: string }
  source?: Record<string, unknown>
  tasks?: Ms2Task[]
  result?: {
    assignments?: Array<{
      action?: string
      date?: string
      reason?: string
      task_id?: string
    }>
    deficit?: unknown
    finishes_on?: string
    horizon_end?: string
    inputs_hash?: string
    status?: string
  }
}

interface Ms2ActivityRow {
  recorded_at?: string
  plan_version?: string
  study_date?: string
  task_id?: string
  event?: 'start' | 'pause' | 'resume' | 'end'
}

interface Ms2CompletionRow {
  recorded_at?: string
  plan_version?: string
  study_date?: string
  task_id?: string
  outcome?: string
  actual_minutes?: number
}

interface Ms2DataSnapshot {
  dataDir: string
  currentVersion: string | null
  currentPlan: Ms2Plan | null
  candidatePlans: Ms2Plan[]
  activityRows: Ms2ActivityRow[]
  completionRows: Ms2CompletionRow[]
  calibrationState: Record<string, unknown> | null
}

const ACTIVITY_EVENT_TYPES = {
  start: 'study.start',
  pause: 'study.pause',
  resume: 'study.resume',
  end: 'study.end',
} as const

export async function readMs2SchedulerSnapshot(
  dataDir = process.env.MS2SCHEDULER_DATA_DIR || DEFAULT_MS2SCHEDULER_DATA_DIR
): Promise<Ms2DataSnapshot> {
  const currentVersion = await readOptionalText(path.join(dataDir, 'current'))
  const planDir = path.join(dataDir, 'plans')
  const planFiles = await readdir(planDir).catch(() => [])
  const plans = await Promise.all(
    planFiles
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => readJson<Ms2Plan>(path.join(planDir, file)))
  )
  const currentPlan = plans.find((plan) => plan.version === currentVersion) ?? plans[0] ?? null

  return {
    dataDir,
    currentVersion: currentPlan?.version ?? currentVersion,
    currentPlan,
    candidatePlans: currentPlan
      ? plans.filter(
          (plan) =>
            plan.version !== currentPlan.version && plan.parent_version === currentPlan.version
        )
      : [],
    activityRows: await readJsonl<Ms2ActivityRow>(path.join(dataDir, 'activity.jsonl')),
    completionRows: await readJsonl<Ms2CompletionRow>(path.join(dataDir, 'completion.jsonl')),
    calibrationState: await readOptionalJson<Record<string, unknown>>(
      path.join(dataDir, 'calibration_state.json')
    ),
  }
}

export function buildMs2SchedulerImportPacket(
  snapshot: Ms2DataSnapshot
): CenterProducerImportPacket {
  const packet: CenterProducerImportPacket = {
    producerId: MS2SCHEDULER_PRODUCER_ID,
    producerDisplayName: 'MS2Scheduler',
    actor: {
      kind: 'scheduler',
      displayName: 'MS2Scheduler',
    },
    evidence: [],
    rawEvents: [],
    observations: [],
    loops: [],
    recommendations: [],
    actionProposals: [],
  }

  const currentPlan = snapshot.currentPlan
  if (!currentPlan) return packet

  const taskById = new Map((currentPlan.tasks ?? []).map((task) => [task.id, task]))
  const currentPlanEvidenceRef = planEvidenceRef(currentPlan.version)
  packet.evidence.push(planEvidence(snapshot, currentPlan, true))
  packet.rawEvents.push({
    sourceRef: `ms2:plan:${currentPlan.version}:current`,
    occurredAt: currentPlan.created_at ?? new Date().toISOString(),
    eventType: 'study.plan.current',
    subjectType: 'study-plan',
    subjectId: planSubjectId(currentPlan.version),
    evidenceRefs: [currentPlanEvidenceRef],
    payload: planPayload(currentPlan, true),
  })

  const nextAssignment = selectNextAssignment(currentPlan)
  packet.loops.push({
    sourceRef: `ms2:loop:study:${currentPlan.version}`,
    title: 'MS2Scheduler Study',
    domain: 'study',
    status: currentPlan.result?.status === 'feasible' ? 'active' : 'blocked',
    nextAction: nextAssignment ? nextActionLabel(nextAssignment, taskById) : undefined,
    blockedBy:
      currentPlan.result?.status === 'feasible'
        ? undefined
        : ['MS2Scheduler reports infeasible plan'],
    evidenceRefs: [currentPlanEvidenceRef],
  })

  addActivityRecords(packet, snapshot, taskById)
  addCompletionRecords(packet, snapshot, taskById)
  addCalibrationEvidence(packet, snapshot)
  addRecoveryCandidates(packet, snapshot)

  return packet
}

function addActivityRecords(
  packet: CenterProducerImportPacket,
  snapshot: Ms2DataSnapshot,
  taskById: Map<string, Ms2Task>
) {
  if (snapshot.activityRows.length > 0) {
    packet.evidence.push({
      sourceRef: 'ms2:activity-log',
      subjectType: 'study-activity-log',
      subjectId: 'ms2:activity-log',
      kind: 'log',
      title: 'MS2Scheduler activity log',
      uri: path.join(snapshot.dataDir, 'activity.jsonl'),
      payload: { rowCount: snapshot.activityRows.length },
    })
  }

  for (const row of snapshot.activityRows) {
    if (!row.task_id || !row.study_date || !row.recorded_at || !row.event) continue
    const eventType = ACTIVITY_EVENT_TYPES[row.event]
    if (!eventType) continue
    const task = taskById.get(row.task_id)
    const sourceRef = `ms2:activity:${row.recorded_at}:${row.task_id}:${row.event}`
    const subjectId = `${row.task_id}:${row.study_date}`
    packet.rawEvents.push({
      sourceRef,
      occurredAt: row.recorded_at,
      eventType,
      subjectType: 'session',
      subjectId,
      evidenceRefs: ['ms2:activity-log'],
      payload: {
        taskId: row.task_id,
        studyDate: row.study_date,
        planVersion: row.plan_version,
        resourceTitle: task?.resource_title,
        event: row.event,
      },
    })
    packet.observations.push({
      sourceRef: `${sourceRef}:observation`,
      observedAt: row.recorded_at,
      observationType: eventType,
      subjectType: 'session',
      subjectId,
      sourceEventRefs: [sourceRef],
      confidence: 1,
      payload: {
        taskId: row.task_id,
        studyDate: row.study_date,
        resourceTitle: task?.resource_title,
      },
    })
  }
}

function addCompletionRecords(
  packet: CenterProducerImportPacket,
  snapshot: Ms2DataSnapshot,
  taskById: Map<string, Ms2Task>
) {
  if (snapshot.completionRows.length > 0) {
    packet.evidence.push({
      sourceRef: 'ms2:completion-log',
      subjectType: 'study-completion-log',
      subjectId: 'ms2:completion-log',
      kind: 'receipt',
      title: 'MS2Scheduler completion log',
      uri: path.join(snapshot.dataDir, 'completion.jsonl'),
      payload: { rowCount: snapshot.completionRows.length },
    })
  }

  for (const row of snapshot.completionRows) {
    if (!row.task_id || !row.study_date || !row.recorded_at || !row.outcome) continue
    const task = taskById.get(row.task_id)
    const sourceRef = `ms2:completion:${row.recorded_at}:${row.task_id}:${row.outcome}`
    packet.rawEvents.push({
      sourceRef,
      occurredAt: row.recorded_at,
      eventType: 'study.completion',
      subjectType: 'task',
      subjectId: row.task_id,
      evidenceRefs: ['ms2:completion-log'],
      payload: {
        taskId: row.task_id,
        studyDate: row.study_date,
        planVersion: row.plan_version,
        resourceTitle: task?.resource_title,
        outcome: row.outcome,
        actualMinutes: row.actual_minutes,
      },
    })
    packet.observations.push({
      sourceRef: `${sourceRef}:observation`,
      observedAt: row.recorded_at,
      observationType:
        typeof row.actual_minutes === 'number' ? 'study.estimate_calibrated' : 'study.completed',
      subjectType: 'task',
      subjectId: row.task_id,
      sourceEventRefs: [sourceRef],
      confidence: typeof row.actual_minutes === 'number' ? 0.9 : 0.75,
      payload: {
        taskId: row.task_id,
        resourceTitle: task?.resource_title,
        outcome: row.outcome,
        actualMinutes: row.actual_minutes,
      },
    })
  }
}

function addCalibrationEvidence(packet: CenterProducerImportPacket, snapshot: Ms2DataSnapshot) {
  if (!snapshot.calibrationState) return
  packet.evidence.push({
    sourceRef: 'ms2:calibration-state',
    subjectType: 'study-calibration',
    subjectId: 'ms2:calibration-state',
    kind: 'receipt',
    title: 'MS2Scheduler calibration state',
    uri: path.join(snapshot.dataDir, 'calibration_state.json'),
    payload: {
      resourceCount: Object.keys(snapshot.calibrationState).length,
    },
  })
}

function addRecoveryCandidates(packet: CenterProducerImportPacket, snapshot: Ms2DataSnapshot) {
  for (const plan of snapshot.candidatePlans) {
    const evidenceRef = planEvidenceRef(plan.version)
    packet.evidence.push(planEvidence(snapshot, plan, false))
    const recommendationRef = `ms2:recovery:${plan.version}:recommendation`
    packet.recommendations.push({
      sourceRef: recommendationRef,
      targetType: 'study-plan',
      targetId: planSubjectId(snapshot.currentVersion ?? 'current'),
      title: `Review MS2Scheduler recovery candidate ${plan.version}`,
      reason: recoveryReason(plan),
      evidenceRefs: [evidenceRef],
    })
    packet.actionProposals.push({
      sourceRef: `ms2:recovery:${plan.version}:action`,
      recommendationRef,
      actionType: 'ms2scheduler.review_recovery_candidate',
      targetType: 'study-plan',
      targetId: planSubjectId(snapshot.currentVersion ?? 'current'),
      evidenceRefs: [evidenceRef],
      payload: {
        candidateVersion: plan.version,
        parentVersion: plan.parent_version,
        status: plan.result?.status,
        inputsHash: plan.result?.inputs_hash,
        assignmentCount: plan.result?.assignments?.length ?? 0,
        deficit: plan.result?.deficit ?? null,
      },
    })
  }
}

function planEvidence(snapshot: Ms2DataSnapshot, plan: Ms2Plan, current: boolean) {
  return {
    sourceRef: planEvidenceRef(plan.version),
    subjectType: 'study-plan',
    subjectId: planSubjectId(plan.version),
    kind: 'receipt' as const,
    title: current
      ? `MS2Scheduler current plan ${plan.version}`
      : `MS2Scheduler recovery candidate ${plan.version}`,
    uri: path.join(snapshot.dataDir, 'plans', `${plan.version}.json`),
    payload: planPayload(plan, current),
  }
}

function planPayload(plan: Ms2Plan, current: boolean): Record<string, unknown> {
  return {
    version: plan.version,
    parentVersion: plan.parent_version,
    current,
    status: plan.result?.status,
    inputsHash: plan.result?.inputs_hash,
    finishesOn: plan.result?.finishes_on,
    horizonEnd: plan.result?.horizon_end,
    assignmentCount: plan.result?.assignments?.length ?? 0,
    taskCount: plan.tasks?.length ?? 0,
    source: plan.source,
  }
}

function selectNextAssignment(plan: Ms2Plan) {
  const today = plan.cfg?.today
  const assignments = (plan.result?.assignments ?? [])
    .filter((assignment) => assignment.action === 'place' && assignment.task_id)
    .sort((left, right) => {
      const leftDate = left.date ?? ''
      const rightDate = right.date ?? ''
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate)
      return String(left.task_id).localeCompare(String(right.task_id))
    })
  return (
    assignments.find((assignment) => !today || String(assignment.date) >= today) ?? assignments[0]
  )
}

function nextActionLabel(
  assignment: NonNullable<ReturnType<typeof selectNextAssignment>>,
  taskById: Map<string, Ms2Task>
): string {
  const task = assignment.task_id ? taskById.get(assignment.task_id) : undefined
  const title = task?.resource_title ?? assignment.task_id ?? 'scheduled study task'
  return assignment.date ? `${title} on ${assignment.date}` : title
}

function recoveryReason(plan: Ms2Plan): string {
  const status = plan.result?.status ?? 'unknown'
  const assignmentCount = plan.result?.assignments?.length ?? 0
  return `MS2Scheduler generated candidate ${plan.version} from ${plan.parent_version ?? 'unknown parent'} with ${status} status and ${assignmentCount} assignments.`
}

function planEvidenceRef(version: string): string {
  return `ms2:plan:${version}:receipt`
}

function planSubjectId(version: string): string {
  return `ms2:plan:${version}`
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function readOptionalJson<T>(filePath: string): Promise<T | null> {
  try {
    return await readJson<T>(filePath)
  } catch {
    return null
  }
}

async function readOptionalText(filePath: string): Promise<string | null> {
  try {
    return (await readFile(filePath, 'utf8')).trim()
  } catch {
    return null
  }
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const text = await readOptionalText(filePath)
  if (!text) return []
  const rows: T[] = []
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  for (let index = 0; index < lines.length; index++) {
    try {
      rows.push(JSON.parse(lines[index]) as T)
    } catch (error) {
      if (index === lines.length - 1) continue
      throw error
    }
  }
  return rows
}
