#!/usr/bin/env bun

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCanonicalIndex, isCanonicalPair } from '@/lib/workflows/subblocks/visibility'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(
  SCRIPT_DIR,
  '../lib/workflows/migrations/subblock-metadata.generated.json'
)

interface CanonicalPairMetadata {
  canonicalId: string
  basicId: string
  advancedIds: string[]
}

interface BlockMigrationMetadata {
  types: Record<string, string>
  pairs?: CanonicalPairMetadata[]
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function projectSubBlockTypes(
  subBlocks: Array<{ id: string; type: string }>
): Record<string, string> {
  const types: Record<string, string> = {}

  for (const subBlock of subBlocks) {
    if (types[subBlock.id] === undefined) types[subBlock.id] = subBlock.type
  }

  return Object.fromEntries(
    Object.entries(types).sort(([left], [right]) => compareStrings(left, right))
  )
}

async function generateMetadata(): Promise<string> {
  const { getAllBlocks } = await import('@/blocks/registry')
  const blocks = [...getAllBlocks()].sort((left, right) => compareStrings(left.type, right.type))
  const metadata: Record<string, BlockMigrationMetadata> = {}

  for (const block of blocks) {
    if (metadata[block.type]) throw new Error(`Duplicate block type "${block.type}"`)

    const canonicalIndex = buildCanonicalIndex(block.subBlocks)
    const pairs = Object.values(canonicalIndex.groupsById)
      .filter(isCanonicalPair)
      .map((group) => ({
        canonicalId: group.canonicalId,
        basicId: group.basicId as string,
        advancedIds: group.advancedIds,
      }))
      .sort((left, right) => compareStrings(left.canonicalId, right.canonicalId))
    const types = projectSubBlockTypes(block.subBlocks)

    if (Object.keys(types).length > 0 || pairs.length > 0) {
      metadata[block.type] = {
        types,
        ...(pairs.length > 0 ? { pairs } : {}),
      }
    }
  }

  return `${JSON.stringify(metadata)}\n`
}

async function main(): Promise<void> {
  const rendered = await generateMetadata()

  if (process.argv.includes('--check')) {
    const current = await readFile(OUTPUT_PATH, 'utf8').catch(() => null)
    if (current !== rendered) {
      throw new Error(
        'Generated subblock migration metadata is stale. Run: bun run generate:subblock-migration-metadata'
      )
    }
    process.stdout.write('Subblock migration metadata is up to date.\n')
    return
  }

  await writeFile(OUTPUT_PATH, rendered, 'utf8')
  process.stdout.write(`Generated subblock migration metadata -> ${OUTPUT_PATH}\n`)
}

await main()
