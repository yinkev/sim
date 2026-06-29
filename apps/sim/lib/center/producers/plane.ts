import { filterUndefined } from '@sim/utils/object'
import type { CenterProducerImportPacket } from '@/lib/center/producer-import'

export const PLANE_PRODUCER_ID = 'plane'

export type CenterPlaneRecord =
  | CenterPlaneProjectRecord
  | CenterPlaneCycleRecord
  | CenterPlaneModuleRecord
  | CenterPlaneIssueRecord
  | CenterPlaneCommentRecord
  | CenterPlaneStatusRecord

export interface CenterPlaneSnapshot {
  sourcePath: string
  records: CenterPlaneRecord[]
}

export interface CenterPlaneProjectRecord {
  kind: 'project'
  workspace: string
  projectId: string
  name: string
  status: string
  updatedAt: string
  lead?: string
  url?: string
}

export interface CenterPlaneCycleRecord {
  kind: 'cycle'
  workspace: string
  projectId: string
  cycleId: string
  name: string
  status: string
  updatedAt: string
  startsAt?: string
  endsAt?: string
  url?: string
}

export interface CenterPlaneModuleRecord {
  kind: 'module'
  workspace: string
  projectId: string
  moduleId: string
  name: string
  status: string
  updatedAt: string
  owner?: string
  url?: string
}

export interface CenterPlaneIssueRecord {
  kind: 'issue'
  workspace: string
  projectId: string
  issueId: string
  title: string
  status: string
  updatedAt: string
  assignee?: string
  cycleId?: string
  dueAt?: string
  moduleId?: string
  priority?: string
  sequenceId?: string
  url?: string
}

export interface CenterPlaneCommentRecord {
  kind: 'comment'
  workspace: string
  projectId: string
  issueId: string
  commentId: string
  body: string
  createdAt: string
  author?: string
  url?: string
}

export interface CenterPlaneStatusRecord {
  kind: 'status'
  workspace: string
  projectId: string
  issueId: string
  toStatus: string
  changedAt: string
  actor?: string
  fromStatus?: string
  sequenceId?: string
  title?: string
  url?: string
}

type PacketObservation = CenterProducerImportPacket['observations'][number]

interface ProjectProjection {
  workspace: string
  projectId: string
  projectName?: string
  status?: string
  evidenceRefs: Set<string>
  blockers: string[]
  nextAction?: string
}

export function buildPlaneImportPacket(snapshot: CenterPlaneSnapshot): CenterProducerImportPacket {
  const packet: CenterProducerImportPacket = {
    producerId: PLANE_PRODUCER_ID,
    producerDisplayName: 'Plane',
    actor: {
      kind: 'integration',
      displayName: 'Plane',
    },
    evidence: [],
    rawEvents: [],
    observations: [],
    loops: [],
    recommendations: [],
    actionProposals: [],
  }
  const projects = new Map<string, ProjectProjection>()

  for (const record of snapshot.records) {
    const project = ensureProject(projects, record.workspace, record.projectId)
    if (record.kind === 'project') {
      addProject(packet, project, record)
    } else if (record.kind === 'cycle') {
      addCycle(packet, project, record)
    } else if (record.kind === 'module') {
      addModule(packet, project, record)
    } else if (record.kind === 'issue') {
      addIssue(packet, project, record)
    } else if (record.kind === 'comment') {
      addComment(packet, project, record)
    } else {
      addStatus(packet, project, record)
    }
  }

  for (const project of [...projects.values()].sort((left, right) =>
    projectKey(left.workspace, left.projectId).localeCompare(
      projectKey(right.workspace, right.projectId)
    )
  )) {
    packet.loops.push({
      sourceRef: `plane:loop:${project.workspace}:${project.projectId}`,
      title: `Plane ${project.projectName ?? project.projectId}`,
      domain: 'project',
      status: getLoopStatus(project),
      nextAction: project.nextAction,
      blockedBy: project.blockers.length > 0 ? project.blockers : undefined,
      evidenceRefs: [...project.evidenceRefs].slice(0, 10),
    })
  }

  return packet
}

function addProject(
  packet: CenterProducerImportPacket,
  project: ProjectProjection,
  record: CenterPlaneProjectRecord
) {
  project.projectName = record.name
  project.status = record.status
  const subjectId = planeProjectSubjectId(record)
  const evidenceRef = `plane:project:${subjectId}:${record.updatedAt}:evidence`
  const eventRef = `plane:project:${subjectId}:${record.updatedAt}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'plane-project',
    subjectId,
    kind: 'source',
    title: `Plane project ${record.name}`,
    uri: record.url,
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      status: record.status,
      lead: record.lead,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.updatedAt,
    eventType: 'plane.project.updated',
    subjectType: 'plane-project',
    subjectId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      name: record.name,
      status: record.status,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.updatedAt,
      observationType: `planning.project_${statusSignal(record.status)}`,
      subjectType: 'plane-project',
      subjectId,
      sourceEventRefs: [eventRef],
      payload: payload({
        workspace: record.workspace,
        projectId: record.projectId,
        projectName: record.name,
        summary: `Project ${record.name} is ${record.status}`,
        status: record.status,
        url: record.url,
      }),
    })
  )
  project.evidenceRefs.add(evidenceRef)
}

function addCycle(
  packet: CenterProducerImportPacket,
  project: ProjectProjection,
  record: CenterPlaneCycleRecord
) {
  const subjectId = `${planeProjectSubjectId(record)}/cycle/${record.cycleId}`
  const evidenceRef = `plane:cycle:${subjectId}:${record.updatedAt}:evidence`
  const eventRef = `plane:cycle:${subjectId}:${record.updatedAt}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'plane-cycle',
    subjectId,
    kind: 'source',
    title: `Plane cycle ${record.name}`,
    uri: record.url,
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      cycleId: record.cycleId,
      status: record.status,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.updatedAt,
    eventType: 'plane.cycle.updated',
    subjectType: 'plane-cycle',
    subjectId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      cycleId: record.cycleId,
      name: record.name,
      status: record.status,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.updatedAt,
      observationType: `planning.cycle_${statusSignal(record.status)}`,
      subjectType: 'plane-cycle',
      subjectId,
      sourceEventRefs: [eventRef],
      payload: payload({
        workspace: record.workspace,
        projectId: record.projectId,
        summary: `Cycle ${record.name} is ${record.status}`,
        status: record.status,
        url: record.url,
      }),
    })
  )
  project.evidenceRefs.add(evidenceRef)
}

function addModule(
  packet: CenterProducerImportPacket,
  project: ProjectProjection,
  record: CenterPlaneModuleRecord
) {
  const subjectId = `${planeProjectSubjectId(record)}/module/${record.moduleId}`
  const evidenceRef = `plane:module:${subjectId}:${record.updatedAt}:evidence`
  const eventRef = `plane:module:${subjectId}:${record.updatedAt}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'plane-module',
    subjectId,
    kind: 'source',
    title: `Plane module ${record.name}`,
    uri: record.url,
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      moduleId: record.moduleId,
      status: record.status,
      owner: record.owner,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.updatedAt,
    eventType: 'plane.module.updated',
    subjectType: 'plane-module',
    subjectId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      moduleId: record.moduleId,
      name: record.name,
      status: record.status,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.updatedAt,
      observationType: `planning.module_${statusSignal(record.status)}`,
      subjectType: 'plane-module',
      subjectId,
      sourceEventRefs: [eventRef],
      payload: payload({
        workspace: record.workspace,
        projectId: record.projectId,
        summary: `Module ${record.name} is ${record.status}`,
        status: record.status,
        url: record.url,
      }),
    })
  )
  project.evidenceRefs.add(evidenceRef)
}

function addIssue(
  packet: CenterProducerImportPacket,
  project: ProjectProjection,
  record: CenterPlaneIssueRecord
) {
  const subjectId = planeIssueSubjectId(record)
  const evidenceRef = `plane:issue:${subjectId}:${record.updatedAt}:evidence`
  const eventRef = `plane:issue:${subjectId}:${record.updatedAt}`
  const label = issueLabel(record)
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'plane-issue',
    subjectId,
    kind: 'source',
    title: `Plane issue ${label} - ${record.title}`,
    uri: record.url,
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      issueId: record.issueId,
      sequenceId: record.sequenceId,
      status: record.status,
      priority: record.priority,
      assignee: record.assignee,
      cycleId: record.cycleId,
      moduleId: record.moduleId,
      dueAt: record.dueAt,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.updatedAt,
    eventType: 'plane.issue.updated',
    subjectType: 'plane-issue',
    subjectId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      issueId: record.issueId,
      sequenceId: record.sequenceId,
      title: record.title,
      status: record.status,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.updatedAt,
      observationType: `planning.issue_${statusSignal(record.status)}`,
      subjectType: 'plane-issue',
      subjectId,
      sourceEventRefs: [eventRef],
      payload: payload({
        workspace: record.workspace,
        projectId: record.projectId,
        summary: `Issue ${label} is ${record.status}: ${record.title}`,
        title: record.title,
        status: record.status,
        priority: record.priority,
        assignee: record.assignee,
        url: record.url,
      }),
    })
  )
  project.evidenceRefs.add(evidenceRef)
  if (isBlockedStatus(record.status)) {
    addBlocker(project, `Plane issue ${label} is blocked`)
    project.nextAction = `Unblock Plane issue ${label}: ${record.title}`
  } else if (!isDoneStatus(record.status) && !project.nextAction) {
    project.nextAction = `Advance Plane issue ${label}: ${record.title}`
  }
}

function addComment(
  packet: CenterProducerImportPacket,
  project: ProjectProjection,
  record: CenterPlaneCommentRecord
) {
  const subjectId = `${planeIssueSubjectId(record)}/comment/${record.commentId}`
  const evidenceRef = `plane:comment:${subjectId}:evidence`
  const eventRef = `plane:comment:${subjectId}`
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'plane-comment',
    subjectId,
    kind: 'note',
    title: `Plane comment ${record.commentId}`,
    uri: record.url,
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      issueId: record.issueId,
      commentId: record.commentId,
      author: record.author,
      body: record.body,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.createdAt,
    eventType: 'plane.comment.created',
    subjectType: 'plane-comment',
    subjectId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      issueId: record.issueId,
      commentId: record.commentId,
      author: record.author,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.createdAt,
      observationType: 'planning.comment_added',
      subjectType: 'plane-issue',
      subjectId: planeIssueSubjectId(record),
      sourceEventRefs: [eventRef],
      payload: payload({
        workspace: record.workspace,
        projectId: record.projectId,
        summary: `Comment added on Plane issue ${record.issueId}`,
        author: record.author,
        url: record.url,
      }),
    })
  )
  project.evidenceRefs.add(evidenceRef)
}

function addStatus(
  packet: CenterProducerImportPacket,
  project: ProjectProjection,
  record: CenterPlaneStatusRecord
) {
  const subjectId = `${planeIssueSubjectId(record)}/status/${record.changedAt}`
  const evidenceRef = `plane:status:${subjectId}:evidence`
  const eventRef = `plane:status:${subjectId}`
  const label = record.sequenceId ?? record.issueId
  packet.evidence.push({
    sourceRef: evidenceRef,
    subjectType: 'plane-status',
    subjectId,
    kind: 'receipt',
    title: `Plane status ${label} -> ${record.toStatus}`,
    uri: record.url,
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      issueId: record.issueId,
      sequenceId: record.sequenceId,
      fromStatus: record.fromStatus,
      toStatus: record.toStatus,
      actor: record.actor,
    }),
  })
  packet.rawEvents.push({
    sourceRef: eventRef,
    occurredAt: record.changedAt,
    eventType: 'plane.issue.status_changed',
    subjectType: 'plane-status',
    subjectId,
    evidenceRefs: [evidenceRef],
    payload: payload({
      workspace: record.workspace,
      projectId: record.projectId,
      issueId: record.issueId,
      sequenceId: record.sequenceId,
      fromStatus: record.fromStatus,
      toStatus: record.toStatus,
      actor: record.actor,
      url: record.url,
    }),
  })
  packet.observations.push(
    observation({
      sourceRef: `${eventRef}:observation`,
      observedAt: record.changedAt,
      observationType: `planning.status_${statusSignal(record.toStatus)}`,
      subjectType: 'plane-issue',
      subjectId: planeIssueSubjectId(record),
      sourceEventRefs: [eventRef],
      payload: payload({
        workspace: record.workspace,
        projectId: record.projectId,
        summary: `Plane issue ${label} moved to ${record.toStatus}`,
        title: record.title,
        fromStatus: record.fromStatus,
        toStatus: record.toStatus,
        actor: record.actor,
        url: record.url,
      }),
    })
  )
  project.evidenceRefs.add(evidenceRef)
  if (isBlockedStatus(record.toStatus)) {
    addBlocker(project, `Plane issue ${label} moved to blocked`)
    if (record.title) project.nextAction = `Unblock Plane issue ${label}: ${record.title}`
  }
}

function observation(item: PacketObservation): PacketObservation {
  return { confidence: 1, ...item }
}

function ensureProject(
  projects: Map<string, ProjectProjection>,
  workspace: string,
  projectId: string
): ProjectProjection {
  const key = projectKey(workspace, projectId)
  const existing = projects.get(key)
  if (existing) return existing
  const next: ProjectProjection = {
    workspace,
    projectId,
    evidenceRefs: new Set(),
    blockers: [],
  }
  projects.set(key, next)
  return next
}

function addBlocker(project: ProjectProjection, blocker: string) {
  if (!project.blockers.includes(blocker)) project.blockers.push(blocker)
}

function getLoopStatus(project: ProjectProjection): 'active' | 'blocked' | 'done' {
  if (project.blockers.length > 0) return 'blocked'
  if (project.status && isDoneStatus(project.status)) return 'done'
  return 'active'
}

function projectKey(workspace: string, projectId: string): string {
  return `${workspace}:${projectId}`
}

function planeProjectSubjectId(record: { workspace: string; projectId: string }): string {
  return `${record.workspace}/${record.projectId}`
}

function planeIssueSubjectId(record: {
  workspace: string
  projectId: string
  issueId: string
}): string {
  return `${planeProjectSubjectId(record)}/issue/${record.issueId}`
}

function issueLabel(record: { issueId: string; sequenceId?: string }): string {
  return record.sequenceId ?? record.issueId
}

function payload(input: Record<string, unknown>): Record<string, unknown> {
  return filterUndefined(input) as Record<string, unknown>
}

function statusSignal(status: string): string {
  const normalized = normalizeStatus(status)
  if (isBlockedStatus(normalized)) return 'blocked'
  if (isDoneStatus(normalized)) return 'done'
  return 'active'
}

function isBlockedStatus(status: string): boolean {
  const normalized = normalizeStatus(status)
  return normalized === 'blocked' || normalized === 'stuck' || normalized === 'needs_review'
}

function isDoneStatus(status: string): boolean {
  const normalized = normalizeStatus(status)
  return normalized === 'done' || normalized === 'completed' || normalized === 'closed'
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}
