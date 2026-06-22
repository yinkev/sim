import { describe, expect, it, vi } from 'vitest'
import { evaluateStrictE2EPreflight, formatStrictE2EPreflight } from '@/smoke/strict-e2e-preflight'

const READY_ENV = {
  DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/sim',
  SIM_AGENT_API_URL: 'http://127.0.0.1:6891',
  SIM_BASE_URL: 'http://127.0.0.1:3000',
  SIM_TO_MOTHERSHIP_API_KEY: 'runtime-secret-at-least-16',
  MOTHERSHIP_ADMIN_API_KEY: 'admin-secret-at-least-16',
  MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
  MOTHERSHIP_ANTHROPIC_API_KEY: 'anthropic-secret',
  MOTHERSHIP_OPENAI_API_KEY: 'openai-secret',
} as const satisfies NodeJS.ProcessEnv

const CLIPROXY_READY_ENV = {
  DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/sim',
  SIM_AGENT_API_URL: 'http://127.0.0.1:6891',
  SIM_BASE_URL: 'http://127.0.0.1:3000',
  SIM_TO_MOTHERSHIP_API_KEY: 'runtime-secret-at-least-16',
  MOTHERSHIP_ADMIN_API_KEY: 'admin-secret-at-least-16',
  MOTHERSHIP_TO_SIM_CALLBACK_KEY: 'callback-secret-at-least-16',
  MOTHERSHIP_DEFAULT_PROVIDER: 'cliproxyapi',
  MOTHERSHIP_CLIPROXY_API_KEY: 'proxy-secret',
  MOTHERSHIP_CLIPROXY_BASE_URL: 'http://localhost:8317',
} as const satisfies NodeJS.ProcessEnv

describe('strict E2E preflight', () => {
  it('reports missing required env names without secret values', async () => {
    const result = await evaluateStrictE2EPreflight({})

    expect(result.status).toBe('blocked')
    expect(result.issues.map((issue) => issue.key)).toContain('MOTHERSHIP_OPENAI_API_KEY')
    const formatted = formatStrictE2EPreflight(result)
    expect(formatted).toContain('MOTHERSHIP_OPENAI_API_KEY')
    expect(formatted).not.toContain('openai-secret')
  })

  it('rejects hosted copilot as the strict-mode Mothership target', async () => {
    const result = await evaluateStrictE2EPreflight({
      ...READY_ENV,
      SIM_AGENT_API_URL: 'https://copilot.sim.ai',
    })

    expect(result.status).toBe('blocked')
    expect(result.issues).toContainEqual({
      code: 'hosted_mothership_target',
      key: 'SIM_AGENT_API_URL',
      message: 'SIM_AGENT_API_URL must point at the owned Mothership service, not copilot.sim.ai.',
    })
  })

  it('rejects service secret reuse before real-key E2E runs', async () => {
    const result = await evaluateStrictE2EPreflight({
      ...READY_ENV,
      INTERNAL_API_SECRET: 'callback-secret-at-least-16',
    })

    expect(result.status).toBe('blocked')
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid_secret_topology',
          message: 'MOTHERSHIP_TO_SIM_CALLBACK_KEY must not reuse INTERNAL_API_SECRET',
        }),
      ])
    )
  })

  it('passes without network checks when required topology is present', async () => {
    const result = await evaluateStrictE2EPreflight(READY_ENV)

    expect(result).toEqual({ status: 'ready', issues: [] })
  })

  it('passes cliproxy provider preflight without Anthropic or OpenAI provider keys', async () => {
    const result = await evaluateStrictE2EPreflight(CLIPROXY_READY_ENV)

    expect(result).toEqual({ status: 'ready', issues: [] })
  })

  it('rejects unsafe CliProxyAPI base URLs before network checks', async () => {
    const result = await evaluateStrictE2EPreflight({
      ...CLIPROXY_READY_ENV,
      MOTHERSHIP_CLIPROXY_BASE_URL: 'http://user:pass@localhost:8317',
    })

    expect(result).toEqual({
      status: 'blocked',
      issues: [
        {
          code: 'invalid_url',
          key: 'MOTHERSHIP_CLIPROXY_BASE_URL',
          message: 'MOTHERSHIP_CLIPROXY_BASE_URL must not include URL credentials.',
        },
      ],
    })
  })

  it('blocks when required Mothership database tables are missing', async () => {
    const result = await evaluateStrictE2EPreflight(CLIPROXY_READY_ENV, {
      checkDatabase: true,
      databaseSchemaCheck: async () => [
        {
          code: 'missing_database_table',
          key: 'DATABASE_URL',
          message:
            'Mothership database schema is missing required table(s): copilot_run_events. Run packages/db migrations against this DATABASE_URL first.',
        },
      ],
    })

    expect(result).toEqual({
      status: 'blocked',
      issues: [
        {
          code: 'missing_database_table',
          key: 'DATABASE_URL',
          message:
            'Mothership database schema is missing required table(s): copilot_run_events. Run packages/db migrations against this DATABASE_URL first.',
        },
      ],
    })
  })

  it('blocks when required Mothership database schema objects are missing', async () => {
    const result = await evaluateStrictE2EPreflight(CLIPROXY_READY_ENV, {
      checkDatabase: true,
      databaseSchemaCheck: async () => [
        {
          code: 'invalid_database_schema',
          key: 'DATABASE_URL',
          message:
            'Mothership database schema is missing required object(s): copilot_run_events.envelope jsonb. Run packages/db migrations against this DATABASE_URL first.',
        },
      ],
    })

    expect(result).toEqual({
      status: 'blocked',
      issues: [
        {
          code: 'invalid_database_schema',
          key: 'DATABASE_URL',
          message:
            'Mothership database schema is missing required object(s): copilot_run_events.envelope jsonb. Run packages/db migrations against this DATABASE_URL first.',
        },
      ],
    })
  })

  it('checks owned Mothership health and readiness when requested', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const result = await evaluateStrictE2EPreflight(READY_ENV, {
      checkNetwork: true,
      fetch: fetchMock,
    })

    expect(result).toEqual({ status: 'ready', issues: [] })
    expect(fetchMock).toHaveBeenCalledWith(new URL('/health', READY_ENV.SIM_AGENT_API_URL))
    expect(fetchMock).toHaveBeenCalledWith(new URL('/ready', READY_ENV.SIM_AGENT_API_URL), {
      headers: {
        'x-mothership-runtime-key': READY_ENV.SIM_TO_MOTHERSHIP_API_KEY,
      },
    })
  })

  it('checks CliProxyAPI models when cliproxy provider network checks are requested', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'gpt-5.5' }] }), { status: 200 })
      )

    const result = await evaluateStrictE2EPreflight(CLIPROXY_READY_ENV, {
      checkNetwork: true,
      fetch: fetchMock,
    })

    expect(result).toEqual({ status: 'ready', issues: [] })
    expect(fetchMock).toHaveBeenCalledWith(new URL('/health', CLIPROXY_READY_ENV.SIM_AGENT_API_URL))
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/ready', CLIPROXY_READY_ENV.SIM_AGENT_API_URL),
      {
        headers: {
          'x-mothership-runtime-key': CLIPROXY_READY_ENV.SIM_TO_MOTHERSHIP_API_KEY,
        },
      }
    )
    expect(fetchMock).toHaveBeenCalledWith(new URL('http://localhost:8317/v1/models'), {
      headers: {
        authorization: 'Bearer proxy-secret',
      },
    })
  })

  it('blocks when CliProxyAPI models response omits the selected model', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'other-model' }] }), { status: 200 })
      )

    const result = await evaluateStrictE2EPreflight(
      {
        ...CLIPROXY_READY_ENV,
        MOTHERSHIP_CLIPROXY_MODEL: 'gpt-5.5',
      },
      {
        checkNetwork: true,
        fetch: fetchMock,
      }
    )

    expect(result).toEqual({
      status: 'blocked',
      issues: [
        {
          code: 'not_ready',
          key: 'MOTHERSHIP_CLIPROXY_MODEL',
          message: 'CliProxyAPI /v1/models did not include selected model gpt-5.5.',
        },
      ],
    })
  })

  it('blocks when CliProxyAPI models response is malformed', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))

    const result = await evaluateStrictE2EPreflight(CLIPROXY_READY_ENV, {
      checkNetwork: true,
      fetch: fetchMock,
    })

    expect(result).toEqual({
      status: 'blocked',
      issues: [
        {
          code: 'not_ready',
          key: 'MOTHERSHIP_CLIPROXY_MODEL',
          message: 'CliProxyAPI /v1/models did not include selected model gpt-5.5.',
        },
      ],
    })
  })
})
