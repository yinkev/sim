import { db } from '@sim/db'
import { workspaceBYOKKeys } from '@sim/db/schema'
import { decrypt, encrypt } from '@sim/security/encryption'
import { generateShortId } from '@sim/utils/id'
import { and, asc, desc, eq } from 'drizzle-orm'

type MothershipByokDbClient = Pick<typeof db, 'delete' | 'insert' | 'select' | 'update'>

export interface MothershipByokProviderRecord {
  provider: string
  configured: true
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ListMothershipByokProvidersInput {
  workspaceId: string
  client?: MothershipByokDbClient
}

export interface UpsertMothershipByokProviderKeyInput {
  workspaceId: string
  provider: string
  apiKey: string
  encryptionKey: string
  createdBy?: string
  client?: MothershipByokDbClient
}

export interface DeleteMothershipByokProviderKeysInput {
  workspaceId: string
  provider: string
  client?: MothershipByokDbClient
}

export interface GetMothershipByokProviderKeyInput {
  workspaceId: string
  provider: string
  encryptionKey: string
  client?: MothershipByokDbClient
}

export interface MothershipByokMutationResult {
  workspaceId: string
  provider: string
}

export interface MothershipByokProviderKeyResult {
  provider: string
  workspaceId: string
  apiKey: string
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function encryptionKeyBuffer(encryptionKey: string): Buffer {
  return Buffer.from(encryptionKey, 'hex')
}

export async function listMothershipByokProviders(
  input: ListMothershipByokProvidersInput
): Promise<MothershipByokProviderRecord[]> {
  const client = input.client ?? db
  const rows = await client
    .select({
      providerId: workspaceBYOKKeys.providerId,
      createdBy: workspaceBYOKKeys.createdBy,
      createdAt: workspaceBYOKKeys.createdAt,
      updatedAt: workspaceBYOKKeys.updatedAt,
    })
    .from(workspaceBYOKKeys)
    .where(eq(workspaceBYOKKeys.workspaceId, input.workspaceId))
    .orderBy(
      asc(workspaceBYOKKeys.providerId),
      asc(workspaceBYOKKeys.createdAt),
      asc(workspaceBYOKKeys.id)
    )

  return rows.map((row) => ({
    provider: row.providerId,
    configured: true,
    createdBy: row.createdBy ?? null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }))
}

export async function upsertMothershipByokProviderKey(
  input: UpsertMothershipByokProviderKeyInput
): Promise<MothershipByokMutationResult> {
  const client = input.client ?? db
  const now = new Date()
  const { encrypted } = await encrypt(input.apiKey, encryptionKeyBuffer(input.encryptionKey))
  const [existingKey] = await client
    .select({ id: workspaceBYOKKeys.id })
    .from(workspaceBYOKKeys)
    .where(
      and(
        eq(workspaceBYOKKeys.workspaceId, input.workspaceId),
        eq(workspaceBYOKKeys.providerId, input.provider)
      )
    )
    .limit(1)

  if (existingKey) {
    await client
      .update(workspaceBYOKKeys)
      .set({
        encryptedApiKey: encrypted,
        updatedAt: now,
      })
      .where(eq(workspaceBYOKKeys.id, existingKey.id))
    return { workspaceId: input.workspaceId, provider: input.provider }
  }

  await client.insert(workspaceBYOKKeys).values({
    id: generateShortId(),
    workspaceId: input.workspaceId,
    providerId: input.provider,
    encryptedApiKey: encrypted,
    name: null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  })

  return { workspaceId: input.workspaceId, provider: input.provider }
}

export async function deleteMothershipByokProviderKeys(
  input: DeleteMothershipByokProviderKeysInput
): Promise<MothershipByokMutationResult> {
  const client = input.client ?? db
  await client
    .delete(workspaceBYOKKeys)
    .where(
      and(
        eq(workspaceBYOKKeys.workspaceId, input.workspaceId),
        eq(workspaceBYOKKeys.providerId, input.provider)
      )
    )

  return { workspaceId: input.workspaceId, provider: input.provider }
}

export async function getMothershipByokProviderKey(
  input: GetMothershipByokProviderKeyInput
): Promise<MothershipByokProviderKeyResult | null> {
  const client = input.client ?? db
  const rows = await client
    .select({ encryptedApiKey: workspaceBYOKKeys.encryptedApiKey })
    .from(workspaceBYOKKeys)
    .where(
      and(
        eq(workspaceBYOKKeys.workspaceId, input.workspaceId),
        eq(workspaceBYOKKeys.providerId, input.provider)
      )
    )
    .orderBy(desc(workspaceBYOKKeys.createdAt), desc(workspaceBYOKKeys.id))

  for (const row of rows) {
    try {
      const { decrypted } = await decrypt(
        row.encryptedApiKey,
        encryptionKeyBuffer(input.encryptionKey)
      )
      return {
        provider: input.provider,
        workspaceId: input.workspaceId,
        apiKey: decrypted,
      }
    } catch {}
  }

  return null
}
