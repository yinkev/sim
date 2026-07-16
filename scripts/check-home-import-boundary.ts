#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const REPO_ROOT = path.resolve(import.meta.dir, '..')
const APP_ROOT = path.join(REPO_ROOT, 'apps/sim')

const ENTRYPOINTS = [
  { path: 'app/workspace/[workspaceId]/home/home-runtime.tsx' },
  {
    path: 'app/workspace/[workspaceId]/chat/new/new-chat-runtime.tsx',
    includeDynamicImports: true,
  },
  { path: 'app/workspace/[workspaceId]/home/components/user-input/user-input.tsx' },
  { path: 'app/workspace/[workspaceId]/home/components/mothership-chat/mothership-chat.tsx' },
] as const

const FORBIDDEN_PATHS = [
  'blocks/registry.ts',
  'tools/registry.ts',
  'triggers/registry.ts',
  'lib/integrations/client-catalog.ts',
  'lib/integrations/icon-mapping.ts',
  'lib/integrations/integrations.json',
  'components/icons.tsx',
] as const

const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.svg',
] as const

const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/

export type ModuleEdgeKind = 'import' | 're-export' | 'require' | 'dynamic-import'

export interface ModuleSpecifier {
  kind: ModuleEdgeKind
  line: number
  specifier: string
}

interface CollectModuleSpecifierOptions {
  includeDynamicImports?: boolean
}

export interface WorkspacePackage {
  exports?: unknown
  packageRoot: string
}

export interface ResolverContext {
  appRoot: string
  repoRoot: string
  workspacePackages: Map<string, WorkspacePackage>
}

interface ResolvedModule {
  kind: 'local'
  path: string
}

interface ExternalModule {
  kind: 'external'
}

interface UnresolvedLocalModule {
  kind: 'unresolved-local'
  reason: string
}

type ModuleResolution = ResolvedModule | ExternalModule | UnresolvedLocalModule

interface ParentEdge {
  edge: ModuleSpecifier
  importer: string
}

interface UnresolvedLocalImport {
  edge: ModuleSpecifier
  importer: string
  reason: string
}

export interface ImportClosure {
  files: Set<string>
  parents: Map<string, ParentEdge>
  unresolved: UnresolvedLocalImport[]
}

interface BoundaryViolation {
  entry: string
  target: string
  trace: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasRuntimeImport(importClause: ts.ImportClause | undefined): boolean {
  if (!importClause) return true
  if (importClause.isTypeOnly) return false
  if (importClause.name) return true

  const bindings = importClause.namedBindings
  if (!bindings) return false
  if (ts.isNamespaceImport(bindings)) return true
  return bindings.elements.some((element) => !element.isTypeOnly)
}

export function collectModuleSpecifiers(
  sourceText: string,
  fileName = 'source.ts',
  options: CollectModuleSpecifierOptions = {}
): ModuleSpecifier[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true)
  const edges: ModuleSpecifier[] = []
  const seen = new Set<string>()

  function addEdge(node: ts.Node, kind: ModuleEdgeKind, specifier: ts.StringLiteralLike): void {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
    const key = `${kind}:${line}:${specifier.text}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ kind, line, specifier: specifier.text })
  }

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier) &&
      hasRuntimeImport(statement.importClause)
    ) {
      addEdge(statement, 'import', statement.moduleSpecifier)
      continue
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteralLike(statement.moduleSpecifier) &&
      !statement.isTypeOnly
    ) {
      const exportsOnlyTypes =
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.every((element) => element.isTypeOnly)

      if (!exportsOnlyTypes) {
        addEdge(statement, 're-export', statement.moduleSpecifier)
      }
      continue
    }

    if (
      ts.isImportEqualsDeclaration(statement) &&
      !statement.isTypeOnly &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteralLike(statement.moduleReference.expression)
    ) {
      addEdge(statement, 'require', statement.moduleReference.expression)
    }
  }

  function visit(node: ts.Node): void {
    if (
      options.includeDynamicImports &&
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      addEdge(node, 'dynamic-import', node.arguments[0])
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      addEdge(node, 'require', node.arguments[0])
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return edges
}

/** Returns compile-time module edges while deliberately excluding dynamic imports. */
export function collectStaticModuleSpecifiers(
  sourceText: string,
  fileName = 'source.ts'
): ModuleSpecifier[] {
  return collectModuleSpecifiers(sourceText, fileName)
}

function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

function resolveFile(basePath: string): string | undefined {
  if (isFile(basePath)) return path.normalize(basePath)

  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = `${basePath}${extension}`
    if (isFile(candidate)) return path.normalize(candidate)
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = path.join(basePath, `index${extension}`)
    if (isFile(candidate)) return path.normalize(candidate)
  }

  return undefined
}

function selectConditionalExport(value: unknown): string | undefined {
  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    for (const candidate of value) {
      const selected = selectConditionalExport(candidate)
      if (selected) return selected
    }
    return undefined
  }

  if (!isRecord(value)) return undefined

  const preferredConditions = ['default', 'import', 'bun', 'node', 'browser', 'types'] as const
  for (const condition of preferredConditions) {
    const selected = selectConditionalExport(value[condition])
    if (selected) return selected
  }

  for (const candidate of Object.values(value)) {
    const selected = selectConditionalExport(candidate)
    if (selected) return selected
  }

  return undefined
}

function selectPackageExport(exportsField: unknown, subpath: string): string | undefined {
  if (typeof exportsField === 'string' || Array.isArray(exportsField)) {
    return subpath === '.' ? selectConditionalExport(exportsField) : undefined
  }
  if (!isRecord(exportsField)) return undefined

  const hasSubpathKeys = Object.keys(exportsField).some((key) => key.startsWith('.'))
  if (!hasSubpathKeys) {
    return subpath === '.' ? selectConditionalExport(exportsField) : undefined
  }

  const exact = selectConditionalExport(exportsField[subpath])
  if (exact) return exact

  const wildcardKeys = Object.keys(exportsField)
    .filter((key) => key.includes('*'))
    .sort((left, right) => right.length - left.length)

  for (const key of wildcardKeys) {
    const [prefix, suffix = ''] = key.split('*')
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) continue

    const wildcardValue = subpath.slice(prefix.length, subpath.length - suffix.length)
    const target = selectConditionalExport(exportsField[key])
    if (target) return target.replaceAll('*', wildcardValue)
  }

  return undefined
}

export function loadWorkspacePackages(repoRoot: string): Map<string, WorkspacePackage> {
  const packagesRoot = path.join(repoRoot, 'packages')
  const packages = new Map<string, WorkspacePackage>()
  if (!existsSync(packagesRoot)) return packages

  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const packageRoot = path.join(packagesRoot, entry.name)
    const manifestPath = path.join(packageRoot, 'package.json')
    if (!isFile(manifestPath)) continue

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown
    if (!isRecord(manifest) || typeof manifest.name !== 'string') continue

    packages.set(manifest.name, {
      exports: manifest.exports,
      packageRoot,
    })
  }

  return packages
}

function resolveWorkspacePackage(specifier: string, context: ResolverContext): ModuleResolution {
  const parts = specifier.split('/')
  const packageName = parts.slice(0, 2).join('/')
  const workspacePackage = context.workspacePackages.get(packageName)
  if (!workspacePackage) {
    return {
      kind: 'unresolved-local',
      reason: `workspace package ${packageName} was not found`,
    }
  }

  const subpath = parts.length === 2 ? '.' : `./${parts.slice(2).join('/')}`
  const exportTarget = selectPackageExport(workspacePackage.exports, subpath)
  if (!exportTarget) {
    return {
      kind: 'unresolved-local',
      reason: `${packageName} does not export ${subpath}`,
    }
  }

  const resolved = resolveFile(path.resolve(workspacePackage.packageRoot, exportTarget))
  return resolved
    ? { kind: 'local', path: resolved }
    : {
        kind: 'unresolved-local',
        reason: `${packageName} export ${subpath} points to missing ${exportTarget}`,
      }
}

function resolveModuleSpecifier(
  importer: string,
  specifier: string,
  context: ResolverContext
): ModuleResolution {
  let basePath: string | undefined

  if (specifier.startsWith('@/')) {
    basePath = path.join(context.appRoot, specifier.slice(2))
  } else if (specifier.startsWith('.')) {
    basePath = path.resolve(path.dirname(importer), specifier)
  } else if (specifier.startsWith('@sim/')) {
    return resolveWorkspacePackage(specifier, context)
  } else if (specifier.startsWith('#') || specifier.startsWith('/')) {
    return {
      kind: 'unresolved-local',
      reason: 'unsupported local alias',
    }
  } else {
    return { kind: 'external' }
  }

  const resolved = resolveFile(basePath)
  return resolved
    ? { kind: 'local', path: resolved }
    : { kind: 'unresolved-local', reason: `no source file found at ${basePath}` }
}

export function traceImportClosure(
  entry: string,
  context: ResolverContext,
  options: CollectModuleSpecifierOptions = {}
): ImportClosure {
  const files = new Set<string>([entry])
  const parents = new Map<string, ParentEdge>()
  const unresolved: UnresolvedLocalImport[] = []
  const unresolvedKeys = new Set<string>()
  const queue = [entry]

  for (let index = 0; index < queue.length; index++) {
    const importer = queue[index]
    if (!CODE_FILE_PATTERN.test(importer)) continue

    const sourceText = readFileSync(importer, 'utf8')
    const edges = collectModuleSpecifiers(sourceText, importer, options)

    for (const edge of edges) {
      const resolution = resolveModuleSpecifier(importer, edge.specifier, context)
      if (resolution.kind === 'external') continue

      if (resolution.kind === 'unresolved-local') {
        const key = `${importer}:${edge.line}:${edge.specifier}`
        if (!unresolvedKeys.has(key)) {
          unresolvedKeys.add(key)
          unresolved.push({ edge, importer, reason: resolution.reason })
        }
        continue
      }

      if (files.has(resolution.path)) continue
      files.add(resolution.path)
      parents.set(resolution.path, { edge, importer })
      queue.push(resolution.path)
    }
  }

  return { files, parents, unresolved }
}

export function buildTrace(
  entry: string,
  target: string,
  parents: Map<string, ParentEdge>
): string[] {
  const trace = [target]
  let current = target

  while (current !== entry) {
    const parent = parents.get(current)
    if (!parent) break
    current = parent.importer
    trace.push(current)
  }

  return trace.reverse()
}

function relative(filePath: string): string {
  return path.relative(REPO_ROOT, filePath)
}

function run(): number {
  const context: ResolverContext = {
    appRoot: APP_ROOT,
    repoRoot: REPO_ROOT,
    workspacePackages: loadWorkspacePackages(REPO_ROOT),
  }
  const targets = FORBIDDEN_PATHS.map((target) => path.join(APP_ROOT, target))
  const results = ENTRYPOINTS.map((entrypoint) => {
    const entry = path.join(APP_ROOT, entrypoint.path)
    if (!isFile(entry)) {
      throw new Error(`entrypoint not found: ${relative(entry)}`)
    }
    return {
      closure: traceImportClosure(entry, context, {
        includeDynamicImports: 'includeDynamicImports' in entrypoint,
      }),
      entry,
      includeDynamicImports: 'includeDynamicImports' in entrypoint,
    }
  })

  const violations: BoundaryViolation[] = []
  for (const { closure, entry } of results) {
    for (const target of targets) {
      if (!closure.files.has(target)) continue
      violations.push({
        entry,
        target,
        trace: buildTrace(entry, target, closure.parents),
      })
    }
  }

  const unresolved = results.flatMap(({ closure }) => closure.unresolved)
  const failed = violations.length > 0 || unresolved.length > 0

  console.log(`Home import boundary ${failed ? 'FAILED' : 'OK'}`)
  for (const { closure, entry, includeDynamicImports } of results) {
    const scope = includeDynamicImports ? 'static + literal dynamic' : 'static'
    console.log(`  ${relative(entry)}: ${closure.files.size} local modules (${scope})`)
  }

  for (const violation of violations) {
    console.error(`  ${relative(violation.entry)} reaches ${relative(violation.target)}:`)
    for (const filePath of violation.trace) {
      console.error(`    ${relative(filePath)}`)
    }
  }

  for (const item of unresolved.sort((left, right) => {
    const importerOrder = left.importer.localeCompare(right.importer)
    return importerOrder || left.edge.line - right.edge.line
  })) {
    console.error(
      `  unresolved ${relative(item.importer)}:${item.edge.line} -> ${item.edge.specifier} (${item.reason})`
    )
  }

  if (!failed) {
    console.log(`  forbidden registries unreachable: ${FORBIDDEN_PATHS.join(', ')}`)
  }

  return failed ? 1 : 0
}

if (import.meta.main) {
  try {
    process.exitCode = run()
  } catch (error) {
    console.error('Home import boundary check failed:', error)
    process.exitCode = 1
  }
}
