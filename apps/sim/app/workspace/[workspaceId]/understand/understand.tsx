'use client'

import { useMemo, useState } from 'react'
import { getErrorMessage } from '@sim/utils/errors'
import { Activity, FileCode2, GitBranch, Network, Play, RefreshCw } from 'lucide-react'
import { useParams } from 'next/navigation'
import { requestJson } from '@/lib/api/client/request'
import { type AnalyzeCodebaseResponse, analyzeCodebaseContract } from '@/lib/api/contracts'

const DEFAULT_IGNORE_PATTERNS =
  'node_modules, .git, dist, build, .next, .cache, coverage, __pycache__'

type AnalysisResult = AnalyzeCodebaseResponse

function numberFormat(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function projectNameFromPath(rootPath: string): string {
  return rootPath.split('/').filter(Boolean).at(-1) || 'project'
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof FileCode2
}) {
  return (
    <div className='flex min-h-[76px] items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4'>
      <div className='flex size-9 flex-shrink-0 items-center justify-center rounded-md bg-[var(--surface-3)] text-[var(--text-secondary)]'>
        <Icon className='size-4' />
      </div>
      <div className='min-w-0'>
        <div className='font-medium text-[18px] text-[var(--text-body)]'>{value}</div>
        <div className='text-[var(--text-muted)] text-small'>{label}</div>
      </div>
    </div>
  )
}

export function Understand() {
  const params = useParams()
  const workspaceId = (params?.workspaceId as string) || ''
  const [rootPath, setRootPath] = useState('/Users/kyin/sim')
  const [ignorePatterns, setIgnorePatterns] = useState(DEFAULT_IGNORE_PATTERNS)
  const [maxFiles, setMaxFiles] = useState('500')
  const [projectName, setProjectName] = useState('sim')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const topLanguages = useMemo(() => {
    if (!result) return []
    return Object.entries(result.scan.stats.languages)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
  }, [result])

  const edgeCounts = useMemo(() => {
    if (!result) return []
    const counts = result.graph.edges.reduce<Record<string, number>>((acc, edge) => {
      acc[edge.type] = (acc[edge.type] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(counts).sort((left, right) => right[1] - left[1])
  }, [result])

  const runAnalysis = async () => {
    setIsRunning(true)
    setError(null)

    try {
      const response = await requestJson(analyzeCodebaseContract, {
        body: {
          workspaceId,
          rootPath,
          ignorePatterns,
          maxFiles: Number(maxFiles),
          projectName: projectName.trim() || projectNameFromPath(rootPath),
        },
      })
      setResult(response)
    } catch (err) {
      setError(getErrorMessage(err, 'Understand analysis failed'))
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className='flex h-full flex-col bg-[var(--bg)]'>
      <div className='border-[var(--border)] border-b px-6 py-4'>
        <div className='mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='font-medium text-[20px] text-[var(--text-body)]'>Understand</h1>
            <p className='mt-0.5 text-[var(--text-muted)] text-small'>
              Codebase scan, parse, extraction, graph build, and HTML view.
            </p>
          </div>
          <button
            type='button'
            onClick={runAnalysis}
            disabled={isRunning || !rootPath.trim()}
            className='inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 font-medium text-sm text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isRunning ? (
              <RefreshCw className='size-4 animate-spin' />
            ) : (
              <Play className='size-4' />
            )}
            Run
          </button>
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-gutter:stable_both-edges]'>
        <div className='mx-auto grid max-w-[78rem] grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]'>
          <section className='flex flex-col gap-4'>
            <div className='rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4'>
              <div className='mb-4 font-medium text-[var(--text-body)] text-sm'>Pipeline Input</div>
              <label className='flex flex-col gap-1.5 text-[var(--text-muted)] text-small'>
                Root Path
                <input
                  value={rootPath}
                  onChange={(event) => {
                    const next = event.target.value
                    setRootPath(next)
                    if (!projectName.trim()) setProjectName(projectNameFromPath(next))
                  }}
                  className='h-9 rounded-md border border-[var(--border)] bg-[var(--surface-primary)] px-3 font-mono text-[13px] text-[var(--text-body)] outline-none focus:border-[var(--brand-primary)]'
                />
              </label>
              <label className='mt-3 flex flex-col gap-1.5 text-[var(--text-muted)] text-small'>
                Project Name
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  className='h-9 rounded-md border border-[var(--border)] bg-[var(--surface-primary)] px-3 text-[13px] text-[var(--text-body)] outline-none focus:border-[var(--brand-primary)]'
                />
              </label>
              <label className='mt-3 flex flex-col gap-1.5 text-[var(--text-muted)] text-small'>
                Max Files
                <input
                  value={maxFiles}
                  onChange={(event) => setMaxFiles(event.target.value)}
                  className='h-9 rounded-md border border-[var(--border)] bg-[var(--surface-primary)] px-3 text-[13px] text-[var(--text-body)] outline-none focus:border-[var(--brand-primary)]'
                />
              </label>
              <label className='mt-3 flex flex-col gap-1.5 text-[var(--text-muted)] text-small'>
                Ignore Patterns
                <textarea
                  value={ignorePatterns}
                  onChange={(event) => setIgnorePatterns(event.target.value)}
                  rows={5}
                  className='resize-none rounded-md border border-[var(--border)] bg-[var(--surface-primary)] px-3 py-2 font-mono text-[13px] text-[var(--text-body)] outline-none focus:border-[var(--brand-primary)]'
                />
              </label>
            </div>

            {result?.outputPath && (
              <div className='rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4'>
                <div className='font-medium text-[var(--text-body)] text-sm'>Artifacts</div>
                <div className='mt-3 space-y-2 font-mono text-[12px] text-[var(--text-muted)]'>
                  <div className='break-all'>{result.outputPath}</div>
                  {result.htmlOutputPath && (
                    <div className='break-all'>{result.htmlOutputPath}</div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className='min-w-0'>
            {error && (
              <div className='mb-4 rounded-lg border border-[var(--error)]/40 bg-[var(--error)]/10 px-4 py-3 text-[var(--error)] text-sm'>
                {error}
              </div>
            )}

            {result ? (
              <div className='flex flex-col gap-5'>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                  <Stat
                    label='Files'
                    value={numberFormat(result.scan.stats.totalFiles)}
                    icon={FileCode2}
                  />
                  <Stat
                    label='Functions'
                    value={numberFormat(result.parsed.functions.length)}
                    icon={Activity}
                  />
                  <Stat
                    label='Graph Nodes'
                    value={numberFormat(result.graph.nodes.length)}
                    icon={Network}
                  />
                  <Stat
                    label='Graph Edges'
                    value={numberFormat(result.graph.edges.length)}
                    icon={GitBranch}
                  />
                </div>

                <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
                  <div className='rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4'>
                    <div className='font-medium text-[var(--text-body)] text-sm'>Languages</div>
                    <div className='mt-3 flex flex-col gap-2'>
                      {topLanguages.map(([language, count]) => (
                        <div
                          key={language}
                          className='flex items-center justify-between gap-3 text-sm'
                        >
                          <span className='text-[var(--text-body)]'>{language}</span>
                          <span className='font-mono text-[var(--text-muted)]'>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className='rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4'>
                    <div className='font-medium text-[var(--text-body)] text-sm'>Edges</div>
                    <div className='mt-3 flex flex-col gap-2'>
                      {edgeCounts.map(([type, count]) => (
                        <div key={type} className='flex items-center justify-between gap-3 text-sm'>
                          <span className='text-[var(--text-body)]'>{type}</span>
                          <span className='font-mono text-[var(--text-muted)]'>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className='rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]'>
                  <div className='border-[var(--border)] border-b px-4 py-3 font-medium text-[var(--text-body)] text-sm'>
                    Top Files
                  </div>
                  <div className='max-h-[360px] overflow-auto'>
                    <table className='w-full table-fixed text-left text-sm'>
                      <thead className='sticky top-0 bg-[var(--surface-2)] text-[var(--text-muted)]'>
                        <tr>
                          <th className='w-[58%] px-4 py-2 font-medium'>Path</th>
                          <th className='px-4 py-2 font-medium'>Language</th>
                          <th className='px-4 py-2 text-right font-medium'>Lines</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.scan.files.slice(0, 100).map((file) => (
                          <tr key={file.path} className='border-[var(--border)] border-t'>
                            <td className='truncate px-4 py-2 font-mono text-[12px] text-[var(--text-body)]'>
                              {file.path}
                            </td>
                            <td className='px-4 py-2 text-[var(--text-muted)]'>{file.language}</td>
                            <td className='px-4 py-2 text-right font-mono text-[var(--text-muted)]'>
                              {numberFormat(file.lines)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className='flex min-h-[420px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]'>
                <div className='max-w-[420px] text-center'>
                  <Network className='mx-auto mb-3 size-8 text-[var(--text-muted)]' />
                  <div className='font-medium text-[var(--text-body)]'>No analysis yet</div>
                  <div className='mt-1 text-[var(--text-muted)] text-sm'>
                    Run the pipeline to create the scan, parse, extract, graph, and HTML artifacts.
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
