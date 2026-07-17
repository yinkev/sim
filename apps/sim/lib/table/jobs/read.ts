import { db } from '@sim/db'
import { tableJobs } from '@sim/db/schema'
import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db/types'
import type { TableDefinition, TableDeleteJobPayload } from '@/lib/table/types'

/** Job fields projected onto a table definition from its latest background job. */
interface DerivedJobFields {
  jobStatus: TableDefinition['jobStatus']
  jobId: string | null
  jobType: TableDefinition['jobType']
  jobError: string | null
  jobRowsProcessed: number
  pendingDeleteRemaining: number
}

export const EMPTY_JOB_FIELDS: DerivedJobFields = {
  jobStatus: null,
  jobId: null,
  jobType: null,
  jobError: null,
  jobRowsProcessed: 0,
  pendingDeleteRemaining: 0,
}

function mapJobRow(
  row:
    | {
        id: string
        type: string
        status: string
        rowsProcessed: number
        error: string | null
        payload: unknown
      }
    | undefined
): DerivedJobFields {
  if (!row) return EMPTY_JOB_FIELDS
  const doomedCount =
    row.type === 'delete' && row.status === 'running'
      ? ((row.payload as TableDeleteJobPayload | null)?.doomedCount ?? 0)
      : 0
  return {
    jobStatus: row.status as TableDefinition['jobStatus'],
    jobId: row.id,
    jobType: row.type as TableDefinition['jobType'],
    jobError: row.error,
    jobRowsProcessed: row.rowsProcessed,
    pendingDeleteRemaining: Math.max(0, doomedCount - row.rowsProcessed),
  }
}

const JOB_PROJECTION = {
  id: tableJobs.id,
  type: tableJobs.type,
  status: tableJobs.status,
  rowsProcessed: tableJobs.rowsProcessed,
  error: tableJobs.error,
  payload: tableJobs.payload,
} as const

/** Returns the latest non-export job for one table. */
export async function latestJobForTable(
  tableId: string,
  executor: DbOrTx = db
): Promise<DerivedJobFields> {
  const [row] = await executor
    .select(JOB_PROJECTION)
    .from(tableJobs)
    .where(and(eq(tableJobs.tableId, tableId), ne(tableJobs.type, 'export')))
    .orderBy(desc(tableJobs.startedAt))
    .limit(1)
  return mapJobRow(row)
}

/** Returns the latest non-export job for each requested table. */
export async function latestJobsForTables(
  tableIds: string[]
): Promise<Map<string, DerivedJobFields>> {
  const map = new Map<string, DerivedJobFields>()
  if (tableIds.length === 0) return map
  const rows = await db
    .selectDistinctOn([tableJobs.tableId], { tableId: tableJobs.tableId, ...JOB_PROJECTION })
    .from(tableJobs)
    .where(and(inArray(tableJobs.tableId, tableIds), ne(tableJobs.type, 'export')))
    .orderBy(tableJobs.tableId, desc(tableJobs.startedAt))
  for (const row of rows) map.set(row.tableId, mapJobRow(row))
  return map
}
