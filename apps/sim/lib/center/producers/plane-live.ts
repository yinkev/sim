import { isPlainRecord } from '@sim/utils/object'
import type {
  CenterPlaneCycleRecord,
  CenterPlaneIssueRecord,
  CenterPlaneModuleRecord,
  CenterPlaneProjectRecord,
  CenterPlaneRecord,
  CenterPlaneSnapshot,
} from '@/lib/center/producers/plane'

const DEFAULT_PLANE_API_BASE_URL = 'https://api.plane.so'
const DEFAULT_PLANE_APP_BASE_URL = 'https://app.plane.so'

export interface CenterPlaneLiveConfig {
  workspaceSlug: string
  projectIds: string[]
  token: string
  baseUrl?: string
  appBaseUrl?: string
}

interface PlaneLiveRequest {
  path: string
}

export function readCenterPlaneLiveConfig(
  env: NodeJS.ProcessEnv = process.env
): CenterPlaneLiveConfig | null {
  const workspaceSlug = readEnvString(env.CENTER_PLANE_WORKSPACE_SLUG)
  const token =
    readEnvString(env.CENTER_PLANE_API_KEY) ??
    readEnvString(env.PLANE_API_KEY) ??
    readEnvString(env.PLANE_OAUTH_TOKEN)
  const projectIds = (env.CENTER_PLANE_PROJECT_IDS ?? env.CENTER_PLANE_PROJECT_ID ?? '')
    .split(',')
    .map((projectId) => projectId.trim())
    .filter(Boolean)

  if (!workspaceSlug || !token || projectIds.length === 0) return null

  return {
    workspaceSlug,
    projectIds,
    token,
    baseUrl: readEnvString(env.CENTER_PLANE_BASE_URL) ?? DEFAULT_PLANE_API_BASE_URL,
    appBaseUrl: readEnvString(env.CENTER_PLANE_APP_BASE_URL) ?? DEFAULT_PLANE_APP_BASE_URL,
  }
}

export async function readCenterPlaneLiveSnapshot(
  config: CenterPlaneLiveConfig,
  fetchImpl: typeof fetch = fetch
): Promise<CenterPlaneSnapshot> {
  const records: CenterPlaneRecord[] = []
  for (const projectId of config.projectIds) {
    records.push(...(await readProjectRecords(config, projectId, fetchImpl)))
  }

  return {
    sourcePath: `plane-live:${config.workspaceSlug}:${config.projectIds.join(',')}`,
    records,
  }
}

async function readProjectRecords(
  config: CenterPlaneLiveConfig,
  projectId: string,
  fetchImpl: typeof fetch
): Promise<CenterPlaneRecord[]> {
  const basePath = `/api/v1/workspaces/${encodeURIComponent(config.workspaceSlug)}/projects/${encodeURIComponent(projectId)}`
  const [project, cycles, modules, workItems] = await Promise.all([
    planeJson(config, { path: `${basePath}/` }, fetchImpl),
    planeJson(config, { path: `${basePath}/cycles/?per_page=100&cycle_view=all` }, fetchImpl),
    planeJson(config, { path: `${basePath}/modules/?per_page=100&expand=assignees` }, fetchImpl),
    planeJson(config, { path: `${basePath}/work-items/?per_page=100&expand=assignees` }, fetchImpl),
  ])

  return [
    ...readProjectRecord(config, projectId, project),
    ...readCycleRecords(config, projectId, cycles),
    ...readModuleRecords(config, projectId, modules),
    ...readIssueRecords(config, projectId, workItems),
  ]
}

async function planeJson(
  config: CenterPlaneLiveConfig,
  request: PlaneLiveRequest,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const baseUrl = (config.baseUrl ?? DEFAULT_PLANE_API_BASE_URL).replace(/\/$/, '')
  const response = await fetchImpl(`${baseUrl}${request.path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
  })
  if (!response.ok) {
    throw new Error(`Plane live producer request failed: ${response.status}`)
  }
  return response.json()
}

function readProjectRecord(
  config: CenterPlaneLiveConfig,
  projectId: string,
  input: unknown
): CenterPlaneProjectRecord[] {
  if (!isPlainRecord(input)) return []
  const name = readString(input, 'name') ?? readString(input, 'identifier')
  const updatedAt = readString(input, 'updated_at') ?? readString(input, 'created_at')
  if (!name || !updatedAt) return []
  return [
    {
      kind: 'project',
      workspace: config.workspaceSlug,
      projectId,
      name,
      status: readString(input, 'status') ?? readString(input, 'state') ?? 'active',
      updatedAt,
      lead: readActorName(input.project_lead),
      url: planeProjectUrl(config, projectId),
    },
  ]
}

function readCycleRecords(
  config: CenterPlaneLiveConfig,
  projectId: string,
  input: unknown
): CenterPlaneCycleRecord[] {
  return readList(input).flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const cycleId = readString(item, 'id')
    const name = readString(item, 'name')
    const updatedAt = readString(item, 'updated_at') ?? readString(item, 'created_at')
    if (!cycleId || !name || !updatedAt) return []
    return [
      {
        kind: 'cycle',
        workspace: config.workspaceSlug,
        projectId,
        cycleId,
        name,
        status: readString(item, 'status') ?? 'active',
        updatedAt,
        startsAt: readString(item, 'start_date'),
        endsAt: readString(item, 'end_date'),
        url: `${planeProjectUrl(config, projectId)}/cycles/${cycleId}`,
      },
    ]
  })
}

function readModuleRecords(
  config: CenterPlaneLiveConfig,
  projectId: string,
  input: unknown
): CenterPlaneModuleRecord[] {
  return readList(input).flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const moduleId = readString(item, 'id')
    const name = readString(item, 'name')
    const updatedAt = readString(item, 'updated_at') ?? readString(item, 'created_at')
    if (!moduleId || !name || !updatedAt) return []
    return [
      {
        kind: 'module',
        workspace: config.workspaceSlug,
        projectId,
        moduleId,
        name,
        status: readString(item, 'status') ?? 'active',
        updatedAt,
        owner: readActorName(item.lead) ?? readFirstActorName(item.members),
        url: `${planeProjectUrl(config, projectId)}/modules/${moduleId}`,
      },
    ]
  })
}

function readIssueRecords(
  config: CenterPlaneLiveConfig,
  projectId: string,
  input: unknown
): CenterPlaneIssueRecord[] {
  return readList(input).flatMap((item) => {
    if (!isPlainRecord(item)) return []
    const issueId = readString(item, 'id')
    const title = readString(item, 'name') ?? readString(item, 'title')
    const updatedAt = readString(item, 'updated_at') ?? readString(item, 'created_at')
    if (!issueId || !title || !updatedAt) return []
    return [
      {
        kind: 'issue',
        workspace: config.workspaceSlug,
        projectId,
        issueId,
        title,
        status: readStateName(item.state) ?? readString(item, 'status') ?? 'active',
        updatedAt,
        assignee: readFirstActorName(item.assignees),
        cycleId: readString(item, 'cycle_id') ?? readString(item, 'cycle'),
        dueAt: readString(item, 'target_date') ?? readString(item, 'due_date'),
        moduleId: readString(item, 'module_id') ?? readFirstString(item.modules),
        priority: readString(item, 'priority'),
        sequenceId: readSequenceId(item.sequence_id),
        url: `${planeProjectUrl(config, projectId)}/issues/${issueId}`,
      },
    ]
  })
}

function readList(input: unknown): unknown[] {
  if (Array.isArray(input)) return input
  if (isPlainRecord(input) && Array.isArray(input.results)) return input.results
  return []
}

function readEnvString(input: unknown): string | undefined {
  return typeof input === 'string' && input.trim() ? input.trim() : undefined
}

function readString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readSequenceId(input: unknown): string | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) return String(input)
  return typeof input === 'string' && input.trim() ? input : undefined
}

function readStateName(input: unknown): string | undefined {
  if (typeof input === 'string' && input.trim()) return input
  if (!isPlainRecord(input)) return undefined
  return readString(input, 'name') ?? readString(input, 'group')
}

function readActorName(input: unknown): string | undefined {
  if (typeof input === 'string' && input.trim()) return input
  if (!isPlainRecord(input)) return undefined
  return (
    readString(input, 'display_name') ??
    readString(input, 'name') ??
    readString(input, 'email') ??
    readString(input, 'id')
  )
}

function readFirstActorName(input: unknown): string | undefined {
  if (!Array.isArray(input)) return readActorName(input)
  for (const item of input) {
    const name = readActorName(item)
    if (name) return name
  }
  return undefined
}

function readFirstString(input: unknown): string | undefined {
  if (typeof input === 'string' && input.trim()) return input
  if (!Array.isArray(input)) return undefined
  for (const item of input) {
    if (typeof item === 'string' && item.trim()) return item
    if (isPlainRecord(item)) {
      const id = readString(item, 'id')
      if (id) return id
    }
  }
  return undefined
}

function planeProjectUrl(config: CenterPlaneLiveConfig, projectId: string): string {
  const appBaseUrl = (config.appBaseUrl ?? DEFAULT_PLANE_APP_BASE_URL).replace(/\/$/, '')
  return `${appBaseUrl}/${config.workspaceSlug}/projects/${projectId}`
}
