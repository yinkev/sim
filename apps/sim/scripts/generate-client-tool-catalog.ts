#!/usr/bin/env bun

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ToolConfig } from '@/tools/types'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const METADATA_OUTPUT_PATH = resolve(SCRIPT_DIR, '../tools/client-tool-params.generated.json')
const SUMMARY_OUTPUT_PATH = resolve(SCRIPT_DIR, '../tools/client-tool-summary.generated.json')

type ClientToolMetadata = Pick<
  ToolConfig,
  'id' | 'name' | 'description' | 'version' | 'params' | 'oauth'
>

interface ClientToolSummary {
  id: string
  params: Record<string, { required: true; visibility: 'user-only' }>
  outputs?: ToolConfig['outputs']
}

interface GeneratedCatalogs {
  metadata: string
  summaries: string
}

const EXECUTION_TIMEOUT_ENV_KEYS = [
  'EXECUTION_TIMEOUT_FREE',
  'EXECUTION_TIMEOUT_PRO',
  'EXECUTION_TIMEOUT_TEAM',
  'EXECUTION_TIMEOUT_ENTERPRISE',
  'EXECUTION_TIMEOUT_ASYNC_FREE',
  'EXECUTION_TIMEOUT_ASYNC_PRO',
  'EXECUTION_TIMEOUT_ASYNC_TEAM',
  'EXECUTION_TIMEOUT_ASYNC_ENTERPRISE',
] as const

function projectToolMetadata(tool: ToolConfig): ClientToolMetadata {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    version: tool.version,
    params: tool.params,
    ...(tool.oauth === undefined ? {} : { oauth: tool.oauth }),
  }
}

function projectToolSummary(tool: ToolConfig): ClientToolSummary {
  const params: ClientToolSummary['params'] = {}

  for (const [id, param] of Object.entries(tool.params)) {
    if (param?.required === true && param.visibility === 'user-only') {
      params[id] = { required: true, visibility: 'user-only' }
    }
  }

  return {
    id: tool.id,
    params,
    ...(tool.outputs === undefined ? {} : { outputs: tool.outputs }),
  }
}

function compareToolIds(left: { id: string }, right: { id: string }): number {
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

function assertUniqueIds(catalog: readonly { id: string }[], label: string): void {
  const ids = new Set(catalog.map(({ id }) => id))
  if (ids.size !== catalog.length) throw new Error(`${label} contains duplicate tool ids`)
}

async function generateCatalogs(): Promise<GeneratedCatalogs> {
  for (const key of EXECUTION_TIMEOUT_ENV_KEYS) delete process.env[key]

  const { tools } = await import('@/tools/registry')
  const entries = Object.entries(tools)

  for (const [registryId, tool] of entries) {
    if (registryId !== tool.id) {
      throw new Error(`Tool registry key "${registryId}" does not match tool id "${tool.id}"`)
    }
  }

  const metadata = entries.map(([, tool]) => projectToolMetadata(tool)).sort(compareToolIds)
  const summaries = entries.map(([, tool]) => projectToolSummary(tool)).sort(compareToolIds)

  assertUniqueIds(metadata, 'Client tool metadata catalog')
  assertUniqueIds(summaries, 'Client tool summary catalog')

  return {
    metadata: `${JSON.stringify(metadata)}\n`,
    summaries: `${JSON.stringify(summaries)}\n`,
  }
}

async function main(): Promise<void> {
  const rendered = await generateCatalogs()

  if (process.argv.includes('--check')) {
    const [metadata, summaries] = await Promise.all([
      readFile(METADATA_OUTPUT_PATH, 'utf8').catch(() => null),
      readFile(SUMMARY_OUTPUT_PATH, 'utf8').catch(() => null),
    ])
    if (metadata !== rendered.metadata || summaries !== rendered.summaries) {
      throw new Error(
        'Generated client tool catalogs are stale. Run: bun run apps/sim/scripts/generate-client-tool-catalog.ts'
      )
    }
    process.stdout.write('Client tool catalogs are up to date.\n')
    return
  }

  await Promise.all([
    writeFile(METADATA_OUTPUT_PATH, rendered.metadata, 'utf8'),
    writeFile(SUMMARY_OUTPUT_PATH, rendered.summaries, 'utf8'),
  ])
  process.stdout.write(`Generated client tool metadata -> ${METADATA_OUTPUT_PATH}\n`)
  process.stdout.write(`Generated client tool summaries -> ${SUMMARY_OUTPUT_PATH}\n`)
}

await main()
