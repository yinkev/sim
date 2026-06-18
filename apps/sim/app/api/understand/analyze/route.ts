import path from 'node:path'
import { createLogger } from '@sim/logger'
import { getErrorMessage } from '@sim/utils/errors'
import { type NextRequest, NextResponse } from 'next/server'
import { analyzeCodebaseContract } from '@/lib/api/contracts'
import { parseRequest } from '@/lib/api/server'
import { checkSessionOrInternalAuth } from '@/lib/auth/hybrid'
import { generateRequestId } from '@/lib/core/utils/request'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import {
  buildKnowledgeGraph,
  extractCodeSemantics,
  parseCodebase,
  renderKnowledgeGraph,
  scanCodebase,
} from '@/lib/understand/pipeline'

const logger = createLogger('UnderstandAnalyzeAPI')

function isLocalUnderstandEnabled(): boolean {
  return process.env.DISABLE_AUTH === 'true' || process.env.NODE_ENV !== 'production'
}

function optionalText(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined
}

export const POST = withRouteHandler(async (request: NextRequest) => {
  const requestId = generateRequestId()

  try {
    const auth = await checkSessionOrInternalAuth(request, { requireWorkflowId: false })
    if (!auth.success || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isLocalUnderstandEnabled()) {
      return NextResponse.json(
        {
          error: 'Understand analysis is only enabled for local development or DISABLE_AUTH=true.',
        },
        { status: 403 }
      )
    }

    const parsed = await parseRequest(analyzeCodebaseContract, request, {})
    if (!parsed.success) return parsed.response

    const {
      rootPath,
      ignorePatterns,
      maxFiles = 500,
      projectName,
      graphOutputPath,
      htmlOutputPath,
    } = parsed.data.body
    const resolvedRootPath = path.resolve(rootPath)
    const resolvedProjectName = optionalText(projectName) ?? path.basename(resolvedRootPath)

    logger.info(`[${requestId}] Running understand analysis`, {
      rootPath: resolvedRootPath,
      maxFiles,
      projectName: resolvedProjectName,
    })

    const scan = await scanCodebase({
      rootPath: resolvedRootPath,
      ignorePatterns: optionalText(ignorePatterns),
      maxFiles,
    })
    const parsedCode = await parseCodebase({ files: scan })
    const extracted = await extractCodeSemantics({ parsedData: parsedCode })
    const graphResult = await buildKnowledgeGraph({
      rootPath: resolvedRootPath,
      scanResult: scan,
      parsedData: parsedCode,
      summaries: extracted.summaries,
      relationships: extracted.relationships,
      projectName: resolvedProjectName,
      outputPath: optionalText(graphOutputPath),
    })
    const defaultHtmlOutputPath = graphResult.outputPath
      ? path.join(path.dirname(graphResult.outputPath), 'index.html')
      : undefined
    const viewResult = await renderKnowledgeGraph({
      graph: graphResult.graph,
      outputPath: optionalText(htmlOutputPath) ?? defaultHtmlOutputPath,
    })

    return NextResponse.json({
      success: true,
      scan,
      parsed: parsedCode,
      extracted,
      graph: graphResult.graph,
      html: viewResult.html,
      outputPath: graphResult.outputPath,
      htmlOutputPath: viewResult.outputPath,
    })
  } catch (error) {
    logger.error(`[${requestId}] Understand analysis failed`, { error })
    return NextResponse.json(
      { error: getErrorMessage(error, 'Understand analysis failed') },
      { status: 500 }
    )
  }
})
