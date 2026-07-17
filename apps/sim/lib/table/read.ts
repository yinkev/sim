import { db } from '@sim/db'
import { userTableDefinitions } from '@sim/db/schema'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { getColumnId } from '@/lib/table/column-keys'
import { EMPTY_JOB_FIELDS, latestJobsForTables } from '@/lib/table/jobs/read'
import type { TableDefinition, TableMetadata, TableSchema } from '@/lib/table/types'

export type TableScope = 'active' | 'archived' | 'all'

/** Applies a table's persisted visible column order to its schema. */
export function applyColumnOrderToSchema(
  schema: TableSchema,
  metadata: TableMetadata | null
): TableSchema {
  const order = metadata?.columnOrder
  if (!order || order.length === 0) return schema
  const byId = new Map<string, TableSchema['columns'][number]>()
  for (const column of schema.columns) byId.set(getColumnId(column), column)
  const ordered: TableSchema['columns'] = []
  for (const id of order) {
    const column = byId.get(id)
    if (column) {
      ordered.push(column)
      byId.delete(id)
    }
  }
  for (const column of byId.values()) ordered.push(column)
  return { ...schema, columns: ordered }
}

/** Lists table definitions for a workspace and enriches them with active job state. */
export async function listTables(
  workspaceId: string,
  options?: { scope?: TableScope }
): Promise<TableDefinition[]> {
  const { scope = 'active' } = options ?? {}
  const tables = await db
    .select({
      id: userTableDefinitions.id,
      name: userTableDefinitions.name,
      description: userTableDefinitions.description,
      schema: userTableDefinitions.schema,
      metadata: userTableDefinitions.metadata,
      maxRows: userTableDefinitions.maxRows,
      workspaceId: userTableDefinitions.workspaceId,
      createdBy: userTableDefinitions.createdBy,
      archivedAt: userTableDefinitions.archivedAt,
      createdAt: userTableDefinitions.createdAt,
      updatedAt: userTableDefinitions.updatedAt,
      rowCount: userTableDefinitions.rowCount,
    })
    .from(userTableDefinitions)
    .where(
      scope === 'all'
        ? eq(userTableDefinitions.workspaceId, workspaceId)
        : scope === 'archived'
          ? and(
              eq(userTableDefinitions.workspaceId, workspaceId),
              sql`${userTableDefinitions.archivedAt} IS NOT NULL`
            )
          : and(
              eq(userTableDefinitions.workspaceId, workspaceId),
              isNull(userTableDefinitions.archivedAt)
            )
    )
    .orderBy(userTableDefinitions.createdAt)

  const jobsByTable = await latestJobsForTables(tables.map((table) => table.id))

  return tables.map((table) => {
    const metadata = (table.metadata as TableMetadata) ?? null
    const { pendingDeleteRemaining, ...jobFields } = jobsByTable.get(table.id) ?? EMPTY_JOB_FIELDS
    return {
      id: table.id,
      name: table.name,
      description: table.description,
      schema: applyColumnOrderToSchema(table.schema as TableSchema, metadata),
      metadata,
      rowCount: Math.max(0, table.rowCount - pendingDeleteRemaining),
      maxRows: table.maxRows,
      workspaceId: table.workspaceId,
      createdBy: table.createdBy,
      archivedAt: table.archivedAt,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
      ...jobFields,
    }
  })
}
