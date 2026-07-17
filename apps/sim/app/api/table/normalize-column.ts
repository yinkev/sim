import type { ColumnDefinition } from '@/lib/table/types'

/** Returns the canonical table column shape sent over the API boundary. */
export function normalizeColumn(column: ColumnDefinition): ColumnDefinition {
  return {
    ...(column.id ? { id: column.id } : {}),
    name: column.name,
    type: column.type,
    required: column.required ?? false,
    unique: column.unique ?? false,
    ...(column.workflowGroupId ? { workflowGroupId: column.workflowGroupId } : {}),
  }
}
