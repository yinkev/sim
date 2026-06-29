#!/usr/bin/env bun
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dir, '..')
const CENTER_PATHS = [
  path.join(ROOT, 'apps/sim/app/center'),
  path.join(ROOT, 'apps/sim/lib/center'),
]

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage'])

const FORBIDDEN_IMPORTS: Array<{ pattern: RegExp; description: string }> = [
  {
    pattern: /from\s+['"]@\/app\/workspace\/\[workspaceId\]\/w(?:\/|['"])/,
    description: 'workflow route module',
  },
  { pattern: /from\s+['"]@\/stores(?:\/|['"])/, description: 'workspace store import' },
  { pattern: /from\s+['"]@\/blocks(?:\/|['"])/, description: 'block registry import' },
  { pattern: /from\s+['"]@\/tools(?:\/|['"])/, description: 'tool registry import' },
  { pattern: /from\s+['"]@\/executor(?:\/|['"])/, description: 'execution sandbox import' },
  { pattern: /from\s+['"]@\/providers(?:\/|['"])/, description: 'provider SDK registry import' },
  { pattern: /from\s+['"]@monaco-editor\/react['"]/, description: 'Monaco import' },
  { pattern: /from\s+['"]monaco-editor(?:\/|['"])/, description: 'Monaco import' },
  { pattern: /from\s+['"]mermaid(?:\/|['"])/, description: 'mermaid import' },
  { pattern: /from\s+['"]pdfjs-dist(?:\/|['"])/, description: 'PDF parser import' },
  { pattern: /from\s+['"]mammoth(?:\/|['"])/, description: 'document parser import' },
  { pattern: /from\s+['"]officeparser(?:\/|['"])/, description: 'document parser import' },
  { pattern: /from\s+['"]pptxgenjs(?:\/|['"])/, description: 'document parser import' },
]

async function walk(dir: string, results: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, results)
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

async function main() {
  const files = (await Promise.all(CENTER_PATHS.map((dir) => walk(dir)))).flat()
  const offenders: Array<{ file: string; line: number; description: string; snippet: string }> = []

  for (const file of files) {
    const content = await readFile(file, 'utf8')
    const lines = content.split('\n')
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (forbidden.pattern.test(line)) {
          offenders.push({
            file: path.relative(ROOT, file),
            line: index + 1,
            description: forbidden.description,
            snippet: line.trim(),
          })
        }
      }
    }
  }

  if (offenders.length === 0) {
    console.log('Center import boundary OK')
    return
  }

  console.error('Center import boundary violations found:')
  for (const offender of offenders) {
    console.error(
      `  ${offender.file}:${offender.line} - ${offender.description}\n    ${offender.snippet}`
    )
  }
  process.exit(1)
}

void main().catch((error) => {
  console.error('Center import boundary check failed:', error)
  process.exit(1)
})
