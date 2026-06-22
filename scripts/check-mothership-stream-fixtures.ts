#!/usr/bin/env bun
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { getErrorMessage } from '@sim/utils/errors'
import type { ErrorObject, ValidateFunction } from 'ajv'
import Ajv2020 from 'ajv/dist/2020'
import { MOTHERSHIP_STREAM_V1_SCHEMA } from '../apps/sim/lib/copilot/generated/mothership-stream-v1-schema'
import {
  type PersistedStreamEventEnvelope,
  parsePersistedStreamEventEnvelopeJson,
} from '../apps/sim/lib/copilot/request/session/contract'

const VALID_FIXTURE_DIR = resolve(
  import.meta.dir,
  '../packages/mothership-contracts/fixtures/streams'
)
const INVALID_FIXTURE_DIR = resolve(
  import.meta.dir,
  '../packages/mothership-contracts/fixtures/streams-invalid'
)

const INVALID_FIXTURE_EXPECTATIONS = {
  'invalid-payload-required.sse': 'failed frame validation',
  'invalid-envelope.sse': 'failed frame validation',
  'missing-envelope-required.sse': 'failed frame validation',
  'missing-terminal.sse': 'has no stream-leg terminal event',
  'openai-tool-resume-truncated.sse': 'has no stream-leg terminal event',
  'duplicate-terminal.sse': 'emitted complete after terminal error',
  'duplicate-checkpoint-terminal.sse': 'emitted complete after terminal run.checkpoint_pause',
  'workflow-subagent-child-terminal-leak.sse': 'emitted tool after terminal complete',
  'workflow-subagent-needs-input-post-terminal-leak.sse': 'emitted tool after terminal complete',
  'schema-extra-field.sse': 'failed schema validation',
} as const

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
})

const streamEventSchemaValidator = ajv.compile(
  MOTHERSHIP_STREAM_V1_SCHEMA as object
) as ValidateFunction

function getFixtureFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sse'))
    .map((entry) => join(dir, entry.name))
    .sort()
}

function isRunEvent(
  event: PersistedStreamEventEnvelope
): event is Extract<PersistedStreamEventEnvelope, { type: 'run' }> {
  return event.type === 'run'
}

function runKind(event: PersistedStreamEventEnvelope): string | undefined {
  if (!isRunEvent(event)) return undefined
  const payload = event.payload as { kind?: unknown }
  return typeof payload.kind === 'string' ? payload.kind : undefined
}

function terminalLabel(event: PersistedStreamEventEnvelope): string | null {
  return event.type === 'complete' || event.type === 'error'
    ? event.type
    : runKind(event) === 'checkpoint_pause'
      ? 'run.checkpoint_pause'
      : null
}

function isResumeEvent(event: PersistedStreamEventEnvelope): boolean {
  return runKind(event) === 'resumed'
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return 'unknown schema error'
  return errors
    .slice(0, 5)
    .map((error) => `${error.instancePath || '/'} ${error.message || 'is invalid'}`.trim())
    .join('; ')
}

function parseDataFrame(file: string, line: string, index: number): PersistedStreamEventEnvelope {
  const parsed = parsePersistedStreamEventEnvelopeJson(line.slice('data: '.length))

  if (!parsed.ok) {
    const details = parsed.errors?.length ? `: ${parsed.errors.join('; ')}` : ''
    throw new Error(
      `${basename(file)} frame ${index + 1} failed frame validation: ${parsed.message}${details}`
    )
  }

  if (!streamEventSchemaValidator(parsed.event)) {
    throw new Error(
      `${basename(file)} frame ${index + 1} failed schema validation: ${formatSchemaErrors(
        streamEventSchemaValidator.errors
      )}`
    )
  }

  return parsed.event
}

function validateFixture(file: string): number {
  const content = readFileSync(file, 'utf8')
  const dataLines = content.split('\n').filter((line) => line.startsWith('data: '))

  if (dataLines.length === 0) {
    throw new Error(`${basename(file)} has no data frames`)
  }

  let currentLegTerminal: string | null = null
  let completedLegCount = 0
  for (const [index, line] of dataLines.entries()) {
    const event = parseDataFrame(file, line, index)

    if (currentLegTerminal) {
      if (currentLegTerminal === 'run.checkpoint_pause' && isResumeEvent(event)) {
        currentLegTerminal = null
        continue
      }

      throw new Error(
        `${basename(file)} emitted ${terminalLabel(event) ?? event.type} after terminal ${
          currentLegTerminal
        }`
      )
    }

    const terminal = terminalLabel(event)
    if (terminal) {
      currentLegTerminal = terminal
      completedLegCount += 1
    }
  }

  if (!currentLegTerminal) {
    throw new Error(`${basename(file)} has no stream-leg terminal event`)
  }

  if (completedLegCount === 0) {
    throw new Error(`${basename(file)} has no stream-leg terminal event`)
  }
  return dataLines.length
}

function validateInvalidFixture(file: string): string {
  const expectedReason =
    INVALID_FIXTURE_EXPECTATIONS[basename(file) as keyof typeof INVALID_FIXTURE_EXPECTATIONS]

  if (!expectedReason) {
    throw new Error(`${basename(file)} is missing an invalid fixture expectation`)
  }

  try {
    validateFixture(file)
  } catch (error) {
    const message = getErrorMessage(error)
    if (!message.includes(expectedReason)) {
      throw new Error(
        `${basename(file)} failed for an unexpected reason: ${message}; expected ${expectedReason}`
      )
    }
    return message
  }

  throw new Error(`${basename(file)} unexpectedly passed validation`)
}

const validFixtureFiles = getFixtureFiles(VALID_FIXTURE_DIR)

if (validFixtureFiles.length === 0) {
  throw new Error(`No stream fixtures found in ${VALID_FIXTURE_DIR}`)
}

for (const file of validFixtureFiles) {
  const frameCount = validateFixture(file)
  console.log(`${basename(file)}: ${frameCount} events valid`)
}

const invalidFixtureFiles = getFixtureFiles(INVALID_FIXTURE_DIR)

if (invalidFixtureFiles.length === 0) {
  throw new Error(`No invalid stream fixtures found in ${INVALID_FIXTURE_DIR}`)
}

for (const file of invalidFixtureFiles) {
  const failure = validateInvalidFixture(file)
  console.log(`${basename(file)}: rejected as expected (${failure})`)
}
