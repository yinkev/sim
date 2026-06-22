import { toError } from '@sim/utils/errors'

const ERROR_METADATA_KEYS = [
  'toolId',
  'toolName',
  'blockId',
  'blockName',
  'output',
  'status',
  'statusText',
  'request',
  'timestamp',
] as const

type ErrorMetadataKey = (typeof ERROR_METADATA_KEYS)[number]

export type MutableHandlerError = Error & Partial<Record<ErrorMetadataKey, unknown>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function createBaseError(error: unknown): MutableHandlerError {
  if (error instanceof Error) return error as MutableHandlerError
  if (isRecord(error) && typeof error.message === 'string' && error.message.trim().length > 0) {
    return new Error(error.message) as MutableHandlerError
  }
  return toError(error) as MutableHandlerError
}

export function normalizeHandlerError(error: unknown): MutableHandlerError {
  const normalized = createBaseError(error)
  if (!isRecord(error)) return normalized

  for (const key of ERROR_METADATA_KEYS) {
    if (normalized[key] === undefined && error[key] !== undefined) {
      normalized[key] = error[key]
    }
  }

  return normalized
}

export function shouldReplaceHandlerErrorMessage(message: string | undefined): boolean {
  const trimmed = message?.trim()
  return (
    !trimmed ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === 'undefined (undefined)' ||
    trimmed === '[object Object]'
  )
}
