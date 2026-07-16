#!/usr/bin/env bun
import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { getErrorMessage } from '@sim/utils/errors'
import { sleep } from '@sim/utils/helpers'
import { generateShortId } from '@sim/utils/id'

const execFileAsync = promisify(execFile)
const REPO_ROOT = path.resolve(import.meta.dir, '..')
const APP_ROOT = path.join(REPO_ROOT, 'apps/sim')
const NEXT_DEV_ROOT = path.join(APP_ROOT, '.next/dev')
const NEXT_DEV_LOCK = path.join(NEXT_DEV_ROOT, 'lock')
const EVIDENCE_PREFIX = 'var/center/evidence/'
const HOST = '127.0.0.1'
const PORT = 6888
const SAMPLE_INTERVAL_MS = 250
const SETTLE_MS = 15_000
const IDLE_WINDOW_MS = 15_000
const IDLE_CPU_LIMIT_PERCENT = 1
const BROWSER_TIMESTAMP_FUTURE_TOLERANCE_MS = 5_000
const MAIN_RSS_LIMIT_BYTES = 4 * 1024 ** 3
const STUDIO_RSS_LIMIT_BYTES = 6 * 1024 ** 3
const LISTENER_TIMEOUT_MS = 30_000
const CURL_TIMEOUT_SECONDS = 180
const PROCESS_GROUP_STOP_TIMEOUT_MS = 5_000
const LSOF_PATH = '/usr/sbin/lsof'
const PS_PATH = '/bin/ps'
const CURL_PATH = '/usr/bin/curl'
const GIT_PATH = '/usr/bin/git'

type Surface = 'main' | 'studio'
type ProbeStatus = 'pass' | 'fail' | 'partial' | 'error'
type SamplePhase = 'cold' | 'warm' | 'browser' | 'settle' | 'idle'

export interface ProbeOptions {
  browserEvidencePath?: string
  outputPath: string
  route: string
  skipBrowserWait: boolean
  surface: Surface
}

export interface ProcessRow {
  command: string
  cpuPercent: number
  cpuTimeMs: number
  pid: number
  ppid: number
  rssBytes: number
}

interface BrowserEvidenceValidationOptions {
  runId: string
  runStartedAtMs: number
  surface: Surface
  targetUrl: string
  validatedAtMs: number
}

interface ProcessSample {
  cpuPercent: number
  elapsedMs: number
  phase: SamplePhase
  processCount: number
  processCpuTimeMs: Record<string, number>
  processes: Array<Pick<ProcessRow, 'command' | 'pid' | 'ppid' | 'rssBytes'>>
  rssBytes: number
}

interface CurlMetrics {
  bytes: number
  finalUrl: string
  redirects: number
  status: number
  totalMs: number
  ttfbMs: number
}

interface ProbeCheck {
  id: string
  limit?: number
  observed: number | string
  status: 'pass' | 'fail'
  unit?: string
}

interface SamplerState {
  done: Promise<void>
  error: Error | null
  phase: SamplePhase
  running: boolean
  samples: ProcessSample[]
}

interface PartialReportState {
  browserCheckpoint: 'not-started' | 'completed' | 'skipped'
  cold?: CurlMetrics
  listenerPid?: number
  listenerReadyMs?: number
  samples: ProcessSample[]
  serverPid?: number
  warm: CurlMetrics[]
}

type ProbeReport = Record<string, unknown>

const USAGE = `Usage:
  bun run probe:dev-performance --surface=main|studio --route=/workspace/... \\
    --output=var/center/evidence/.../probe.json \\
    [--browser-evidence=var/center/evidence/.../browser.json] [--skip-browser-wait]

Exit codes:
  0  automated budgets pass and current-run browser evidence is attached
  1  one or more automated budgets fail
  2  invalid setup, runtime error, or incomplete browser evidence
`

function readNamedArg(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function validateEvidencePath(value: string, name: string): void {
  const normalized = path.posix.normalize(value)
  if (
    path.isAbsolute(value) ||
    value.includes('\\') ||
    !value.startsWith(EVIDENCE_PREFIX) ||
    normalized !== value ||
    value === EVIDENCE_PREFIX.slice(0, -1)
  ) {
    throw new Error(`${name} must be a canonical relative path under ${EVIDENCE_PREFIX}`)
  }
}

/** Parses the intentionally small local-probe command interface. */
export function parseArgs(args: string[]): ProbeOptions {
  const knownArgs = new Set(['surface', 'route', 'output', 'browser-evidence'])
  for (const arg of args) {
    if (arg === '--skip-browser-wait') continue
    const match = /^--([^=]+)=/.exec(arg)
    if (!match || !knownArgs.has(match[1])) throw new Error(`Unknown argument: ${arg}`)
  }

  const surface = readNamedArg(args, 'surface')
  if (surface !== 'main' && surface !== 'studio') {
    throw new Error('surface must be main or studio')
  }

  const route = readNamedArg(args, 'route')
  if (!route?.startsWith('/') || route.startsWith('//')) {
    throw new Error('route must be an absolute application path beginning with one slash')
  }

  const outputPath = readNamedArg(args, 'output')
  if (!outputPath) throw new Error('output is required')
  validateEvidencePath(outputPath, 'output')
  if (!outputPath.endsWith('.json')) throw new Error('output must end in .json')

  const browserEvidencePath = readNamedArg(args, 'browser-evidence')
  if (browserEvidencePath) {
    validateEvidencePath(browserEvidencePath, 'browser-evidence')
    if (
      browserEvidencePath === outputPath ||
      browserEvidencePath === getServerLogPath(outputPath)
    ) {
      throw new Error('browser-evidence must not overwrite output or the server log')
    }
  }

  return {
    browserEvidencePath,
    outputPath,
    route,
    skipBrowserWait: args.includes('--skip-browser-wait'),
    surface,
  }
}

/** Converts macOS `ps` cumulative TIME into milliseconds. */
export function parseCpuTimeMs(value: string): number {
  const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d{2})(?:\.(\d+))?$/.exec(value)
  if (!match) throw new Error(`Invalid ps TIME value: ${value}`)

  const days = Number(match[1] ?? 0)
  const hours = Number(match[2] ?? 0)
  const minutes = Number(match[3])
  const seconds = Number(match[4])
  const fractionMs = Number(`0.${match[5] ?? 0}`) * 1_000
  return (days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds) * 1_000 + fractionMs
}

/** Parses the header-free macOS process snapshot used by the sampler. */
export function parsePsOutput(output: string): ProcessRow[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\S+)\s+(.+)$/.exec(line)
      if (!match) throw new Error(`Invalid ps row: ${line}`)
      return {
        command: match[6],
        cpuPercent: Number(match[4]),
        cpuTimeMs: parseCpuTimeMs(match[5]),
        pid: Number(match[1]),
        ppid: Number(match[2]),
        rssBytes: Number(match[3]) * 1024,
      }
    })
}

/** Returns the listener plus every recursive descendant in the snapshot. */
export function collectProcessTree(rows: ProcessRow[], rootPid: number): ProcessRow[] {
  const selected = new Set([rootPid])
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      if (!selected.has(row.pid) && selected.has(row.ppid)) {
        selected.add(row.pid)
        changed = true
      }
    }
  }
  return rows.filter((row) => selected.has(row.pid))
}

/** Calculates a stable median without mutating the input sample. */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error('Cannot calculate median of an empty sample')
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/** Parses one tab-delimited curl write-out record. */
export function parseCurlMetrics(output: string): CurlMetrics {
  const [status, ttfb, total, bytes, redirects, finalUrl, ...extra] = output.trim().split('\t')
  if (!status || !ttfb || !total || !bytes || !redirects || !finalUrl || extra.length > 0) {
    throw new Error(`Invalid curl metrics: ${output.trim()}`)
  }
  return {
    bytes: Number(bytes),
    finalUrl,
    redirects: Number(redirects),
    status: Number(status),
    totalMs: Number(total) * 1_000,
    ttfbMs: Number(ttfb) * 1_000,
  }
}

/** Requires every HTTP sample to stay on the requested URL without redirects. */
export function httpSamplesMatchTarget(samples: CurlMetrics[], targetUrl: string): boolean {
  return samples.every((sample) => sample.redirects === 0 && sample.finalUrl === targetUrl)
}

/** Refuses destructive cache cleanup while another Next dev process owns the directory. */
export function assertNoActiveDevLock(activePid: number | null): void {
  if (activePid) {
    throw new Error(`apps/sim/.next/dev is locked by active PID ${activePid}`)
  }
}

/** Makes cleanup safe to call concurrently from normal and signal paths. */
export function createIdempotentCleanup(cleanup: () => Promise<void>): () => Promise<void> {
  let cleanupPromise: Promise<void> | null = null
  return () => {
    cleanupPromise ??= Promise.resolve().then(cleanup)
    return cleanupPromise
  }
}

/** Runs signal cleanup to completion before terminating the probe process. */
export async function runSignalCleanup(
  cleanup: () => Promise<void>,
  onError: (message: string) => void,
  onExit: (code: number) => void
): Promise<void> {
  try {
    await cleanup()
  } catch (error) {
    onError(getErrorMessage(error))
  } finally {
    onExit(2)
  }
}

/** Prevents cleanup failures from leaving a passing evidence document. */
export function markCleanupFailure(report: ProbeReport, message: string): ProbeReport {
  return {
    ...report,
    cleanup: { error: message, status: 'fail' },
    status: 'error',
  }
}

/** Computes aggregate core-percent from positive per-process cumulative CPU deltas. */
export function calculateIdleCpuPercent(
  samples: Array<Pick<ProcessSample, 'elapsedMs' | 'processCpuTimeMs'>>
): number {
  if (samples.length < 2) throw new Error('Idle CPU requires at least two process samples')
  let cpuDeltaMs = 0
  let previous = samples[0].processCpuTimeMs
  for (const sample of samples.slice(1)) {
    const previousPids = Object.keys(previous).sort()
    const currentPids = Object.keys(sample.processCpuTimeMs).sort()
    if (
      previousPids.length !== currentPids.length ||
      previousPids.some((pid, index) => pid !== currentPids[index])
    ) {
      throw new Error('Idle CPU process tree changed during sampling')
    }
    for (const [pid, currentTimeMs] of Object.entries(sample.processCpuTimeMs)) {
      cpuDeltaMs += Math.max(0, currentTimeMs - previous[pid])
    }
    previous = sample.processCpuTimeMs
  }
  const wallMs = samples.at(-1)!.elapsedMs - samples[0].elapsedMs
  if (wallMs <= 0) throw new Error('Idle CPU sample window must have positive duration')
  return (cpuDeltaMs / wallMs) * 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function passedTimedBrowserCheck(value: unknown, limitMs: number): boolean {
  if (!isRecord(value)) return false
  const upperBoundMs = value.upperBoundMs
  return (
    value.status === 'pass' &&
    typeof upperBoundMs === 'number' &&
    Number.isFinite(upperBoundMs) &&
    upperBoundMs >= 0 &&
    upperBoundMs < limitMs
  )
}

function studioNavigationStaysOnSurface(value: unknown, targetUrl: string): boolean {
  if (!isRecord(value) || !Array.isArray(value.visitedUrls) || value.visitedUrls.length < 2) {
    return false
  }

  try {
    const target = new URL(targetUrl)
    const targetParts = target.pathname.split('/').filter(Boolean)
    if (targetParts.length !== 4 || targetParts[0] !== 'workspace' || targetParts[2] !== 'w') {
      return false
    }

    const visitedUrls = value.visitedUrls.map((visitedUrl) => {
      if (typeof visitedUrl !== 'string') throw new Error('Invalid visited URL')
      return new URL(visitedUrl)
    })
    if (visitedUrls.at(-1)!.href !== target.href) return false

    return visitedUrls.every((visitedUrl) => {
      const parts = visitedUrl.pathname.split('/').filter(Boolean)
      return (
        visitedUrl.origin === target.origin &&
        parts.length === 4 &&
        parts[0] === 'workspace' &&
        parts[1] === targetParts[1] &&
        parts[2] === 'w'
      )
    })
  } catch {
    return false
  }
}

/** Validates current-run browser evidence before it can complete the probe. */
export function validateBrowserEvidence(
  value: unknown,
  options: BrowserEvidenceValidationOptions
): boolean {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.status !== 'pass') return false
  if (value.runId !== options.runId) return false
  const targetUrl =
    typeof value.targetUrl === 'string'
      ? value.targetUrl
      : isRecord(value.target) && typeof value.target.url === 'string'
        ? value.target.url
        : null
  if (targetUrl !== options.targetUrl) return false

  if (typeof value.capturedAt !== 'string') return false
  const capturedAtMs = Date.parse(value.capturedAt)
  if (
    !Number.isFinite(capturedAtMs) ||
    capturedAtMs < options.runStartedAtMs ||
    capturedAtMs > options.validatedAtMs + BROWSER_TIMESTAMP_FUTURE_TOLERANCE_MS
  ) {
    return false
  }

  if (!isRecord(value.checks) || !isRecord(value.checks.interaction)) return false
  if (value.checks.interaction.status !== 'pass') return false
  const warmLimitMs = options.surface === 'main' ? 500 : 3_000
  if (!passedTimedBrowserCheck(value.checks.warmNavigation, warmLimitMs)) return false
  if (
    options.surface === 'studio' &&
    !studioNavigationStaysOnSurface(value.checks.warmNavigation, options.targetUrl)
  ) {
    return false
  }
  if (options.surface === 'main' && !passedTimedBrowserCheck(value.checks.inputReadiness, 500)) {
    return false
  }
  return true
}

function resolveRepoPath(relativePath: string): string {
  return path.join(REPO_ROOT, ...relativePath.split('/'))
}

function getServerLogPath(outputPath: string): string {
  return outputPath.replace(/\.json$/, '.server.log')
}

async function findListenerPid(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      LSOF_PATH,
      ['-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8' }
    )
    const pids = stdout.trim().split(/\s+/).filter(Boolean).map(Number)
    if (pids.length > 1)
      throw new Error(`Multiple listeners found on port ${PORT}: ${pids.join(', ')}`)
    return pids[0] ?? null
  } catch (error) {
    if ((error as NodeJS.ErrnoException & { code?: number }).code === 1) return null
    throw error
  }
}

async function findActiveDevLockPid(): Promise<number | null> {
  if (!existsSync(NEXT_DEV_LOCK)) return null
  try {
    const { stdout } = await execFileAsync(LSOF_PATH, ['-nP', '-t', NEXT_DEV_LOCK], {
      encoding: 'utf8',
    })
    const pids = stdout.trim().split(/\s+/).filter(Boolean).map(Number)
    if (pids.length > 1) {
      throw new Error(`Multiple processes hold apps/sim/.next/dev: ${pids.join(', ')}`)
    }
    return pids[0] ?? null
  } catch (error) {
    if ((error as NodeJS.ErrnoException & { code?: number }).code === 1) return null
    throw error
  }
}

async function readProcessGroupId(pid: number): Promise<number> {
  const { stdout } = await execFileAsync(PS_PATH, ['-o', 'pgid=', '-p', String(pid)], {
    encoding: 'utf8',
  })
  const pgid = Number(stdout.trim())
  if (!Number.isInteger(pgid) || pgid <= 0)
    throw new Error(`Could not resolve process group for PID ${pid}`)
  return pgid
}

async function waitForListener(serverPid: number): Promise<number> {
  const deadline = performance.now() + LISTENER_TIMEOUT_MS
  while (performance.now() < deadline) {
    const listenerPid = await findListenerPid()
    if (listenerPid) {
      const listenerGroupId = await readProcessGroupId(listenerPid)
      if (listenerGroupId !== serverPid) {
        throw new Error(
          `Port ${PORT} listener PID ${listenerPid} is not in spawned process group ${serverPid}`
        )
      }
      return listenerPid
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting ${LISTENER_TIMEOUT_MS}ms for port ${PORT}`)
}

async function readProcessRows(): Promise<ProcessRow[]> {
  const { stdout } = await execFileAsync(
    PS_PATH,
    ['-ww', '-axo', 'pid=,ppid=,rss=,%cpu=,time=,command='],
    {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    }
  )
  return parsePsOutput(stdout)
}

async function captureProcessSample(
  listenerPid: number,
  startedAt: number,
  phase: SamplePhase
): Promise<ProcessSample> {
  const tree = collectProcessTree(await readProcessRows(), listenerPid)
  if (!tree.some((row) => row.pid === listenerPid)) {
    throw new Error(`Listener PID ${listenerPid} disappeared during sampling`)
  }
  return {
    cpuPercent: tree.reduce((total, row) => total + row.cpuPercent, 0),
    elapsedMs: performance.now() - startedAt,
    phase,
    processCount: tree.length,
    processCpuTimeMs: Object.fromEntries(tree.map((row) => [String(row.pid), row.cpuTimeMs])),
    processes: tree.map(({ command, pid, ppid, rssBytes }) => ({ command, pid, ppid, rssBytes })),
    rssBytes: tree.reduce((total, row) => total + row.rssBytes, 0),
  }
}

function startSampler(
  listenerPid: number,
  startedAt: number,
  initialSample: ProcessSample
): SamplerState {
  const state: SamplerState = {
    done: Promise.resolve(),
    error: null,
    phase: initialSample.phase,
    running: true,
    samples: [initialSample],
  }
  state.done = (async () => {
    while (state.running) {
      const sampleStartedAt = performance.now()
      try {
        state.samples.push(await captureProcessSample(listenerPid, startedAt, state.phase))
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(getErrorMessage(error))
        state.running = false
        return
      }
      const remainingMs = SAMPLE_INTERVAL_MS - (performance.now() - sampleStartedAt)
      if (remainingMs > 0) await sleep(remainingMs)
    }
  })()
  return state
}

async function stopSampler(state: SamplerState): Promise<void> {
  state.running = false
  await state.done
  if (state.error) throw state.error
}

async function measureHttp(url: string): Promise<CurlMetrics> {
  const writeOut = [
    '%{http_code}',
    '%{time_starttransfer}',
    '%{time_total}',
    '%{size_download}',
    '%{num_redirects}',
    '%{url_effective}',
  ].join('\t')
  const { stdout } = await execFileAsync(
    CURL_PATH,
    [
      '--compressed',
      '--location',
      '--max-time',
      String(CURL_TIMEOUT_SECONDS),
      '--output',
      '/dev/null',
      '--show-error',
      '--silent',
      '--write-out',
      writeOut,
      url,
    ],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 }
  )
  return parseCurlMetrics(stdout)
}

async function waitForBrowserCheckpoint(
  url: string,
  runId: string,
  browserEvidencePath?: string
): Promise<void> {
  process.stderr.write(
    [
      '',
      `Browser checkpoint ready: ${url}`,
      `Probe run ID: ${runId}`,
      'Use a fresh agent-browser session. Capture input readiness, focus/fill, and screenshot evidence.',
      'For Studio, checks.warmNavigation.visitedUrls must list every URL visited during measurement.',
      browserEvidencePath
        ? `Write current-run evidence to: ${browserEvidencePath}`
        : 'No --browser-evidence path supplied; final result will remain partial.',
      'Leave the page open, then press Enter to begin settle and idle sampling.',
      '',
    ].join('\n')
  )
  process.stdin.setEncoding('utf8')
  process.stdin.resume()
  await new Promise<void>((resolve) => process.stdin.once('data', () => resolve()))
  process.stdin.pause()
}

function browserEvidenceIsCurrent(
  relativePath: string | undefined,
  runId: string,
  startedAtMs: number,
  surface: Surface,
  targetUrl: string
): boolean {
  if (!relativePath) return false
  const absolutePath = resolveRepoPath(relativePath)
  if (!existsSync(absolutePath)) return false
  const fileStat = statSync(absolutePath)
  if (!fileStat.isFile() || fileStat.mtimeMs < startedAtMs - 1_000) return false
  try {
    return validateBrowserEvidence(JSON.parse(readFileSync(absolutePath, 'utf8')), {
      runId,
      runStartedAtMs: startedAtMs,
      surface,
      targetUrl,
      validatedAtMs: Date.now(),
    })
  } catch {
    return false
  }
}

function processGroupIsAlive(serverPid: number): boolean {
  try {
    process.kill(-serverPid, 0)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
    throw error
  }
}

async function stopProcessGroup(serverPid: number): Promise<void> {
  if (!Number.isInteger(serverPid) || serverPid <= 1) {
    throw new Error(`Refusing to stop invalid process group ${serverPid}`)
  }
  if (!processGroupIsAlive(serverPid)) return
  process.kill(-serverPid, 'SIGTERM')
  const deadline = performance.now() + PROCESS_GROUP_STOP_TIMEOUT_MS
  while (performance.now() < deadline) {
    if (!processGroupIsAlive(serverPid)) return
    await sleep(100)
  }
  if (processGroupIsAlive(serverPid)) process.kill(-serverPid, 'SIGKILL')
}

function assertProbeEnvironment(options: ProbeOptions): void {
  if (process.platform !== 'darwin') throw new Error('This probe currently supports macOS only')
  for (const requiredPath of [LSOF_PATH, PS_PATH, CURL_PATH, GIT_PATH]) {
    if (!existsSync(requiredPath)) throw new Error(`Required command is missing: ${requiredPath}`)
  }
  if (!options.skipBrowserWait && !process.stdin.isTTY) {
    throw new Error(
      'Interactive browser checkpoint requires a TTY; use --skip-browser-wait only for partial evidence'
    )
  }
}

async function readGitState(): Promise<{ dirty: boolean; head: string }> {
  const [{ stdout: head }, { stdout: status }] = await Promise.all([
    execFileAsync(GIT_PATH, ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }),
    execFileAsync(GIT_PATH, ['status', '--porcelain=v1'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    }),
  ])
  return { dirty: status.trim().length > 0, head: head.trim() }
}

function makeCheck(
  id: string,
  observed: number | string,
  passes: boolean,
  limit?: number,
  unit?: string
): ProbeCheck {
  return { id, limit, observed, status: passes ? 'pass' : 'fail', unit }
}

function summarizeRuntime(samples: ProcessSample[]) {
  if (samples.length === 0) throw new Error('No process samples were captured')
  const idleSamples = samples.filter((sample) => sample.phase === 'idle')
  if (idleSamples.length < 2) throw new Error('Idle window did not capture enough process samples')
  const finalElapsedMs = samples.at(-1)!.elapsedMs
  const settledSamples = samples.filter((sample) => sample.elapsedMs >= finalElapsedMs - 5_000)
  return {
    idleCpuPercent: calculateIdleCpuPercent(idleSamples),
    idlePeakTreeRssBytes: Math.max(...idleSamples.map((sample) => sample.rssBytes)),
    peakTreeRssBytes: Math.max(...samples.map((sample) => sample.rssBytes)),
    settledMedianTreeRssBytes: median(settledSamples.map((sample) => sample.rssBytes)),
  }
}

async function writeReport(outputPath: string, report: unknown): Promise<void> {
  const absolutePath = resolveRepoPath(outputPath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`)
}

function appendProbeLog(logPath: string, message: string): void {
  const absolutePath = resolveRepoPath(logPath)
  writeFileSync(absolutePath, `${message.trimEnd()}\n`, { flag: 'a' })
}

async function runProbe(options: ProbeOptions): Promise<number> {
  const outputAbsolutePath = resolveRepoPath(options.outputPath)
  const logPath = getServerLogPath(options.outputPath)
  const logAbsolutePath = resolveRepoPath(logPath)
  await mkdir(path.dirname(outputAbsolutePath), { recursive: true })
  writeFileSync(outputAbsolutePath, '')
  writeFileSync(logAbsolutePath, '')

  const capturedAt = new Date().toISOString()
  const runId = generateShortId()
  const runStartedAtMs = Date.now()
  const performanceStartedAt = performance.now()
  const url = `http://${HOST}:${PORT}${options.route}`
  const state: PartialReportState = {
    browserCheckpoint: 'not-started',
    samples: [],
    warm: [],
  }
  let server: ChildProcess | null = null
  let sampler: SamplerState | null = null
  let exitCode = 2
  let report: ProbeReport | null = null
  const cleanupResources = createIdempotentCleanup(async () => {
    if (sampler?.running) {
      sampler.running = false
      await sampler.done
    }
    if (server?.pid) await stopProcessGroup(server.pid)
  })
  const handleSignal = (signal: NodeJS.Signals) => {
    process.stderr.write(`Received ${signal}; stopping spawned process group.\n`)
    void runSignalCleanup(
      cleanupResources,
      (message) => process.stderr.write(`Signal cleanup failed: ${message}\n`),
      (code) => process.exit(code)
    )
  }
  const handleSigint = () => handleSignal('SIGINT')
  const handleSigterm = () => handleSignal('SIGTERM')
  process.once('SIGINT', handleSigint)
  process.once('SIGTERM', handleSigterm)

  try {
    assertProbeEnvironment(options)
    const existingListenerPid = await findListenerPid()
    if (existingListenerPid) {
      throw new Error(`Port ${PORT} is already occupied by listener PID ${existingListenerPid}`)
    }
    assertNoActiveDevLock(await findActiveDevLockPid())

    await rm(NEXT_DEV_ROOT, { force: true, recursive: true })
    appendProbeLog(logPath, `probe: ${capturedAt}\ncommand: bun run dev:capped --hostname ${HOST}`)
    const logFd = openSync(logAbsolutePath, 'a')
    try {
      server = spawn(process.execPath, ['run', 'dev:capped', '--hostname', HOST], {
        cwd: APP_ROOT,
        detached: true,
        env: process.env,
        stdio: ['ignore', logFd, logFd],
      })
    } finally {
      closeSync(logFd)
    }
    if (!server.pid) throw new Error('Dev server did not expose a process ID')
    state.serverPid = server.pid

    state.listenerPid = await waitForListener(server.pid)
    state.listenerReadyMs = performance.now() - performanceStartedAt
    const initialSample = await captureProcessSample(
      state.listenerPid,
      performanceStartedAt,
      'cold'
    )
    sampler = startSampler(state.listenerPid, performanceStartedAt, initialSample)

    state.cold = await measureHttp(url)
    sampler.phase = 'warm'
    for (let index = 0; index < 3; index++) state.warm.push(await measureHttp(url))

    sampler.phase = 'browser'
    if (options.skipBrowserWait) {
      state.browserCheckpoint = 'skipped'
    } else {
      await waitForBrowserCheckpoint(url, runId, options.browserEvidencePath)
      state.browserCheckpoint = 'completed'
    }

    sampler.phase = 'settle'
    await sleep(SETTLE_MS)
    sampler.phase = 'idle'
    await sleep(IDLE_WINDOW_MS)
    await stopSampler(sampler)
    state.samples = sampler.samples

    const runtime = summarizeRuntime(state.samples)
    const warmMedianTtfbMs = median(state.warm.map((sample) => sample.ttfbMs))
    const warmMedianTotalMs = median(state.warm.map((sample) => sample.totalMs))
    const rssLimitBytes = options.surface === 'main' ? MAIN_RSS_LIMIT_BYTES : STUDIO_RSS_LIMIT_BYTES
    const warmLimitMs = options.surface === 'main' ? 500 : 3_000
    const httpSamples = [state.cold, ...state.warm]
    const checks = [
      makeCheck(
        'http-status',
        httpSamples.map((sample) => sample.status).join(','),
        httpSamples.every((sample) => sample.status === 200)
      ),
      makeCheck(
        'http-target',
        httpSamples.map((sample) => `${sample.redirects}:${sample.finalUrl}`).join(','),
        httpSamplesMatchTarget(httpSamples, url)
      ),
      ...(options.surface === 'main'
        ? [makeCheck('cold-route-ttfb', state.cold.ttfbMs, state.cold.ttfbMs < 5_000, 5_000, 'ms')]
        : []),
      makeCheck(
        'warm-http-ttfb',
        warmMedianTtfbMs,
        warmMedianTtfbMs < warmLimitMs,
        warmLimitMs,
        'ms'
      ),
      makeCheck(
        'peak-listener-tree-rss',
        runtime.peakTreeRssBytes,
        runtime.peakTreeRssBytes < rssLimitBytes,
        rssLimitBytes,
        'bytes'
      ),
      makeCheck(
        'idle-peak-listener-tree-rss',
        runtime.idlePeakTreeRssBytes,
        runtime.idlePeakTreeRssBytes < rssLimitBytes,
        rssLimitBytes,
        'bytes'
      ),
      makeCheck(
        'idle-cpu',
        runtime.idleCpuPercent,
        runtime.idleCpuPercent <= IDLE_CPU_LIMIT_PERCENT,
        IDLE_CPU_LIMIT_PERCENT,
        'percent'
      ),
    ]
    const automatedFailure = checks.some((check) => check.status === 'fail')
    const browserAttached =
      state.browserCheckpoint === 'completed' &&
      browserEvidenceIsCurrent(
        options.browserEvidencePath,
        runId,
        runStartedAtMs,
        options.surface,
        url
      )
    const status: ProbeStatus = automatedFailure ? 'fail' : browserAttached ? 'pass' : 'partial'
    exitCode = automatedFailure ? 1 : browserAttached ? 0 : 2
    const git = await readGitState()

    report = {
      browser: {
        checkpoint: state.browserCheckpoint,
        evidencePath: browserAttached ? options.browserEvidencePath : null,
        status: browserAttached ? 'attached' : 'manual-required',
      },
      capturedAt,
      checks,
      environment: {
        arch: process.arch,
        bunVersion: Bun.version,
        platform: process.platform,
      },
      git,
      http: {
        cold: state.cold,
        warm: {
          medianTotalMs: warmMedianTotalMs,
          medianTtfbMs: warmMedianTtfbMs,
          samples: state.warm,
        },
      },
      runtime: {
        ...runtime,
        idleWindowMs: IDLE_WINDOW_MS,
        sampleIntervalMs: SAMPLE_INTERVAL_MS,
        samples: state.samples,
        settleMs: SETTLE_MS,
      },
      runId,
      schemaVersion: 1,
      server: {
        command: `bun run dev:capped --hostname ${HOST}`,
        listenerPid: state.listenerPid,
        listenerReadyMs: state.listenerReadyMs,
        logPath,
        serverPid: state.serverPid,
      },
      status,
      target: { surface: options.surface, url },
    }
  } catch (error) {
    const message = getErrorMessage(error, 'Unknown probe error')
    appendProbeLog(logPath, `probe error: ${message}`)
    if (sampler) {
      sampler.running = false
      await sampler.done
      state.samples = sampler.samples
    }
    report = {
      browser: {
        checkpoint: state.browserCheckpoint,
        evidencePath: null,
        status: 'manual-required',
      },
      capturedAt,
      error: message,
      runtime: { sampleIntervalMs: SAMPLE_INTERVAL_MS, samples: state.samples },
      runId,
      schemaVersion: 1,
      server: {
        listenerPid: state.listenerPid ?? null,
        listenerReadyMs: state.listenerReadyMs ?? null,
        logPath,
        serverPid: state.serverPid ?? null,
      },
      status: 'error' satisfies ProbeStatus,
      target: { surface: options.surface, url },
    }
    process.stderr.write(`${message}\n`)
    exitCode = 2
  } finally {
    try {
      await cleanupResources()
    } catch (error) {
      const message = getErrorMessage(error)
      process.stderr.write(`Failed to stop spawned process group: ${message}\n`)
      report = markCleanupFailure(report ?? {}, message)
      exitCode = 2
    }
    process.off('SIGINT', handleSigint)
    process.off('SIGTERM', handleSigterm)
  }

  await writeReport(options.outputPath, report ?? { status: 'error' })
  process.stdout.write(`${JSON.stringify({ exitCode, outputPath: options.outputPath }, null, 2)}\n`)
  return exitCode
}

async function main(): Promise<number> {
  let options: ProbeOptions
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${getErrorMessage(error)}\n\n${USAGE}`)
    return 2
  }
  return runProbe(options)
}

if (import.meta.main) process.exit(await main())
