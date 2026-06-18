import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import type {
  CallDef,
  ClassDef,
  ExtractParams,
  ExtractResult,
  FileEntry,
  FileSummary,
  FunctionDef,
  GraphEdge,
  GraphNode,
  GraphParams,
  ImportDef,
  KnowledgeGraph,
  ParsedFile,
  ParseParams,
  ParseResult,
  Relationship,
  ScanParams,
  ScanResult,
  ViewParams,
} from '@/tools/understand/types'

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
  '__pycache__',
]

const DEFAULT_MAX_FILES = 5000
const DEFAULT_MAX_FILE_BYTES = 512 * 1024

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
}

const CODE_EXTENSIONS = Object.keys(LANGUAGE_BY_EXTENSION)
const CALL_SKIP_WORDS = new Set([
  'catch',
  'class',
  'do',
  'for',
  'function',
  'if',
  'import',
  'new',
  'return',
  'switch',
  'while',
])
const PARSED_DERIVED_RELATIONSHIP_TYPES = new Set<Relationship['type']>([
  'calls',
  'defines',
  'extends',
  'implements',
  'imports',
])

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function parseJsonInput<T>(value: string | T, label: string): T {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as T
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${(error as Error).message}`)
  }
}

function normalizeIgnorePatterns(patterns: ScanParams['ignorePatterns']): string[] {
  if (!patterns) return DEFAULT_IGNORE_PATTERNS
  if (Array.isArray(patterns)) return patterns.filter(Boolean)
  return patterns
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function shouldIgnore(relativePath: string, ignorePatterns: string[]): boolean {
  const normalized = relativePath.split(path.sep).join('/')
  const parts = normalized.split('/')

  return ignorePatterns.some((rawPattern) => {
    const pattern = rawPattern.trim().replaceAll('\\', '/')
    if (!pattern) return false
    if (parts.includes(pattern)) return true
    if (!pattern.includes('*')) return normalized.includes(pattern)

    const wildcard = pattern.split('*').map(escapeRegExp).join('.*')
    return (
      new RegExp(`(^|/)${wildcard}($|/)`).test(normalized) || new RegExp(wildcard).test(normalized)
    )
  })
}

function detectLanguage(filePath: string): string {
  return LANGUAGE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'text'
}

function countLines(content: string): number {
  if (!content) return 0
  return content.split('\n').length
}

async function readTextFile(filePath: string, maxBytes: number): Promise<string> {
  const fileStat = await stat(filePath)
  if (fileStat.size > maxBytes) return ''
  return readFile(filePath, 'utf8')
}

function lineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

function sourceLine(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function compactSignature(value: string): string {
  const signature =
    value.split('{')[0]?.trim().replace(/\s+/g, ' ') || value.trim().replace(/\s+/g, ' ')
  return signature.length > 240 ? `${signature.slice(0, 237)}...` : signature
}

function declarationName(
  name: ts.BindingName | ts.PropertyName | ts.PrivateIdentifier | undefined,
  source: ts.SourceFile
): string | undefined {
  if (!name) return undefined
  if (ts.isIdentifier(name)) return name.text
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return name.getText(source)
}

function scriptKindFor(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath).toLowerCase()) {
    case '.tsx':
      return ts.ScriptKind.TSX
    case '.jsx':
      return ts.ScriptKind.JSX
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS
    default:
      return ts.ScriptKind.TS
  }
}

function isTypeScriptLike(language: string): boolean {
  return language === 'typescript' || language === 'javascript'
}

function importNames(node: ts.ImportDeclaration, source: ts.SourceFile): string[] {
  const clause = node.importClause
  if (!clause) return []

  const names: string[] = []
  if (clause.name) names.push(clause.name.text)
  if (clause.namedBindings) {
    if (ts.isNamespaceImport(clause.namedBindings)) {
      names.push(clause.namedBindings.name.text)
    } else {
      names.push(...clause.namedBindings.elements.map((element) => element.name.text))
    }
  }

  return names.length > 0 ? names : [node.moduleSpecifier.getText(source)]
}

function exportNames(node: ts.ExportDeclaration): string[] {
  if (!node.exportClause) return []
  if (ts.isNamespaceExport(node.exportClause)) return [node.exportClause.name.text]
  return node.exportClause.elements.map((element) => element.name.text)
}

function heritageNames(
  node: ts.ClassDeclaration | ts.ClassExpression,
  token: ts.SyntaxKind
): string[] {
  return (
    node.heritageClauses
      ?.filter((clause) => clause.token === token)
      .flatMap((clause) => clause.types.map((item) => item.expression.getText())) ?? []
  )
}

function callTargetName(expression: ts.Expression, source: ts.SourceFile): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.getText(source)
  if (ts.isElementAccessExpression(expression)) return expression.expression.getText(source)
  return undefined
}

function mergeImports(imports: ImportDef[], next: ImportDef): void {
  const existing = imports.find((item) => item.path === next.path)
  if (!existing) {
    imports.push(next)
    return
  }

  for (const name of next.names) {
    if (!existing.names.includes(name)) existing.names.push(name)
  }
}

function parseTypeScriptFile(file: FileEntry, content: string): ParsedFile {
  const source = ts.createSourceFile(
    file.path,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file.path)
  )
  const imports: ImportDef[] = []
  const functions: FunctionDef[] = []
  const calls: CallDef[] = []
  const classByName = new Map<string, ClassDef>()
  const scopeStack: string[] = [file.path]
  const classStack: string[] = []

  function currentScope(): string {
    return scopeStack[scopeStack.length - 1] ?? file.path
  }

  function addFunction(name: string, node: ts.Node): void {
    const line = sourceLine(source, node)
    if (functions.some((item) => item.name === name && item.line === line)) return
    functions.push({
      name,
      line,
      signature: compactSignature(node.getText(source)),
    })
  }

  function addClass(name: string, node: ts.ClassDeclaration | ts.ClassExpression): ClassDef {
    const existing = classByName.get(name)
    if (existing) return existing

    const classDef: ClassDef = {
      name,
      line: sourceLine(source, node),
      methods: [],
      extends: heritageNames(node, ts.SyntaxKind.ExtendsKeyword),
      implements: heritageNames(node, ts.SyntaxKind.ImplementsKeyword),
    }
    classByName.set(name, classDef)
    return classDef
  }

  function addCall(to: string, node: ts.Node): void {
    const normalized = to.trim()
    const rootName = normalized.split('.')[0]
    if (!normalized || (rootName && CALL_SKIP_WORDS.has(rootName))) return

    calls.push({
      from: currentScope(),
      to: normalized,
      line: sourceLine(source, node),
    })
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      mergeImports(imports, { path: node.moduleSpecifier.text, names: importNames(node, source) })
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      mergeImports(imports, { path: node.moduleSpecifier.text, names: exportNames(node) })
    }

    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const name = declarationName(node.name, source)
      if (name) {
        addClass(name, node)
        classStack.push(name)
        scopeStack.push(name)
        ts.forEachChild(node, visit)
        scopeStack.pop()
        classStack.pop()
        return
      }
    }

    if (ts.isFunctionDeclaration(node)) {
      const name = declarationName(node.name, source)
      if (name) {
        addFunction(name, node)
        scopeStack.push(name)
        ts.forEachChild(node, visit)
        scopeStack.pop()
        return
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      const name = node.name.text
      addFunction(name, node)
      scopeStack.push(name)
      ts.forEachChild(node.initializer, visit)
      scopeStack.pop()
      return
    }

    if (
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      const methodName = declarationName(node.name, source)
      const className = classStack[classStack.length - 1]
      const functionName = className && methodName ? `${className}.${methodName}` : methodName

      if (functionName) {
        addFunction(functionName, node)
        if (className && methodName) {
          const classDef = classByName.get(className)
          if (classDef && !classDef.methods.includes(methodName)) classDef.methods.push(methodName)
        }
        scopeStack.push(functionName)
        ts.forEachChild(node, visit)
        scopeStack.pop()
        return
      }
    }

    if (ts.isConstructorDeclaration(node)) {
      const className = classStack[classStack.length - 1]
      const functionName = className ? `${className}.constructor` : 'constructor'
      addFunction(functionName, node)
      if (className) {
        const classDef = classByName.get(className)
        if (classDef && !classDef.methods.includes('constructor'))
          classDef.methods.push('constructor')
      }
      scopeStack.push(functionName)
      ts.forEachChild(node, visit)
      scopeStack.pop()
      return
    }

    if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        mergeImports(imports, { path: node.arguments[0].text, names: [] })
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        mergeImports(imports, { path: node.arguments[0].text, names: [] })
      } else {
        const target = callTargetName(node.expression, source)
        if (target) addCall(target, node)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)

  return {
    path: file.path,
    language: file.language,
    functions,
    classes: Array.from(classByName.values()),
    imports,
    calls,
  }
}

function extractImportsByRegex(content: string, language: string): ImportDef[] {
  const imports: ImportDef[] = []
  const patterns =
    language === 'python'
      ? [/^\s*import\s+([A-Za-z0-9_.,\s]+)/gm, /^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+(.+)$/gm]
      : [
          /^\s*import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm,
          /^\s*import\s+['"]([^'"]+)['"]/gm,
          /^\s*use\s+([A-Za-z0-9_:]+)/gm,
          /^\s*package\s+([A-Za-z0-9_.]+)/gm,
        ]

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const importPath = match[1]?.trim()
      if (!importPath) continue
      const names =
        match[2]
          ?.split(',')
          .map((name) => name.trim())
          .filter(Boolean) ?? []
      mergeImports(imports, { path: importPath, names })
    }
  }
  return imports
}

function extractFunctionsByRegex(content: string, language: string): FunctionDef[] {
  const functions: FunctionDef[] = []
  const patterns =
    language === 'python'
      ? [/^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/gm]
      : [
          /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)/gm,
          /^\s*(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/gm,
          /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/gm,
          /^\s*(?:pub\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/gm,
          /^\s*(?:public|private|protected|static|async|final|\s)+[\w<>[\],.?]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/gm,
        ]

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const name = match[1]
      if (!name || CALL_SKIP_WORDS.has(name)) continue
      const signature = match[0].trim().replace(/\s+/g, ' ')
      functions.push({ name, line: lineNumber(content, match.index ?? 0), signature })
    }
  }
  return functions
}

function extractClassesByRegex(content: string, language: string): ClassDef[] {
  const classes: ClassDef[] = []
  const patterns =
    language === 'python'
      ? [/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?:/gm]
      : [
          /^\s*(?:export\s+)?(?:public\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s+extends\s+([A-Za-z_$][A-Za-z0-9_$.]*))?(?:\s+implements\s+([^{]+))?/gm,
          /^\s*(?:public\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm,
        ]

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const name = match[1]
      if (!name) continue
      const methods =
        language === 'python'
          ? Array.from(
              content.slice(match.index ?? 0).matchAll(/^\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)
            ).map((method) => method[1] ?? '')
          : []
      classes.push({
        name,
        line: lineNumber(content, match.index ?? 0),
        methods: methods.filter(Boolean),
        extends: match[2] ? [match[2].trim()] : undefined,
        implements: match[3]
          ?.split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
    }
  }
  return classes
}

function extractCallsByRegex(content: string, functions: FunctionDef[]): CallDef[] {
  const calls: CallDef[] = []
  const callPattern = /\b([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)?)\s*\(/g

  for (const match of content.matchAll(callPattern)) {
    const target = match[1]
    const rootName = target?.split('.')[0]
    if (!target || (rootName && CALL_SKIP_WORDS.has(rootName))) continue

    const line = lineNumber(content, match.index ?? 0)
    const owner = ownerFunctionAtLine(functions, line)
    if (owner?.name === target) continue
    calls.push({ from: owner?.name ?? 'file', to: target, line })
  }
  return calls
}

function ownerFunctionAtLine(functions: FunctionDef[], line: number): FunctionDef | undefined {
  let owner: FunctionDef | undefined
  for (const func of functions) {
    if (func.line <= line) owner = func
  }
  return owner
}

function parseFallbackFile(file: FileEntry, content: string): ParsedFile {
  const functions = extractFunctionsByRegex(content, file.language)
  return {
    path: file.path,
    language: file.language,
    functions,
    classes: extractClassesByRegex(content, file.language),
    imports: extractImportsByRegex(content, file.language),
    calls: extractCallsByRegex(content, functions),
  }
}

function normalizeScanInput(input: GraphParams['scanResult']): ScanResult | undefined {
  if (!input) return undefined
  const parsed = parseJsonInput<ScanResult>(input, 'scanResult')
  return isRecord(parsed) && Array.isArray(parsed.files) ? parsed : undefined
}

function normalizeParsedFile(file: ParsedFile): ParsedFile {
  const record = file as ParsedFile & { calls?: unknown }
  return {
    ...file,
    calls: Array.isArray(record.calls) ? record.calls : [],
  }
}

function normalizeParsedInput(
  input: ExtractParams['parsedData'] | GraphParams['parsedData']
): ParseResult {
  const parsed = parseJsonInput<ParseResult | ParsedFile[]>(input ?? [], 'parsedData')
  if (Array.isArray(parsed)) {
    return flattenParsedFiles(parsed.map(normalizeParsedFile))
  }
  if (isRecord(parsed) && Array.isArray(parsed.files)) {
    return flattenParsedFiles((parsed.files as ParsedFile[]).map(normalizeParsedFile))
  }
  throw new Error('parsedData must be a ParseResult or array of parsed files')
}

function normalizeParseFilesInput(input: ParseParams['files']): FileEntry[] {
  const parsed = parseJsonInput<ScanResult | FileEntry[]>(input, 'files')
  if (Array.isArray(parsed)) return parsed
  if (isRecord(parsed) && Array.isArray(parsed.files)) return parsed.files
  throw new Error('files must be a ScanResult or array of file entries')
}

function flattenParsedFiles(files: ParsedFile[]): ParseResult {
  return {
    files,
    functions: files.flatMap((file) =>
      file.functions.map((item) => ({ ...item, path: file.path }))
    ),
    classes: files.flatMap((file) => file.classes.map((item) => ({ ...item, path: file.path }))),
    imports: files.flatMap((file) => file.imports.map((item) => ({ ...item, from: file.path }))),
    calls: files.flatMap((file) => file.calls.map((item) => ({ ...item, path: file.path }))),
  }
}

function nodeId(type: string, filePath: string, label?: string): string {
  return [type, filePath, label].filter(Boolean).join(':')
}

function projectGraphPath(projectName: string): string {
  const home = process.env.HOME || process.cwd()
  return path.join(home, '.prism', 'graphs', projectName, 'knowledge-graph.json')
}

function safeProjectName(rootPath?: string, explicitName?: string): string {
  if (explicitName?.trim()) return explicitName.trim().replace(/[^A-Za-z0-9_.-]/g, '-')
  const base = rootPath ? path.basename(rootPath) : 'project'
  return base.replace(/[^A-Za-z0-9_.-]/g, '-') || 'project'
}

function commonRoot(paths: string[]): string {
  if (paths.length === 0) return process.cwd()
  const splitPaths = paths.map((item) => path.resolve(item).split(path.sep))
  const first = splitPaths[0] ?? []
  const common: string[] = []

  for (let index = 0; index < first.length; index += 1) {
    const segment = first[index]
    if (splitPaths.every((parts) => parts[index] === segment)) common.push(segment ?? '')
    else break
  }

  const root = common.join(path.sep)
  return root || path.sep
}

function graphSummaryForFile(parsedFile: ParsedFile): string {
  const parts = [
    `${parsedFile.language} file`,
    `${parsedFile.functions.length} functions`,
    `${parsedFile.classes.length} classes`,
    `${parsedFile.imports.length} imports`,
    `${parsedFile.calls.length} calls`,
  ]
  return parts.join(', ')
}

function edgeKey(edge: GraphEdge): string {
  return `${edge.from}\n${edge.to}\n${edge.type}`
}

function addEdge(edges: GraphEdge[], edgeSet: Set<string>, edge: GraphEdge): void {
  const key = edgeKey(edge)
  if (edgeSet.has(key)) return
  edgeSet.add(key)
  edges.push(edge)
}

function addExternalNode(nodeMap: Map<string, GraphNode>, id: string): void {
  if (nodeMap.has(id)) return
  const label = id.startsWith('external:') ? id.slice('external:'.length) : id
  nodeMap.set(id, { id, type: 'external', path: label, label })
}

function resolveImportNodeId(
  importPath: string,
  fromFilePath: string,
  fileIdByPath: Map<string, string>
): string {
  if (!importPath.startsWith('.')) return nodeId('external', importPath)

  const basePath = path.resolve(path.dirname(fromFilePath), importPath)
  const candidates = [
    basePath,
    ...CODE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...CODE_EXTENSIONS.map((extension) => path.join(basePath, `index${extension}`)),
  ]

  for (const candidate of candidates) {
    const resolved = fileIdByPath.get(path.resolve(candidate))
    if (resolved) return resolved
  }

  return nodeId('external', importPath)
}

function localCallTarget(
  call: CallDef,
  filePath: string,
  functionIdsByFile: Map<string, Map<string, string>>,
  globalFunctionIds: Map<string, string[]>
): string {
  const localFunctions = functionIdsByFile.get(filePath)
  const exactLocal = localFunctions?.get(call.to)
  if (exactLocal) return exactLocal

  const shortName = call.to.split('.').at(-1) ?? call.to
  const shortLocal = localFunctions?.get(shortName)
  if (shortLocal) return shortLocal

  const globalMatches = globalFunctionIds.get(call.to) ?? globalFunctionIds.get(shortName)
  if (globalMatches?.length === 1) return globalMatches[0] ?? nodeId('external', call.to)

  return nodeId('external', call.to)
}

function sourceCallNodeId(
  call: CallDef,
  filePath: string,
  functionIdsByFile: Map<string, Map<string, string>>
): string {
  const localFunctions = functionIdsByFile.get(filePath)
  if (call.from === filePath || call.from === 'file') return nodeId('file', filePath)
  return localFunctions?.get(call.from) ?? nodeId('file', filePath)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function scanCodebase(params: ScanParams): Promise<ScanResult> {
  const rootPath = path.resolve(params.rootPath)
  const ignorePatterns = normalizeIgnorePatterns(params.ignorePatterns)
  const maxFiles = params.maxFiles ?? DEFAULT_MAX_FILES
  const maxFileBytes = params.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
  const files: FileEntry[] = []
  let skippedFiles = 0

  async function walk(currentPath: string): Promise<void> {
    if (files.length >= maxFiles) return
    const entries = (await readdir(currentPath, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name)
    )

    for (const entry of entries) {
      if (files.length >= maxFiles) return
      const fullPath = path.join(currentPath, entry.name)
      const relativePath = path.relative(rootPath, fullPath)
      if (shouldIgnore(relativePath, ignorePatterns)) continue

      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (!entry.isFile()) continue
      const language = detectLanguage(fullPath)
      if (language === 'text') continue

      const fileStat = await stat(fullPath)
      let lines = 0
      if (fileStat.size <= maxFileBytes) {
        lines = countLines(await readTextFile(fullPath, maxFileBytes))
      } else {
        skippedFiles += 1
      }
      files.push({ path: fullPath, language, size: fileStat.size, lines })
    }
  }

  await walk(rootPath)

  const languages: Record<string, number> = {}
  let totalLines = 0
  for (const file of files) {
    languages[file.language] = (languages[file.language] ?? 0) + 1
    totalLines += file.lines
  }

  return {
    files,
    stats: {
      totalFiles: files.length,
      totalLines,
      languages,
      skippedFiles,
    },
  }
}

export async function parseCodebase(params: ParseParams): Promise<ParseResult> {
  const files = normalizeParseFilesInput(params.files)
  const maxFileBytes = params.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
  const parsedFiles: ParsedFile[] = []

  for (const file of files) {
    const content = await readTextFile(file.path, maxFileBytes)
    if (!content) {
      parsedFiles.push({
        path: file.path,
        language: file.language,
        functions: [],
        classes: [],
        imports: [],
        calls: [],
      })
      continue
    }

    parsedFiles.push(
      isTypeScriptLike(file.language)
        ? parseTypeScriptFile(file, content)
        : parseFallbackFile(file, content)
    )
  }

  return flattenParsedFiles(parsedFiles)
}

export async function extractCodeSemantics(params: ExtractParams): Promise<ExtractResult> {
  const parsed = normalizeParsedInput(params.parsedData)
  const summaries: FileSummary[] = parsed.files.map((file) => ({
    path: file.path,
    summary: graphSummaryForFile(file),
  }))

  const relationships: Relationship[] = []
  for (const file of parsed.files) {
    const fileId = nodeId('file', file.path)
    for (const func of file.functions) {
      relationships.push({
        from: fileId,
        to: nodeId('function', file.path, func.name),
        type: 'defines',
      })
    }
    for (const cls of file.classes) {
      const classId = nodeId('class', file.path, cls.name)
      relationships.push({
        from: fileId,
        to: classId,
        type: 'defines',
      })
      for (const base of cls.extends ?? []) {
        relationships.push({ from: classId, to: nodeId('external', base), type: 'extends' })
      }
      for (const implemented of cls.implements ?? []) {
        relationships.push({
          from: classId,
          to: nodeId('external', implemented),
          type: 'implements',
        })
      }
    }
    for (const imp of file.imports) {
      relationships.push({
        from: fileId,
        to: nodeId('external', imp.path),
        type: 'imports',
      })
    }
    for (const call of file.calls) {
      relationships.push({
        from:
          call.from === file.path || call.from === 'file'
            ? fileId
            : nodeId('function', file.path, call.from),
        to: nodeId('external', call.to),
        type: 'calls',
      })
    }
  }

  return { summaries, relationships }
}

export async function buildKnowledgeGraph(params: GraphParams): Promise<{
  graph: KnowledgeGraph
  outputPath?: string
}> {
  const scanResult = normalizeScanInput(params.scanResult)
  const parsed = params.parsedData ? normalizeParsedInput(params.parsedData) : undefined
  const summaries = parseJsonInput<FileSummary[]>(params.summaries ?? [], 'summaries')
  const relationships = parseJsonInput<Relationship[]>(params.relationships ?? [], 'relationships')
  const sourceFiles = scanResult?.files ?? parsed?.files ?? []
  const root = params.rootPath
    ? path.resolve(params.rootPath)
    : commonRoot(sourceFiles.map((file) => file.path))
  const summaryByPath = new Map(summaries.map((item) => [item.path, item.summary]))
  const nodeMap = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const edgeSet = new Set<string>()
  const fileIdByPath = new Map<string, string>()
  const functionIdsByFile = new Map<string, Map<string, string>>()
  const globalFunctionIds = new Map<string, string[]>()

  for (const file of sourceFiles) {
    const id = nodeId('file', file.path)
    fileIdByPath.set(path.resolve(file.path), id)
    nodeMap.set(id, {
      id,
      type: 'file',
      path: file.path,
      label: path.relative(root, file.path) || path.basename(file.path),
      summary: summaryByPath.get(file.path),
    })
  }

  for (const file of parsed?.files ?? []) {
    const fileId = nodeId('file', file.path)
    if (!nodeMap.has(fileId)) {
      nodeMap.set(fileId, {
        id: fileId,
        type: 'file',
        path: file.path,
        label: path.relative(root, file.path) || path.basename(file.path),
        summary: summaryByPath.get(file.path),
      })
    }

    const localFunctionIds = new Map<string, string>()
    for (const func of file.functions) {
      const id = nodeId('function', file.path, func.name)
      localFunctionIds.set(func.name, id)
      globalFunctionIds.set(func.name, [...(globalFunctionIds.get(func.name) ?? []), id])
      nodeMap.set(id, { id, type: 'function', path: file.path, label: func.name })
      addEdge(edges, edgeSet, { from: fileId, to: id, type: 'defines' })
    }
    functionIdsByFile.set(file.path, localFunctionIds)

    for (const cls of file.classes) {
      const id = nodeId('class', file.path, cls.name)
      nodeMap.set(id, {
        id,
        type: 'class',
        path: file.path,
        label: cls.name,
        summary: cls.methods.length > 0 ? `${cls.methods.length} methods` : undefined,
      })
      addEdge(edges, edgeSet, { from: fileId, to: id, type: 'defines' })

      for (const base of cls.extends ?? []) {
        const targetId = nodeId('external', base)
        addExternalNode(nodeMap, targetId)
        addEdge(edges, edgeSet, { from: id, to: targetId, type: 'extends' })
      }
      for (const implemented of cls.implements ?? []) {
        const targetId = nodeId('external', implemented)
        addExternalNode(nodeMap, targetId)
        addEdge(edges, edgeSet, { from: id, to: targetId, type: 'implements' })
      }
    }
  }

  for (const file of parsed?.files ?? []) {
    const fileId = nodeId('file', file.path)
    for (const imp of file.imports) {
      const targetId = resolveImportNodeId(imp.path, file.path, fileIdByPath)
      if (targetId.startsWith('external:')) addExternalNode(nodeMap, targetId)
      addEdge(edges, edgeSet, { from: fileId, to: targetId, type: 'imports' })
    }

    for (const call of file.calls) {
      const from = sourceCallNodeId(call, file.path, functionIdsByFile)
      const to = localCallTarget(call, file.path, functionIdsByFile, globalFunctionIds)
      if (to.startsWith('external:')) addExternalNode(nodeMap, to)
      addEdge(edges, edgeSet, { from, to, type: 'calls' })
    }
  }

  for (const relationship of relationships) {
    if (parsed && PARSED_DERIVED_RELATIONSHIP_TYPES.has(relationship.type)) continue
    if (relationship.from.startsWith('external:')) addExternalNode(nodeMap, relationship.from)
    if (relationship.to.startsWith('external:')) addExternalNode(nodeMap, relationship.to)
    addEdge(edges, edgeSet, relationship)
  }

  const graph: KnowledgeGraph = {
    nodes: Array.from(nodeMap.values()),
    edges,
    metadata: {
      generated: new Date().toISOString(),
      root,
      stats: {
        nodes: nodeMap.size,
        edges: edges.length,
        files: Array.from(nodeMap.values()).filter((node) => node.type === 'file').length,
      },
    },
  }

  const outputPath =
    params.outputPath ||
    (params.projectName
      ? projectGraphPath(safeProjectName(params.rootPath, params.projectName))
      : undefined)
  if (outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8')
  }

  return { graph, outputPath }
}

export async function renderKnowledgeGraph(params: ViewParams): Promise<{
  html: string
  outputPath?: string
}> {
  const graph = parseJsonInput<KnowledgeGraph>(params.graph, 'graph')
  const edgeCounts = graph.edges.reduce<Record<string, number>>((counts, edge) => {
    counts[edge.type] = (counts[edge.type] ?? 0) + 1
    return counts
  }, {})
  const nodeRows = graph.nodes
    .slice(0, 300)
    .map(
      (node) =>
        `<tr><td>${escapeHtml(node.type)}</td><td>${escapeHtml(node.label)}</td><td>${escapeHtml(
          node.path
        )}</td><td>${escapeHtml(node.summary ?? '')}</td></tr>`
    )
    .join('\n')
  const edgeRows = graph.edges
    .slice(0, 300)
    .map(
      (edge) =>
        `<tr><td>${escapeHtml(edge.type)}</td><td>${escapeHtml(edge.from)}</td><td>${escapeHtml(
          edge.to
        )}</td></tr>`
    )
    .join('\n')
  const edgeStats = Object.entries(edgeCounts)
    .map(([type, count]) => `<div class="stat"><strong>${count}</strong>${escapeHtml(type)}</div>`)
    .join('\n')
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Knowledge Graph</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #111827; background: #f8fafc; }
    main { max-width: 1180px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
    .stat { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px 14px; background: #fff; min-width: 100px; }
    .stat strong { display: block; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 18px 0 32px; background: #fff; border: 1px solid #d1d5db; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; font-size: 13px; }
    th { color: #374151; background: #f3f4f6; }
    td { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>Knowledge Graph</h1>
    <p>${escapeHtml(graph.metadata.root)}</p>
    <section class="stats">
      <div class="stat"><strong>${graph.metadata.stats.files}</strong>files</div>
      <div class="stat"><strong>${graph.metadata.stats.nodes}</strong>nodes</div>
      <div class="stat"><strong>${graph.metadata.stats.edges}</strong>edges</div>
      ${edgeStats}
    </section>
    <h2>Nodes</h2>
    <table><thead><tr><th>Type</th><th>Label</th><th>Path</th><th>Summary</th></tr></thead><tbody>${nodeRows}</tbody></table>
    <h2>Edges</h2>
    <table><thead><tr><th>Type</th><th>From</th><th>To</th></tr></thead><tbody>${edgeRows}</tbody></table>
  </main>
</body>
</html>`

  if (params.outputPath) {
    await mkdir(path.dirname(params.outputPath), { recursive: true })
    await writeFile(params.outputPath, html, 'utf8')
  }

  return { html, outputPath: params.outputPath }
}
