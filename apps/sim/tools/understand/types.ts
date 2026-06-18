import type { ToolResponse } from '@/tools/types'

export interface FileEntry {
  path: string
  language: string
  size: number
  lines: number
}

export interface ScanStats {
  totalFiles: number
  totalLines: number
  languages: Record<string, number>
  skippedFiles: number
}

export interface ScanResult {
  files: FileEntry[]
  stats: ScanStats
}

export interface FunctionDef {
  name: string
  line: number
  signature: string
}

export interface ClassDef {
  name: string
  line: number
  methods: string[]
  extends?: string[]
  implements?: string[]
}

export interface ImportDef {
  path: string
  names: string[]
}

export interface CallDef {
  from: string
  to: string
  line: number
}

export interface ParsedFile {
  path: string
  language: string
  functions: FunctionDef[]
  classes: ClassDef[]
  imports: ImportDef[]
  calls: CallDef[]
}

export interface ParseResult {
  files: ParsedFile[]
  functions: Array<FunctionDef & { path: string }>
  classes: Array<ClassDef & { path: string }>
  imports: Array<ImportDef & { from: string }>
  calls: Array<CallDef & { path: string }>
}

export interface FileSummary {
  path: string
  summary: string
}

export type GraphEdgeType =
  | 'imports'
  | 'calls'
  | 'defines'
  | 'depends-on'
  | 'extends'
  | 'implements'

export interface Relationship {
  from: string
  to: string
  type: GraphEdgeType
}

export interface ExtractResult {
  summaries: FileSummary[]
  relationships: Relationship[]
}

export interface GraphNode {
  id: string
  type: 'file' | 'function' | 'class' | 'external'
  path: string
  label: string
  summary?: string
}

export interface GraphEdge {
  from: string
  to: string
  type: GraphEdgeType
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  metadata: {
    generated: string
    root: string
    stats: {
      nodes: number
      edges: number
      files: number
    }
  }
}

export interface ScanParams {
  rootPath: string
  ignorePatterns?: string | string[]
  maxFiles?: number
  maxFileBytes?: number
}

export interface ParseParams {
  files: string | FileEntry[] | ScanResult
  maxFileBytes?: number
}

export interface ExtractParams {
  parsedData: string | ParseResult | ParsedFile[]
  model?: string
}

export interface GraphParams {
  rootPath?: string
  scanResult?: string | ScanResult
  parsedData?: string | ParseResult | ParsedFile[]
  summaries?: string | FileSummary[]
  relationships?: string | Relationship[]
  projectName?: string
  outputPath?: string
}

export interface ViewParams {
  graph: string | KnowledgeGraph
  outputPath?: string
}

export interface ScanToolResponse extends ToolResponse {
  output: ScanResult
}

export interface ParseToolResponse extends ToolResponse {
  output: ParseResult
}

export interface ExtractToolResponse extends ToolResponse {
  output: ExtractResult
}

export interface GraphToolResponse extends ToolResponse {
  output: {
    graph: KnowledgeGraph
    outputPath?: string
  }
}

export interface ViewToolResponse extends ToolResponse {
  output: {
    html: string
    outputPath?: string
  }
}
