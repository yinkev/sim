import { db } from '@sim/db'
import { apiKey } from '@sim/db/schema'
import { decrypt, encrypt } from '@sim/security/encryption'
import { sha256Hex } from '@sim/security/hash'
import { generateSecureToken } from '@sim/security/tokens'
import { generateShortId } from '@sim/utils/id'
import { and, desc, eq } from 'drizzle-orm'

type MothershipApiKeyDbClient = Pick<typeof db, 'delete' | 'insert' | 'select'>

export interface MothershipApiKeyRecord {
  id: string
  name: string | null
  displayKey: string
  createdAt: string | null
  lastUsed: string | null
}

export interface ListMothershipApiKeysInput {
  userId: string
  apiEncryptionKey?: string
  client?: MothershipApiKeyDbClient
}

export interface GenerateMothershipApiKeyInput {
  userId: string
  name: string
  apiEncryptionKey: string
  client?: MothershipApiKeyDbClient
}

export interface GenerateMothershipApiKeyResult {
  id: string
  apiKey: string
}

export interface DeleteMothershipApiKeyInput {
  userId: string
  apiKeyId: string
  client?: MothershipApiKeyDbClient
}

export interface DeleteMothershipApiKeyResult {
  deleted: boolean
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function isEncryptedStoredKey(value: string): boolean {
  return value.split(':').length === 3
}

function keyBuffer(apiEncryptionKey: string): Buffer {
  return Buffer.from(apiEncryptionKey, 'hex')
}

function formatApiKeyForDisplay(value: string): string {
  if (value.startsWith('sk-sim-')) return `sk-sim-...${value.slice(-4)}`
  if (value.startsWith('sim_')) return `sim_...${value.slice(-4)}`
  return `...${value.slice(-4)}`
}

async function displayKeyForStoredValue(
  storedKey: string,
  apiEncryptionKey?: string
): Promise<string> {
  if (!isEncryptedStoredKey(storedKey)) return formatApiKeyForDisplay(storedKey)
  if (!apiEncryptionKey) return '****'

  try {
    const { decrypted } = await decrypt(storedKey, keyBuffer(apiEncryptionKey))
    return formatApiKeyForDisplay(decrypted)
  } catch {
    return '****'
  }
}

function generatePlainApiKey(): string {
  return `sk-sim-${generateSecureToken(24)}`
}

export async function listMothershipApiKeys(
  input: ListMothershipApiKeysInput
): Promise<MothershipApiKeyRecord[]> {
  const client = input.client ?? db
  const rows = await client
    .select({
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key,
      createdAt: apiKey.createdAt,
      lastUsed: apiKey.lastUsed,
    })
    .from(apiKey)
    .where(and(eq(apiKey.userId, input.userId), eq(apiKey.type, 'personal')))
    .orderBy(desc(apiKey.createdAt), desc(apiKey.id))

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name ?? null,
      displayKey: await displayKeyForStoredValue(row.key, input.apiEncryptionKey),
      createdAt: toIsoString(row.createdAt),
      lastUsed: toIsoString(row.lastUsed),
    }))
  )
}

export async function generateMothershipApiKey(
  input: GenerateMothershipApiKeyInput
): Promise<GenerateMothershipApiKeyResult> {
  const client = input.client ?? db
  const plainKey = generatePlainApiKey()
  const { encrypted } = await encrypt(plainKey, keyBuffer(input.apiEncryptionKey))
  const id = generateShortId()
  const now = new Date()

  await client.insert(apiKey).values({
    id,
    userId: input.userId,
    workspaceId: null,
    createdBy: input.userId,
    name: input.name,
    key: encrypted,
    keyHash: sha256Hex(plainKey),
    type: 'personal',
    createdAt: now,
    updatedAt: now,
  })

  return { id, apiKey: plainKey }
}

export async function deleteMothershipApiKey(
  input: DeleteMothershipApiKeyInput
): Promise<DeleteMothershipApiKeyResult> {
  const client = input.client ?? db
  const deleted = await client
    .delete(apiKey)
    .where(
      and(
        eq(apiKey.id, input.apiKeyId),
        eq(apiKey.userId, input.userId),
        eq(apiKey.type, 'personal')
      )
    )
    .returning({ id: apiKey.id })

  return { deleted: deleted.length > 0 }
}
