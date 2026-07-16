import { db } from '@sim/db'
import { workflow as workflowTable } from '@sim/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

export async function getWorkflowById(id: string, options?: { includeArchived?: boolean }) {
  const { includeArchived = false } = options ?? {}
  const rows = await db
    .select()
    .from(workflowTable)
    .where(
      includeArchived
        ? eq(workflowTable.id, id)
        : and(eq(workflowTable.id, id), isNull(workflowTable.archivedAt))
    )
    .limit(1)

  return rows[0]
}
