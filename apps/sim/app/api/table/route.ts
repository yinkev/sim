import { createLogger } from '@sim/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { listTablesQuerySchema } from '@/lib/api/contracts/tables'
import { isZodError, validationErrorResponse } from '@/lib/api/server/validation'
import { checkSessionOrInternalAuth } from '@/lib/auth/hybrid'
import { generateRequestId } from '@/lib/core/utils/request'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { listTables, type TableScope } from '@/lib/table/read'
import type { TableSchema } from '@/lib/table/types'
import { checkWorkspaceAccess } from '@/app/api/table/collection-access'
import { normalizeColumn } from '@/app/api/table/normalize-column'

const logger = createLogger('TableAPI')

/** Preserve legacy clients while keeping creation dependencies off the list route. */
export const POST = withRouteHandler(async (request: NextRequest) => {
  return NextResponse.redirect(new URL('/api/table/create', request.url), 307)
})

/** GET /api/table - Lists all tables in a workspace. */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const requestId = generateRequestId()

  try {
    const authResult = await checkSessionOrInternalAuth(request, { requireWorkflowId: false })
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const scope = searchParams.get('scope')

    const validation = listTablesQuerySchema.safeParse({
      workspaceId,
      scope: scope ?? undefined,
    })
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const params = validation.data

    const { hasAccess } = await checkWorkspaceAccess(params.workspaceId, authResult.userId)

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const tables = await listTables(params.workspaceId, { scope: params.scope as TableScope })

    logger.info(`[${requestId}] Listed ${tables.length} tables in workspace ${params.workspaceId}`)

    const responseTables = tables.map((t) => {
      const schemaData = t.schema as TableSchema
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        schema: {
          columns: schemaData.columns.map(normalizeColumn),
        },
        rowCount: t.rowCount,
        maxRows: t.maxRows,
        workspaceId: t.workspaceId,
        createdBy: t.createdBy,
        createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
        updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : String(t.updatedAt),
        archivedAt:
          t.archivedAt instanceof Date
            ? t.archivedAt.toISOString()
            : t.archivedAt
              ? String(t.archivedAt)
              : null,
        jobStatus: t.jobStatus ?? null,
        jobId: t.jobId ?? null,
        jobType: t.jobType ?? null,
        jobError: t.jobError ?? null,
        jobRowsProcessed: t.jobRowsProcessed ?? 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        tables: responseTables,
        totalCount: tables.length,
      },
    })
  } catch (error) {
    if (isZodError(error)) {
      return validationErrorResponse(error)
    }

    logger.error(`[${requestId}] Error listing tables:`, error)
    return NextResponse.json({ error: 'Failed to list tables' }, { status: 500 })
  }
})
