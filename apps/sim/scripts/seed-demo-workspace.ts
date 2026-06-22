#!/usr/bin/env bun
/**
 * Seed Demo Playground workspace with sample workflows.
 *
 * Usage:
 *   bun apps/sim/scripts/seed-demo-workspace.ts
 *   bun apps/sim/scripts/seed-demo-workspace.ts --email=user@example.com
 *   bun apps/sim/scripts/seed-demo-workspace.ts --force
 *
 * Requires DATABASE_URL (apps/sim or packages/db .env).
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from '@sim/db'
import { permissions, user, workflow, workspace } from '@sim/db/schema'
import { generateId } from '@sim/utils/id'
import { saveWorkflowToNormalizedTables } from '@sim/workflow-persistence'
import { and, eq, isNull } from 'drizzle-orm'
import { parseWorkflowJson } from '@/lib/workflows/operations/import-export'

const DEMO_WORKSPACE_NAME = 'Demo Playground'
const FIXTURE_DIR = join(import.meta.dir, '../../../packages/db/fixtures/workflows')
const FIXTURE_FILES = [
  'support-triage.json',
  'http-enrichment.json',
  'scheduled-report.json',
] as const

function parseArgs() {
  const force = process.argv.includes('--force')
  let email: string | undefined
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--email=')) email = arg.slice('--email='.length)
    if (arg.startsWith('--user-id='))
      return { force, userId: arg.slice('--user-id='.length), email }
  }
  return { force, email, userId: undefined as string | undefined }
}

async function resolveUserId(email?: string, userId?: string): Promise<string> {
  if (userId) return userId
  if (email) {
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
    if (rows[0]?.id) return rows[0].id
    throw new Error(`No user found for email: ${email}. Sign up in the app first.`)
  }
  const rows = await db.select({ id: user.id }).from(user).limit(1)
  if (rows[0]?.id) return rows[0].id
  throw new Error('No users in database. Sign up once, then re-run the seed.')
}

async function findDemoWorkspace(ownerId: string) {
  const rows = await db
    .select({ id: workspace.id, name: workspace.name })
    .from(workspace)
    .where(
      and(
        eq(workspace.name, DEMO_WORKSPACE_NAME),
        eq(workspace.ownerId, ownerId),
        isNull(workspace.archivedAt)
      )
    )
    .limit(1)
  return rows[0]
}

async function main() {
  const { force, email, userId: argUserId } = parseArgs()
  const userId = await resolveUserId(email, argUserId)

  const existing = await findDemoWorkspace(userId)
  if (existing && !force) {
    console.log(`Demo workspace already exists: ${existing.id}`)
    console.log('Re-run with --force to delete and recreate.')
    process.exit(0)
  }

  if (existing && force) {
    await db.delete(workspace).where(eq(workspace.id, existing.id))
    console.log(`Removed existing demo workspace ${existing.id}`)
  }

  const workspaceId = generateId()
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.insert(workspace).values({
      id: workspaceId,
      name: DEMO_WORKSPACE_NAME,
      color: '#6366f1',
      ownerId: userId,
      organizationId: null,
      workspaceMode: 'personal',
      billedAccountUserId: userId,
      allowPersonalApiKeys: true,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(permissions).values({
      id: generateId(),
      entityType: 'workspace',
      entityId: workspaceId,
      userId,
      permissionType: 'admin',
      createdAt: now,
      updatedAt: now,
    })
  })

  const workflowLinks: { name: string; id: string }[] = []

  for (const file of FIXTURE_FILES) {
    const path = join(FIXTURE_DIR, file)
    const raw = readFileSync(path, 'utf8')
    const parsed = parseWorkflowJson(raw, true)
    if (!parsed.data || parsed.errors.length > 0) {
      throw new Error(`Invalid fixture ${file}: ${parsed.errors.join(', ')}`)
    }

    const envelope = JSON.parse(raw) as { metadata?: { name?: string } }
    const wfName = envelope.metadata?.name ?? file.replace('.json', '')
    const workflowId = generateId()
    const wfNow = new Date()

    await db.insert(workflow).values({
      id: workflowId,
      userId,
      workspaceId,
      folderId: null,
      name: wfName,
      description: 'Demo sample workflow for local playground',
      lastSynced: wfNow,
      createdAt: wfNow,
      updatedAt: wfNow,
      isDeployed: false,
      runCount: 0,
      variables: {},
    })

    const saveResult = await saveWorkflowToNormalizedTables(workflowId, parsed.data)
    if (!saveResult.success) {
      await db.delete(workflow).where(eq(workflow.id, workflowId))
      throw new Error(`Failed to save ${wfName}: ${saveResult.error}`)
    }

    workflowLinks.push({ name: wfName, id: workflowId })
  }

  console.log('\nDemo Playground seeded successfully')
  console.log(`Workspace: ${workspaceId}`)
  for (const w of workflowLinks) {
    console.log(`  Workflow "${w.name}": ${w.id}`)
    console.log(`  → /workspace/${workspaceId}/w/${w.id}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
