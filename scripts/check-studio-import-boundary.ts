#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  buildTrace,
  type ImportClosure,
  loadWorkspacePackages,
  type ResolverContext,
  traceImportClosure,
} from './check-home-import-boundary'

const REPO_ROOT = path.resolve(import.meta.dir, '..')
const APP_ROOT = path.join(REPO_ROOT, 'apps/sim')

const ENTRYPOINTS = [
  'app/workspace/[workspaceId]/w/[workflowId]/workflow.tsx',
  'app/workspace/[workspaceId]/w/[workflowId]/layout.tsx',
] as const

const API_ENTRYPOINTS = [
  {
    path: 'app/api/folders/route.ts',
    maxStaticModules: 35,
    maxModules: 40,
    forbiddenFiles: [
      'blocks/registry.ts',
      'lib/workflows/defaults.ts',
      'lib/workflows/orchestration/folder-lifecycle.ts',
      'lib/workflows/utils.ts',
      'triggers/registry.ts',
    ],
  },
  {
    path: 'app/api/workflows/[id]/route.ts',
    maxStaticModules: 60,
    maxModules: 300,
    forbiddenFiles: [
      'blocks/registry.ts',
      'lib/workflows/defaults.ts',
      'lib/workflows/orchestration/index.ts',
      'lib/workflows/orchestration/workflow-lifecycle.ts',
      'lib/workflows/persistence/utils.ts',
      'triggers/registry.ts',
    ],
  },
] as const

const FORBIDDEN_FILES = [
  'app/workspace/[workspaceId]/home/components/mothership-view/mothership-view.tsx',
  'lib/copilot/integration-tools.ts',
  'tools/client-registry.ts',
  'tools/client-tool-params.generated.json',
  'tools/index.ts',
  'tools/registry.ts',
] as const

const FORBIDDEN_PREFIXES = [
  'app/workspace/[workspaceId]/home/components/mothership-view/components/resource-content/',
  'app/workspace/[workspaceId]/tables/[tableId]/',
  'executor/handlers/',
  'lib/pptx-renderer/',
] as const

const DYNAMIC_FORBIDDEN_FILES = [
  'app/workspace/[workspaceId]/home/components/index.ts',
  'app/workspace/[workspaceId]/home/components/mothership-view/mothership-view.tsx',
] as const

const DYNAMIC_FORBIDDEN_PREFIXES = [
  'app/workspace/[workspaceId]/home/components/mothership-view/components/resource-content/',
  'app/workspace/[workspaceId]/tables/[tableId]/',
  'lib/pptx-renderer/',
] as const

function relative(filePath: string): string {
  return path.relative(REPO_ROOT, filePath)
}

function isForbidden(filePath: string): boolean {
  const appRelativePath = path.relative(APP_ROOT, filePath)
  return (
    FORBIDDEN_FILES.some((candidate) => candidate === appRelativePath) ||
    FORBIDDEN_PREFIXES.some((prefix) => appRelativePath.startsWith(prefix))
  )
}

function isDynamicForbidden(filePath: string): boolean {
  const appRelativePath = path.relative(APP_ROOT, filePath)
  return (
    DYNAMIC_FORBIDDEN_FILES.some((candidate) => candidate === appRelativePath) ||
    DYNAMIC_FORBIDDEN_PREFIXES.some((prefix) => appRelativePath.startsWith(prefix))
  )
}

function isForbiddenEntry(
  filePath: string,
  parents: ImportClosure['parents'],
  predicate: (candidate: string) => boolean
): boolean {
  const parent = parents.get(filePath)?.importer
  return !parent || !predicate(parent)
}

function run(): number {
  const context: ResolverContext = {
    appRoot: APP_ROOT,
    repoRoot: REPO_ROOT,
    workspacePackages: loadWorkspacePackages(REPO_ROOT),
  }
  let failed = false

  for (const relativeEntry of ENTRYPOINTS) {
    const entry = path.join(APP_ROOT, relativeEntry)
    if (!existsSync(entry)) throw new Error(`entrypoint not found: ${relative(entry)}`)

    const closure = traceImportClosure(entry, context)
    const dynamicClosure = traceImportClosure(entry, context, { includeDynamicImports: true })
    console.log(
      `  ${relative(entry)}: ${closure.files.size} local modules (static), ${dynamicClosure.files.size} local modules (static + literal dynamic)`
    )

    for (const target of [...closure.files]
      .filter(
        (filePath) =>
          isForbidden(filePath) && isForbiddenEntry(filePath, closure.parents, isForbidden)
      )
      .sort()) {
      failed = true
      console.error(`  ${relative(entry)} reaches forbidden ${relative(target)}:`)
      for (const filePath of buildTrace(entry, target, closure.parents)) {
        console.error(`    ${relative(filePath)}`)
      }
    }

    for (const target of [...dynamicClosure.files]
      .filter(
        (filePath) =>
          !closure.files.has(filePath) &&
          isDynamicForbidden(filePath) &&
          isForbiddenEntry(filePath, dynamicClosure.parents, isDynamicForbidden)
      )
      .sort()) {
      failed = true
      console.error(`  ${relative(entry)} dynamically reaches forbidden ${relative(target)}:`)
      for (const filePath of buildTrace(entry, target, dynamicClosure.parents)) {
        console.error(`    ${relative(filePath)}`)
      }
    }

    for (const item of dynamicClosure.unresolved) {
      failed = true
      console.error(
        `  unresolved ${relative(item.importer)}:${item.edge.line} -> ${item.edge.specifier} (${item.reason})`
      )
    }
  }

  for (const config of API_ENTRYPOINTS) {
    const entry = path.join(APP_ROOT, config.path)
    if (!existsSync(entry)) throw new Error(`entrypoint not found: ${relative(entry)}`)

    const staticClosure = traceImportClosure(entry, context)
    const dynamicClosure = traceImportClosure(entry, context, { includeDynamicImports: true })
    console.log(
      `  ${relative(entry)}: ${staticClosure.files.size} local modules (static; maximum ${config.maxStaticModules}), ${dynamicClosure.files.size} local modules (static + literal dynamic; maximum ${config.maxModules})`
    )

    if (staticClosure.files.size > config.maxStaticModules) {
      failed = true
      console.error(
        `  ${relative(entry)} exceeds its static import budget: ${staticClosure.files.size} > ${config.maxStaticModules}`
      )
    }

    if (dynamicClosure.files.size > config.maxModules) {
      failed = true
      console.error(
        `  ${relative(entry)} exceeds its static + dynamic import budget: ${dynamicClosure.files.size} > ${config.maxModules}`
      )
    }

    for (const target of [...dynamicClosure.files]
      .filter((filePath) =>
        (config.forbiddenFiles as readonly string[]).includes(path.relative(APP_ROOT, filePath))
      )
      .sort()) {
      failed = true
      console.error(`  ${relative(entry)} reaches forbidden ${relative(target)}:`)
      for (const filePath of buildTrace(entry, target, dynamicClosure.parents)) {
        console.error(`    ${relative(filePath)}`)
      }
    }

    for (const item of dynamicClosure.unresolved) {
      failed = true
      console.error(
        `  unresolved ${relative(item.importer)}:${item.edge.line} -> ${item.edge.specifier} (${item.reason})`
      )
    }
  }

  console.log(`Studio import boundary ${failed ? 'FAILED' : 'OK'}`)
  return failed ? 1 : 0
}

try {
  process.exitCode = run()
} catch (error) {
  console.error('Studio import boundary check failed:', error)
  process.exitCode = 1
}
