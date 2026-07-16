import { describe, expect, test } from 'bun:test'
import {
  assertNoActiveDevLock,
  calculateIdleCpuPercent,
  collectProcessTree,
  createIdempotentCleanup,
  httpSamplesMatchTarget,
  markCleanupFailure,
  median,
  parseArgs,
  parseCpuTimeMs,
  parseCurlMetrics,
  parsePsOutput,
  runSignalCleanup,
  validateBrowserEvidence,
} from './probe-dev-performance'

describe('parseArgs', () => {
  test('parses a main-surface probe', () => {
    expect(
      parseArgs([
        '--surface=main',
        '--route=/workspace/local-test/chat/new',
        '--output=var/center/evidence/architecture/performance/main.json',
        '--browser-evidence=var/center/evidence/architecture/performance/main.browser.json',
      ])
    ).toEqual({
      browserEvidencePath: 'var/center/evidence/architecture/performance/main.browser.json',
      outputPath: 'var/center/evidence/architecture/performance/main.json',
      route: '/workspace/local-test/chat/new',
      skipBrowserWait: false,
      surface: 'main',
    })
  })

  test('allows the explicit automated partial-evidence mode', () => {
    expect(
      parseArgs([
        '--surface=studio',
        '--route=/workspace/workspace-1/w/workflow-1',
        '--output=var/center/evidence/architecture/performance/studio.json',
        '--skip-browser-wait',
      ])
    ).toMatchObject({ skipBrowserWait: true, surface: 'studio' })
  })

  test('rejects output outside the canonical evidence root', () => {
    expect(() =>
      parseArgs([
        '--surface=main',
        '--route=/workspace/local-test/chat/new',
        '--output=/tmp/main.json',
      ])
    ).toThrow('output must be a canonical relative path under var/center/evidence/')
  })

  test('rejects browser evidence that would overwrite the report', () => {
    expect(() =>
      parseArgs([
        '--surface=main',
        '--route=/workspace/local-test/chat/new',
        '--output=var/center/evidence/architecture/performance/main.json',
        '--browser-evidence=var/center/evidence/architecture/performance/main.json',
      ])
    ).toThrow('browser-evidence must not overwrite output or the server log')
  })

  test('rejects browser evidence that would overwrite the server log', () => {
    expect(() =>
      parseArgs([
        '--surface=main',
        '--route=/workspace/local-test/chat/new',
        '--output=var/center/evidence/architecture/performance/main.json',
        '--browser-evidence=var/center/evidence/architecture/performance/main.server.log',
      ])
    ).toThrow('browser-evidence must not overwrite output or the server log')
  })
})

describe('parseCpuTimeMs', () => {
  test('parses macOS ps TIME values including days and centiseconds', () => {
    expect(parseCpuTimeMs('01:02.34')).toBe(62_340)
    expect(parseCpuTimeMs('576:10.71')).toBe(34_570_710)
    expect(parseCpuTimeMs('02:03:04.50')).toBe(7_384_500)
    expect(parseCpuTimeMs('1-02:03:04.50')).toBe(93_784_500)
  })

  test('rejects malformed TIME values', () => {
    expect(() => parseCpuTimeMs('not-time')).toThrow('Invalid ps TIME value')
  })
})

describe('parsePsOutput', () => {
  test('parses macOS ps rows with command and arguments', () => {
    expect(
      parsePsOutput(`
        100     1  2048   0.0   00:01.25 /usr/local/bin/bun run dev:capped
        101   100  4096  12.5   01:02:03.40 next-server (v15.5.7)
      `)
    ).toEqual([
      {
        command: '/usr/local/bin/bun run dev:capped',
        cpuPercent: 0,
        cpuTimeMs: 1_250,
        pid: 100,
        ppid: 1,
        rssBytes: 2_097_152,
      },
      {
        command: 'next-server (v15.5.7)',
        cpuPercent: 12.5,
        cpuTimeMs: 3_723_400,
        pid: 101,
        ppid: 100,
        rssBytes: 4_194_304,
      },
    ])
  })
})

describe('collectProcessTree', () => {
  test('collects the listener and recursive descendants only', () => {
    const rows = parsePsOutput(`
      10 1 100 0.0 00:00.10 listener
      11 10 200 0.0 00:00.20 child
      12 11 300 0.0 00:00.30 grandchild
      20 1 400 0.0 00:00.40 unrelated
    `)

    expect(collectProcessTree(rows, 10).map(({ pid }) => pid)).toEqual([10, 11, 12])
  })
})

describe('median', () => {
  test('returns the middle value or midpoint', () => {
    expect(median([9, 1, 5])).toBe(5)
    expect(median([9, 1, 5, 3])).toBe(4)
  })

  test('rejects an empty sample', () => {
    expect(() => median([])).toThrow('Cannot calculate median of an empty sample')
  })
})

describe('parseCurlMetrics', () => {
  test('parses the curl write-out record', () => {
    expect(parseCurlMetrics('200\t0.123456\t0.150000\t69799\t0\thttp://127.0.0.1:6888/x')).toEqual({
      bytes: 69_799,
      finalUrl: 'http://127.0.0.1:6888/x',
      redirects: 0,
      status: 200,
      totalMs: 150,
      ttfbMs: 123.456,
    })
  })

  test('requires exact target URLs without redirects', () => {
    const targetUrl = 'http://127.0.0.1:6888/workspace/local-test/chat/new'
    const sample = parseCurlMetrics(`200\t0.1\t0.2\t10\t0\t${targetUrl}`)

    expect(httpSamplesMatchTarget([sample], targetUrl)).toBe(true)
    expect(httpSamplesMatchTarget([{ ...sample, redirects: 1 }], targetUrl)).toBe(false)
    expect(
      httpSamplesMatchTarget([{ ...sample, finalUrl: 'http://127.0.0.1:6888/login' }], targetUrl)
    ).toBe(false)
  })
})

describe('runtime hardening', () => {
  test('rejects an actively held Next development lock', () => {
    expect(() => assertNoActiveDevLock(4321)).toThrow(
      'apps/sim/.next/dev is locked by active PID 4321'
    )
    expect(() => assertNoActiveDevLock(null)).not.toThrow()
  })

  test('runs cleanup at most once', async () => {
    let calls = 0
    const cleanup = createIdempotentCleanup(async () => {
      calls += 1
    })
    await Promise.all([cleanup(), cleanup(), cleanup()])

    expect(calls).toBe(1)
  })

  test('waits for signal cleanup before exiting', async () => {
    const events: string[] = []
    await runSignalCleanup(
      async () => {
        events.push('cleanup')
      },
      (message) => events.push(`error:${message}`),
      (code) => events.push(`exit:${code}`)
    )

    expect(events).toEqual(['cleanup', 'exit:2'])
  })

  test('marks cleanup failures as non-passing evidence', () => {
    expect(markCleanupFailure({ status: 'pass' }, 'EPERM')).toEqual({
      cleanup: { error: 'EPERM', status: 'fail' },
      status: 'error',
    })
  })
})

describe('calculateIdleCpuPercent', () => {
  test('uses positive per-process cumulative CPU deltas for a stable process tree', () => {
    expect(
      calculateIdleCpuPercent([
        { elapsedMs: 0, processCpuTimeMs: { '10': 100, '11': 200 } },
        { elapsedMs: 1_000, processCpuTimeMs: { '10': 150, '11': 250 } },
        { elapsedMs: 2_000, processCpuTimeMs: { '10': 200, '11': 300 } },
      ])
    ).toBe(10)
  })

  test('rejects idle CPU evidence when the process tree changes', () => {
    expect(() =>
      calculateIdleCpuPercent([
        { elapsedMs: 0, processCpuTimeMs: { '10': 100, '11': 200 } },
        { elapsedMs: 1_000, processCpuTimeMs: { '10': 150, '12': 25 } },
      ])
    ).toThrow('Idle CPU process tree changed during sampling')
  })
})

describe('validateBrowserEvidence', () => {
  const targetUrl = 'http://127.0.0.1:6888/workspace/local-test/chat/new'
  const studioTargetUrl = 'http://127.0.0.1:6888/workspace/local-test/w/workflow-2'
  const capturedAt = '2026-07-16T12:00:01.000Z'
  const runStartedAtMs = Date.parse('2026-07-16T12:00:00.000Z')
  const validatedAtMs = Date.parse('2026-07-16T12:00:02.000Z')
  const runId = 'probe-run-1'

  test('accepts current main-surface evidence with all required checks', () => {
    expect(
      validateBrowserEvidence(
        {
          capturedAt,
          checks: {
            inputReadiness: { status: 'pass', upperBoundMs: 250 },
            interaction: { status: 'pass' },
            warmNavigation: { status: 'pass', upperBoundMs: 400 },
          },
          runId,
          schemaVersion: 1,
          status: 'pass',
          targetUrl,
        },
        { runId, runStartedAtMs, surface: 'main', targetUrl, validatedAtMs }
      )
    ).toBe(true)
  })

  test('rejects stale or wrong-target evidence', () => {
    const evidence = {
      capturedAt: '2026-07-16T11:59:59.000Z',
      checks: {
        inputReadiness: { status: 'pass', upperBoundMs: 250 },
        interaction: { status: 'pass' },
        warmNavigation: { status: 'pass', upperBoundMs: 400 },
      },
      runId,
      schemaVersion: 1,
      status: 'pass',
      targetUrl,
    }
    expect(
      validateBrowserEvidence(evidence, {
        runId,
        runStartedAtMs,
        surface: 'main',
        targetUrl,
        validatedAtMs,
      })
    ).toBe(false)
    expect(
      validateBrowserEvidence(
        { ...evidence, capturedAt, targetUrl: `${targetUrl}/wrong` },
        { runId, runStartedAtMs, surface: 'main', targetUrl, validatedAtMs }
      )
    ).toBe(false)
  })

  test('rejects wrong-run or future browser evidence', () => {
    const evidence = {
      capturedAt,
      checks: {
        inputReadiness: { status: 'pass', upperBoundMs: 250 },
        interaction: { status: 'pass' },
        warmNavigation: { status: 'pass', upperBoundMs: 400 },
      },
      runId,
      schemaVersion: 1,
      status: 'pass',
      targetUrl,
    }
    const options = { runId, runStartedAtMs, surface: 'main' as const, targetUrl, validatedAtMs }

    expect(validateBrowserEvidence({ ...evidence, runId: 'old-run' }, options)).toBe(false)
    expect(
      validateBrowserEvidence({ ...evidence, capturedAt: '2026-07-16T12:01:00.000Z' }, options)
    ).toBe(false)
  })

  test('rejects missing, failed, or over-budget main checks', () => {
    const evidence = {
      capturedAt,
      checks: {
        inputReadiness: { status: 'pass', upperBoundMs: 500 },
        interaction: { status: 'pass' },
        warmNavigation: { status: 'pass', upperBoundMs: 400 },
      },
      runId,
      schemaVersion: 1,
      status: 'pass',
      targetUrl,
    }
    expect(
      validateBrowserEvidence(evidence, {
        runId,
        runStartedAtMs,
        surface: 'main',
        targetUrl,
        validatedAtMs,
      })
    ).toBe(false)
    expect(
      validateBrowserEvidence(
        { ...evidence, checks: { ...evidence.checks, interaction: { status: 'fail' } } },
        { runId, runStartedAtMs, surface: 'main', targetUrl, validatedAtMs }
      )
    ).toBe(false)
  })

  test('accepts Studio evidence without an input-readiness check', () => {
    expect(
      validateBrowserEvidence(
        {
          capturedAt,
          checks: {
            interaction: { status: 'pass' },
            warmNavigation: {
              status: 'pass',
              upperBoundMs: 2_500,
              visitedUrls: [
                'http://127.0.0.1:6888/workspace/local-test/w/workflow-1',
                'http://127.0.0.1:6888/workspace/local-test/w/workflow-2',
              ],
            },
          },
          runId,
          schemaVersion: 1,
          status: 'pass',
          targetUrl: studioTargetUrl,
        },
        {
          runId,
          runStartedAtMs,
          surface: 'studio',
          targetUrl: studioTargetUrl,
          validatedAtMs,
        }
      )
    ).toBe(true)
  })

  test('rejects Studio evidence that omits measured navigation routes', () => {
    expect(
      validateBrowserEvidence(
        {
          capturedAt,
          checks: {
            interaction: { status: 'pass' },
            warmNavigation: { status: 'pass', upperBoundMs: 2_500 },
          },
          runId,
          schemaVersion: 1,
          status: 'pass',
          targetUrl: studioTargetUrl,
        },
        {
          runId,
          runStartedAtMs,
          surface: 'studio',
          targetUrl: studioTargetUrl,
          validatedAtMs,
        }
      )
    ).toBe(false)
  })

  test('rejects Studio evidence that visits another surface', () => {
    expect(
      validateBrowserEvidence(
        {
          capturedAt,
          checks: {
            interaction: { status: 'pass' },
            warmNavigation: {
              status: 'pass',
              upperBoundMs: 2_500,
              visitedUrls: [
                'http://127.0.0.1:6888/workspace/local-test/w/workflow-1',
                'http://127.0.0.1:6888/workspace/local-test/home',
                'http://127.0.0.1:6888/workspace/local-test/w/workflow-2',
              ],
            },
          },
          runId,
          schemaVersion: 1,
          status: 'pass',
          targetUrl: studioTargetUrl,
        },
        {
          runId,
          runStartedAtMs,
          surface: 'studio',
          targetUrl: studioTargetUrl,
          validatedAtMs,
        }
      )
    ).toBe(false)
  })
})
