import * as audit from '@sim/audit'
import { createLogger } from '@sim/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createTableContract } from '@/lib/api/contracts/tables'
import { parseRequest, validationErrorResponse } from '@/lib/api/server/validation'
import { checkSessionOrInternalAuth } from '@/lib/auth/hybrid'
import { generateRequestId } from '@/lib/core/utils/request'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { captureServerEvent } from '@/lib/posthog/server'
import { getWorkspaceTableLimits } from '@/lib/table/billing'
import { createTable } from '@/lib/table/service'
import type { TableSchema } from '@/lib/table/types'
import { checkWorkspaceAccess } from '@/app/api/table/collection-access'
import { normalizeColumn } from '@/app/api/table/normalize-column'

const logger = createLogger('TableAPI')

/** POST /api/table/create - Creates a new user-defined table. */
export const POST = withRouteHandler(async (request: NextRequest) => {
  const requestId = generateRequestId()

  try {
    const authResult = await checkSessionOrInternalAuth(request, { requireWorkflowId: false })
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const parsed = await parseRequest(
      createTableContract,
      request,
      {},
      {
        validationErrorResponse: (error) => validationErrorResponse(error),
      }
    )
    if (!parsed.success) return parsed.response

    const params = parsed.data.body
    const { hasAccess, canWrite } = await checkWorkspaceAccess(
      params.workspaceId,
      authResult.userId
    )

    if (!hasAccess || !canWrite) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const planLimits = await getWorkspaceTableLimits(params.workspaceId)
    const normalizedSchema: TableSchema = {
      columns: params.schema.columns.map(normalizeColumn),
    }

    const table = await createTable(
      {
        name: params.name,
        description: params.description,
        schema: normalizedSchema,
        workspaceId: params.workspaceId,
        userId: authResult.userId,
        maxTables: planLimits.maxTables,
        initialRowCount: params.initialRowCount,
      },
      requestId
    )

    captureServerEvent(
      authResult.userId,
      'table_created',
      {
        table_id: table.id,
        workspace_id: params.workspaceId,
        column_count: params.schema.columns.length,
      },
      {
        groups: { workspace: params.workspaceId },
        setOnce: { first_table_created_at: new Date().toISOString() },
      }
    )

    audit.recordAudit({
      workspaceId: params.workspaceId,
      actorId: authResult.userId,
      actorName: authResult.userName ?? undefined,
      actorEmail: authResult.userEmail ?? undefined,
      action: audit.AuditAction.TABLE_CREATED,
      resourceType: audit.AuditResourceType.TABLE,
      resourceId: table.id,
      resourceName: table.name,
      description: `Created table "${table.name}"`,
      request,
    })

    return NextResponse.json({
      success: true,
      data: {
        table: {
          id: table.id,
          name: table.name,
          description: table.description,
          schema: {
            columns: (table.schema as TableSchema).columns.map(normalizeColumn),
          },
          rowCount: table.rowCount,
          maxRows: table.maxRows,
          createdAt:
            table.createdAt instanceof Date
              ? table.createdAt.toISOString()
              : String(table.createdAt),
          updatedAt:
            table.updatedAt instanceof Date
              ? table.updatedAt.toISOString()
              : String(table.updatedAt),
        },
        message: 'Table created successfully',
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('maximum table limit')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      if (
        error.message.includes('Invalid table name') ||
        error.message.includes('Invalid schema') ||
        error.message.includes('already exists')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    logger.error(`[${requestId}] Error creating table:`, error)
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 })
  }
})
