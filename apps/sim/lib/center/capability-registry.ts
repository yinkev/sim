import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CenterProducerImportPacket } from '@/lib/center/producer-import'

const DEFAULT_CAPABILITY_DIR = path.join(getRepoRoot(), '.ai-bridge/capabilities')

export interface CenterCapabilityRegistry {
  registeredIds: string[]
}

export async function readCenterCapabilityRegistry(
  capabilityDir = process.env.CENTER_CAPABILITY_DIR || DEFAULT_CAPABILITY_DIR
): Promise<CenterCapabilityRegistry> {
  const files = await readdir(capabilityDir).catch(() => [])
  const ids = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map(async (file) => readCapabilityId(path.join(capabilityDir, file)))
  )
  return { registeredIds: ids.filter((id): id is string => !!id).sort() }
}

export function getUnknownCenterCapabilityIds(
  packet: CenterProducerImportPacket,
  registry: CenterCapabilityRegistry
): string[] {
  const registered = new Set(registry.registeredIds)
  return [...new Set(packet.capabilityIds)]
    .filter((capabilityId) => !registered.has(capabilityId))
    .sort()
}

async function readCapabilityId(filePath: string): Promise<string | null> {
  const text = await readFile(filePath, 'utf8').catch(() => null)
  if (!text) return null
  const parsed = JSON.parse(text) as { id?: unknown }
  return typeof parsed.id === 'string' ? parsed.id : null
}

function getRepoRoot(): string {
  const cwd = process.cwd()
  if (cwd.endsWith(path.join('apps', 'sim'))) return path.resolve(cwd, '../..')
  return cwd
}
