import { createLogger } from '@sim/logger'
import { toError } from '@sim/utils/errors'
import { isRecordLike } from '@sim/utils/object'
import type { BlockState } from '@sim/workflow-types/workflow'

const logger = createLogger('WorkflowValidation')

/**
 * Checks if a custom tool has a valid inline schema.
 */
function isValidCustomToolSchema(tool: unknown): boolean {
  try {
    if (!isRecordLike(tool)) return false
    if (tool.type !== 'custom-tool') return true

    const schema = tool.schema
    if (!isRecordLike(schema)) return false
    const fn = schema.function
    if (!isRecordLike(fn)) return false
    if (!fn.name || typeof fn.name !== 'string') return false

    const params = fn.parameters
    if (!isRecordLike(params)) return false
    if (params.type !== 'object') return false
    if (!isRecordLike(params.properties)) return false

    return true
  } catch (_err) {
    return false
  }
}

/**
 * Checks if a custom tool is a valid reference-only format.
 */
function isValidCustomToolReference(tool: unknown): boolean {
  try {
    if (!isRecordLike(tool)) return false
    if (tool.type !== 'custom-tool') return false

    if (tool.customToolId && typeof tool.customToolId === 'string') {
      return true
    }

    return false
  } catch (_err) {
    return false
  }
}

/**
 * Normalizes persisted agent tool values and removes malformed custom tools.
 */
export function sanitizeAgentToolsInBlocks(blocks: Record<string, BlockState>): {
  blocks: Record<string, BlockState>
  warnings: string[]
} {
  const warnings: string[] = []
  const sanitizedBlocks: Record<string, BlockState> = { ...blocks }

  for (const [blockId, block] of Object.entries(sanitizedBlocks)) {
    try {
      if (!block || block.type !== 'agent') continue
      const subBlocks = block.subBlocks || {}
      const toolsSubBlock = subBlocks.tools
      if (!toolsSubBlock) continue

      let value = toolsSubBlock.value

      if (typeof value === 'string') {
        try {
          value = JSON.parse(value)
        } catch (_e) {
          warnings.push(
            `Block ${block.name || blockId}: invalid tools JSON; resetting tools to empty array`
          )
          value = []
        }
      }

      if (!Array.isArray(value)) {
        warnings.push(`Block ${block.name || blockId}: tools value is not an array; resetting`)
        toolsSubBlock.value = []
        continue
      }

      const originalLength = value.length
      const cleaned = value
        .filter((tool: unknown) => {
          if (!isRecordLike(tool)) return false
          if (tool.type !== 'custom-tool') return true

          if (isValidCustomToolReference(tool)) {
            return true
          }

          const ok = isValidCustomToolSchema(tool)
          if (!ok) {
            logger.warn('Removing invalid custom tool from workflow', {
              blockId,
              blockName: block.name,
              hasCustomToolId: !!tool.customToolId,
              hasSchema: !!tool.schema,
            })
          }
          return ok
        })
        .map((tool: unknown) => {
          if (isRecordLike(tool) && tool.type === 'custom-tool') {
            if (!tool.usageControl) {
              tool.usageControl = 'auto'
            }
            if (!tool.customToolId && (!tool.code || typeof tool.code !== 'string')) {
              tool.code = ''
            }
          }
          return tool
        })

      if (cleaned.length !== originalLength) {
        warnings.push(
          `Block ${block.name || blockId}: removed ${originalLength - cleaned.length} invalid tool(s)`
        )
      }

      const toolsValueTarget: { value: unknown } = toolsSubBlock
      toolsValueTarget.value = cleaned
      sanitizedBlocks[blockId] = { ...block, subBlocks: { ...subBlocks, tools: toolsSubBlock } }
    } catch (err: unknown) {
      const message = toError(err).message
      warnings.push(`Block ${block?.name || blockId}: tools sanitation failed: ${message}`)
    }
  }

  return { blocks: sanitizedBlocks, warnings }
}
