import {
  adminByokGetContract,
  copilotRuntimeContract,
  explicitAbortContract,
  forkChatContract,
  generateChatTitleContract,
  getAvailableModelsContract,
  validateKeyListContract,
} from '@sim/mothership-contracts/routes'
import { describe, expect, it } from 'vitest'
import { createMothershipAdminHeaders, createMothershipRuntimeHeaders } from './auth'
import { type MothershipContractBody, type MothershipFetch, requestMothership } from './client'

function createFetch(
  response: Response,
  calls: Array<{ url: string; init?: RequestInit }>
): MothershipFetch {
  return async (input, init) => {
    calls.push({ url: input.toString(), init })
    return response
  }
}

describe('requestMothership', () => {
  it('validates requests, builds URLs, and parses JSON responses', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const data = await requestMothership(
      getAvailableModelsContract,
      {
        baseUrl: 'https://mothership.example.com',
        fetch: createFetch(Response.json({ success: true, models: [] }), calls),
      },
      {
        headers: createMothershipRuntimeHeaders('runtime-key'),
      }
    )

    expect(data).toEqual({ success: true, models: [] })
    expect(calls[0]?.url).toBe('https://mothership.example.com/api/get-available-models')
    expect(calls[0]?.init?.method).toBe('GET')
    expect(new Headers(calls[0]?.init?.headers).get('x-mothership-runtime-key')).toBe('runtime-key')
  })

  it('strips undeclared model descriptor fields from successful responses', async () => {
    const data = await requestMothership(
      getAvailableModelsContract,
      {
        baseUrl: 'https://mothership.example.com',
        fetch: createFetch(
          Response.json({
            success: true,
            models: [
              {
                id: 'model-1',
                friendlyName: 'Model One',
                provider: 'openai',
                leaked: 'do-not-return',
              },
            ],
          }),
          []
        ),
      },
      {
        headers: createMothershipRuntimeHeaders('runtime-key'),
      }
    )

    expect(data).toEqual({
      success: true,
      models: [{ id: 'model-1', friendlyName: 'Model One', provider: 'openai' }],
    })
  })

  it('rejects impossible available-model success and error states', async () => {
    await expect(
      requestMothership(
        getAvailableModelsContract,
        {
          baseUrl: 'https://mothership.example.com',
          fetch: createFetch(Response.json({ success: true, error: 'bad', models: [] }), []),
        },
        {
          headers: createMothershipRuntimeHeaders('runtime-key'),
        }
      )
    ).rejects.toMatchObject({
      name: 'MothershipClientError',
      message: 'Mothership response failed contract validation',
    })

    await expect(
      requestMothership(
        getAvailableModelsContract,
        {
          baseUrl: 'https://mothership.example.com',
          fetch: createFetch(Response.json({ success: false, models: [] }), []),
        },
        {
          headers: createMothershipRuntimeHeaders('runtime-key'),
        }
      )
    ).rejects.toMatchObject({
      name: 'MothershipClientError',
      message: 'Mothership response failed contract validation',
    })
  })

  it('serializes body payloads and sets content-type for JSON requests', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    await requestMothership(
      explicitAbortContract,
      {
        baseUrl: 'https://mothership.example.com/',
        fetch: createFetch(Response.json({ success: true }), calls),
      },
      {
        headers: createMothershipRuntimeHeaders('runtime-key'),
        body: {
          messageId: 'message-1',
          userId: 'user-1',
          chatId: 'chat-1',
        },
      }
    )

    expect(calls[0]?.url).toBe('https://mothership.example.com/api/streams/explicit-abort')
    expect(new Headers(calls[0]?.init?.headers).get('content-type')).toBe('application/json')
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ messageId: 'message-1', userId: 'user-1', chatId: 'chat-1' })
    )
  })

  it('translates strict runtime headers to legacy x-api-key when requested', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    await requestMothership(
      getAvailableModelsContract,
      {
        baseUrl: 'https://mothership.example.com',
        fetch: createFetch(Response.json({ success: true, models: [] }), calls),
        headerMode: 'legacy-runtime',
      },
      {
        headers: createMothershipRuntimeHeaders('runtime-key', { sourceEnv: 'staging' }),
      }
    )

    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('x-api-key')).toBe('runtime-key')
    expect(headers.get('x-mothership-runtime-key')).toBeNull()
    expect(headers.get('x-sim-source-env')).toBe('staging')
  })

  it('rejects legacy x-api-key in strict contract mode', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    await expect(
      requestMothership(
        getAvailableModelsContract,
        {
          baseUrl: 'https://mothership.example.com',
          fetch: createFetch(Response.json({ success: true, models: [] }), calls),
        },
        {
          headers: {
            ...createMothershipRuntimeHeaders('runtime-key'),
            'x-api-key': 'legacy-key',
          },
        }
      )
    ).rejects.toMatchObject({
      name: 'MothershipClientError',
      message: 'Contract header mode does not allow legacy x-api-key',
      status: 0,
    })
    expect(calls).toHaveLength(0)
  })

  it('rejects differently cased legacy x-api-key in strict contract mode', async () => {
    await expect(
      requestMothership(
        getAvailableModelsContract,
        {
          baseUrl: 'https://mothership.example.com',
          fetch: createFetch(Response.json({ success: true, models: [] }), []),
        },
        {
          headers: {
            ...createMothershipRuntimeHeaders('runtime-key'),
            'X-Api-Key': 'legacy-key',
          },
        }
      )
    ).rejects.toMatchObject({
      name: 'MothershipClientError',
      message: 'Contract header mode does not allow legacy x-api-key',
      status: 0,
    })
  })

  it('translates strict admin headers to legacy x-api-key when requested', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    await requestMothership(
      adminByokGetContract,
      {
        baseUrl: 'https://mothership.example.com',
        fetch: createFetch(Response.json({ providers: [] }), calls),
        headerMode: 'legacy-admin',
      },
      {
        headers: createMothershipAdminHeaders('admin-key'),
        query: {},
      }
    )

    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get('x-api-key')).toBe('admin-key')
    expect(headers.get('x-mothership-admin-key')).toBeNull()
  })

  it('rejects legacy mode when the matching strict header family is missing', async () => {
    await expect(
      requestMothership(
        getAvailableModelsContract,
        {
          baseUrl: 'https://mothership.example.com',
          fetch: createFetch(Response.json({ success: true, models: [] }), []),
          headerMode: 'legacy-admin',
        },
        {
          headers: createMothershipRuntimeHeaders('runtime-key'),
        }
      )
    ).rejects.toMatchObject({
      name: 'MothershipClientError',
      message: 'Legacy admin mode requires admin headers',
      status: 0,
    })
  })

  it('serializes query payloads', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    await requestMothership(
      validateKeyListContract,
      {
        baseUrl: 'https://mothership.example.com',
        fetch: createFetch(Response.json([]), calls),
      },
      {
        headers: createMothershipRuntimeHeaders('runtime-key'),
        body: { userId: 'user-1' },
      }
    )

    expect(calls[0]?.url).toBe('https://mothership.example.com/api/validate-key/get-api-keys')
  })

  it('returns the raw response for stream contracts', async () => {
    const response = new Response('data: {}\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    })

    const data = await requestMothership(
      copilotRuntimeContract,
      {
        baseUrl: 'https://mothership.example.com',
        fetch: createFetch(response, []),
      },
      {
        headers: createMothershipRuntimeHeaders('runtime-key'),
        body: {
          message: 'hello',
          userId: 'user-1',
          messageId: 'message-1',
          chatId: 'chat-1',
          executionId: 'exec-1',
          runId: 'run-1',
          workspaceId: 'workspace-1',
        },
      }
    )

    expect(data).toBe(response)
  })

  it('enforces durable runtime identity without adding it to title or fork contracts', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    await expect(
      requestMothership(
        copilotRuntimeContract,
        {
          baseUrl: 'https://mothership.example.com',
          fetch: createFetch(new Response('data: {}\n\n'), calls),
        },
        {
          headers: createMothershipRuntimeHeaders('runtime-key'),
          body: {
            message: 'hello',
            userId: 'user-1',
            messageId: 'message-1',
          } as MothershipContractBody<typeof copilotRuntimeContract>,
        }
      )
    ).rejects.toMatchObject({
      name: 'MothershipClientError',
      message: 'Invalid Mothership request body',
    })
    expect(calls).toHaveLength(0)

    await requestMothership(
      generateChatTitleContract,
      {
        baseUrl: 'https://mothership.example.com',
        fetch: createFetch(Response.json({ title: 'Durable Replay' }), calls),
      },
      {
        headers: createMothershipRuntimeHeaders('runtime-key'),
        body: {
          message: 'hello',
          model: 'claude-opus-4-8',
        },
      }
    )

    await requestMothership(
      forkChatContract,
      {
        baseUrl: 'https://mothership.example.com',
        fetch: createFetch(Response.json({ success: true }), calls),
      },
      {
        headers: createMothershipRuntimeHeaders('runtime-key'),
        body: {
          sourceChatId: 'source-chat-1',
          newChatId: 'new-chat-1',
          userId: 'user-1',
        },
      }
    )

    expect(calls.map((call) => call.url)).toEqual([
      'https://mothership.example.com/api/generate-chat-title',
      'https://mothership.example.com/api/chats/fork',
    ])
  })

  it('rejects invalid request payloads before fetch', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    await expect(
      requestMothership(
        explicitAbortContract,
        {
          baseUrl: 'https://mothership.example.com',
          fetch: createFetch(Response.json({ success: true }), calls),
        },
        {
          headers: createMothershipRuntimeHeaders('runtime-key'),
          body: { userId: 'user-1' } as MothershipContractBody<typeof explicitAbortContract>,
        }
      )
    ).rejects.toMatchObject({
      name: 'MothershipClientError',
      message: 'Invalid Mothership request body',
      status: 0,
    })
    expect(calls).toHaveLength(0)
  })

  it('rejects invalid response payloads', async () => {
    await expect(
      requestMothership(
        getAvailableModelsContract,
        {
          baseUrl: 'https://mothership.example.com',
          fetch: createFetch(Response.json({ success: true }), []),
        },
        {
          headers: createMothershipRuntimeHeaders('runtime-key'),
        }
      )
    ).rejects.toMatchObject({
      name: 'MothershipClientError',
      message: 'Mothership response failed contract validation',
    })
  })

  it('throws typed errors for non-ok responses', async () => {
    await expect(
      requestMothership(
        getAvailableModelsContract,
        {
          baseUrl: 'https://mothership.example.com',
          fetch: createFetch(Response.json({ error: 'nope' }, { status: 403 }), []),
        },
        {
          headers: createMothershipRuntimeHeaders('runtime-key'),
        }
      )
    ).rejects.toMatchObject({
      name: 'MothershipClientError',
      status: 403,
      body: { error: 'nope' },
    })
  })
})
