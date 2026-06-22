import { createLogger } from '@sim/logger'
import {
  adminByokBodySchema,
  adminByokDeleteContract,
  adminByokGetContract,
  adminByokPostContract,
  adminByokQuerySchema,
  adminProcessBillingCallbacksBodySchema,
  adminProcessBillingCallbacksContract,
  copilotRuntimeContract,
  explicitAbortBodySchema,
  explicitAbortContract,
  forkChatBodySchema,
  forkChatContract,
  generateChatTitleBodySchema,
  generateChatTitleContract,
  getAvailableModelsContract,
  mothershipChatBodySchema,
  mothershipExecuteRuntimeContract,
  mothershipRuntimeContract,
  resumeToolsBodySchema,
  resumeToolsContract,
  streamReplayBatchContract,
  streamReplayContract,
  streamReplayQuerySchema,
  validateKeyDeleteBodySchema,
  validateKeyDeleteContract,
  validateKeyGenerateBodySchema,
  validateKeyGenerateContract,
  validateKeyListBodySchema,
  validateKeyListContract,
} from '@sim/mothership-contracts/routes'
import { generateId } from '@sim/utils/id'
import { authenticateServiceRequest } from '@/auth'
import {
  type MothershipApiKeyEntitlementResult,
  processPendingMothershipBillingUsageCallbacks,
  validateMothershipApiKeyEntitlement,
} from '@/callbacks'
import type { MothershipEnv } from '@/env'
import {
  availableModelsResponse,
  availableModelsUnavailableResponse,
  getConfiguredModels,
} from '@/models'
import {
  canResumeOwnedProviderRequest,
  generateOwnedChatTitle,
  resolveOwnedProviderSelection,
  runOwnedProviderContinuation,
  runOwnedProviderResume,
} from '@/provider-runtime'
import { jsonResponse } from '@/response'
import {
  deleteMothershipApiKey,
  generateMothershipApiKey,
  listMothershipApiKeys,
} from '@/state/api-key-store'
import {
  deleteMothershipByokProviderKeys,
  listMothershipByokProviders,
  upsertMothershipByokProviderKey,
} from '@/state/byok-store'
import { acknowledgeMothershipChatFork } from '@/state/chat-store'
import {
  getMothershipResumeCheckpoint,
  type MothershipResumeCheckpointRecord,
  type RecordResumeResultsResult,
  recordMothershipResumeToolResults,
} from '@/state/resume-store'
import {
  claimMothershipRuntimeRun,
  getMothershipRunByStream,
  markMothershipRunCancelled,
  markMothershipRunFailed,
} from '@/state/run-store'
import { readMothershipRunEvents } from '@/state/stream-event-store'
import { mothershipStreamResponse, replayStreamResponse } from '@/stream'

const logger = createLogger('MothershipHTTP')

export interface MothershipAppState {
  shuttingDown: boolean
}

function getRequestId(request: Request): string {
  return (
    request.headers.get('x-request-id') || request.headers.get('x-sim-request-id') || generateId()
  )
}

async function readJsonBody(
  request: Request,
  requestId: string
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: (await request.json()) as unknown }
  } catch {
    return {
      ok: false,
      response: jsonResponse(
        {
          success: false,
          error: 'Invalid JSON body',
          code: 'invalid_json_body',
        },
        { status: 400, requestId }
      ),
    }
  }
}

function resumeFailureResponse(
  result: Exclude<RecordResumeResultsResult, { status: 'ready' }>,
  requestId: string
): Response {
  switch (result.status) {
    case 'missing_checkpoint':
      return jsonResponse(
        {
          success: false,
          error: 'Checkpoint not found',
          code: 'checkpoint_not_found',
        },
        { status: 404, requestId }
      )
    case 'run_not_resumable':
      return jsonResponse(
        {
          success: false,
          error: 'Run is not resumable',
          code: 'run_not_resumable',
          status: result.runStatus,
        },
        { status: 409, requestId }
      )
    case 'invalid_results':
      return jsonResponse(
        {
          success: false,
          error: 'Invalid resume tool results',
          code: result.reason,
          toolCallIds: result.toolCallIds,
        },
        { status: 400, requestId }
      )
    case 'checkpoint_already_consumed':
      return jsonResponse(
        {
          success: false,
          error: 'Checkpoint has already been consumed',
          code: 'checkpoint_already_consumed',
          toolCallIds: result.toolCallIds,
        },
        { status: 409, requestId }
      )
    case 'result_conflict':
      return jsonResponse(
        {
          success: false,
          error: 'Resume tool results conflict with durable state',
          code: 'result_conflict',
          toolCallIds: result.toolCallIds,
        },
        { status: 409, requestId }
      )
  }
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function getResumeEntitlementWorkspaceId(
  checkpoint: MothershipResumeCheckpointRecord
): string | undefined {
  return getOptionalString(checkpoint.workspaceId)
}

function parseReplayCursor(after: string): number | null {
  if (!/^\d+$/.test(after)) return null
  const parsed = Number(after)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function isRuntimeStreamRequest(method: string, pathname: string): boolean {
  return (
    (method === copilotRuntimeContract.method && pathname === copilotRuntimeContract.path) ||
    (method === mothershipRuntimeContract.method && pathname === mothershipRuntimeContract.path) ||
    (method === mothershipExecuteRuntimeContract.method &&
      pathname === mothershipExecuteRuntimeContract.path)
  )
}

function isAdminByokRequest(method: string, pathname: string): boolean {
  return (
    (method === adminByokGetContract.method && pathname === adminByokGetContract.path) ||
    (method === adminByokPostContract.method && pathname === adminByokPostContract.path) ||
    (method === adminByokDeleteContract.method && pathname === adminByokDeleteContract.path)
  )
}

function isValidateKeyRequest(method: string, pathname: string): boolean {
  return (
    (method === validateKeyListContract.method && pathname === validateKeyListContract.path) ||
    (method === validateKeyGenerateContract.method &&
      pathname === validateKeyGenerateContract.path) ||
    (method === validateKeyDeleteContract.method && pathname === validateKeyDeleteContract.path)
  )
}

function invalidAdminByokRequestResponse(requestId: string): Response {
  return jsonResponse(
    {
      success: false,
      error: 'Invalid BYOK admin request',
      code: 'invalid_request',
    },
    { status: 400, requestId }
  )
}

function apiKeyEntitlementFailureResponse(
  result: Exclude<MothershipApiKeyEntitlementResult, { status: 'ok' }>,
  requestId: string
): Response {
  if (result.status === 'misconfigured') {
    return jsonResponse(
      {
        success: false,
        error: 'Mothership to Sim callback configuration is missing',
        code: 'sim_callback_not_configured',
        missing: result.missing,
      },
      { status: 503, requestId }
    )
  }

  if (result.status === 'rejected') {
    return jsonResponse(
      {
        success: false,
        error: 'Mothership API-key validation failed',
        code: 'api_key_validation_failed',
        status: result.statusCode,
      },
      { status: result.statusCode, requestId }
    )
  }

  return jsonResponse(
    {
      success: false,
      error: 'Mothership API-key validation callback failed',
      code: 'api_key_validation_callback_failed',
    },
    { status: 502, requestId }
  )
}

export function createMothershipHandler(
  env: MothershipEnv,
  state: MothershipAppState = { shuttingDown: false }
): (request: Request) => Promise<Response> {
  const configuredModels = getConfiguredModels(env)

  return async (request) => {
    const requestId = getRequestId(request)
    const requestLogger = logger.withMetadata({ requestId })
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(
        {
          ok: true,
          service: 'mothership',
          status: state.shuttingDown ? 'shutting_down' : 'ok',
          requestId,
        },
        { requestId }
      )
    }

    if (request.method === 'GET' && url.pathname === '/ready') {
      const auth = authenticateServiceRequest(request, 'runtime', env, requestId)
      if (!auth.ok) return auth.response

      if (state.shuttingDown) {
        return jsonResponse(
          {
            ok: false,
            service: 'mothership',
            status: 'shutting_down',
            requestId,
          },
          { status: 503, requestId }
        )
      }

      requestLogger.info('Readiness check passed', {
        authFamily: auth.context.family,
        authFingerprint: auth.context.fingerprint,
        sourceEnv: auth.context.sourceEnv,
      })

      return jsonResponse(
        {
          ok: true,
          service: 'mothership',
          status: 'ready',
          requestId,
          auth: {
            family: auth.context.family,
            fingerprint: auth.context.fingerprint,
            ...(auth.context.sourceEnv ? { sourceEnv: auth.context.sourceEnv } : {}),
          },
        },
        { requestId }
      )
    }

    if (
      request.method === adminProcessBillingCallbacksContract.method &&
      url.pathname === adminProcessBillingCallbacksContract.path
    ) {
      const auth = authenticateServiceRequest(request, 'admin', env, requestId)
      if (!auth.ok) return auth.response

      const body = await readJsonBody(request, requestId)
      if (!body.ok) return body.response

      const parsedBody = adminProcessBillingCallbacksBodySchema.safeParse(body.data)
      if (!parsedBody.success) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid billing callback processor request',
            code: 'invalid_request',
          },
          { status: 400, requestId }
        )
      }

      const result = await processPendingMothershipBillingUsageCallbacks({
        env,
        batchSize: parsedBody.data.batchSize,
      })
      const hasNonCleanOutcome =
        result.deadLettered > 0 || result.leaseLost > 0 || result.reaped > 0 || result.retryable > 0

      requestLogger.info('Processed Mothership billing callback outbox batch', {
        authFamily: auth.context.family,
        authFingerprint: auth.context.fingerprint,
        sourceEnv: auth.context.sourceEnv,
        ...result,
      })

      if (parsedBody.data.failOnNonClean && hasNonCleanOutcome) {
        return jsonResponse(
          {
            success: false,
            error: 'Billing callback processor batch had non-clean outcomes',
            code: 'billing_callback_batch_not_clean',
            requestId,
            ...result,
          },
          { status: 503, requestId }
        )
      }

      return jsonResponse(
        adminProcessBillingCallbacksContract.response.schema.parse({
          success: true,
          requestId,
          ...result,
        }),
        { requestId }
      )
    }

    if (isAdminByokRequest(request.method, url.pathname)) {
      const auth = authenticateServiceRequest(request, 'admin', env, requestId)
      if (!auth.ok) return auth.response

      const parsedQuery = adminByokQuerySchema.safeParse(
        Object.fromEntries(url.searchParams.entries())
      )
      if (!parsedQuery.success) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid BYOK admin query',
            code: 'invalid_request',
          },
          { status: 400, requestId }
        )
      }

      if (request.method === adminByokGetContract.method) {
        if (!parsedQuery.data.workspaceId) {
          return invalidAdminByokRequestResponse(requestId)
        }

        const providers = await listMothershipByokProviders({
          workspaceId: parsedQuery.data.workspaceId,
        })
        return jsonResponse(
          adminByokGetContract.response.schema.parse({
            workspaceId: parsedQuery.data.workspaceId,
            providers,
            keys: providers,
          }),
          { requestId }
        )
      }

      if (request.method === adminByokPostContract.method) {
        const body = await readJsonBody(request, requestId)
        if (!body.ok) return body.response

        const parsedBody = adminByokBodySchema.safeParse(body.data)
        if (!parsedBody.success) {
          return jsonResponse(
            {
              success: false,
              error: 'Invalid BYOK admin request',
              code: 'invalid_request',
            },
            { status: 400, requestId }
          )
        }

        if (!env.ENCRYPTION_KEY) {
          return jsonResponse(
            {
              success: false,
              error: 'Mothership encryption key is not configured',
              code: 'encryption_not_configured',
            },
            { status: 503, requestId }
          )
        }

        const result = await upsertMothershipByokProviderKey({
          workspaceId: parsedBody.data.workspaceId,
          provider: parsedBody.data.provider,
          apiKey: parsedBody.data.apiKey,
          encryptionKey: env.ENCRYPTION_KEY,
          createdBy: parsedBody.data.createdBy,
        })

        requestLogger.info('Stored Mothership BYOK admin key', {
          workspaceId: result.workspaceId,
          provider: result.provider,
          authFamily: auth.context.family,
          authFingerprint: auth.context.fingerprint,
          sourceEnv: auth.context.sourceEnv,
        })

        return jsonResponse(
          adminByokPostContract.response.schema.parse({
            success: true,
            workspaceId: result.workspaceId,
            provider: result.provider,
          }),
          { requestId }
        )
      }

      if (!parsedQuery.data.workspaceId) {
        return invalidAdminByokRequestResponse(requestId)
      }

      if (!parsedQuery.data.provider) {
        return invalidAdminByokRequestResponse(requestId)
      }

      const result = await deleteMothershipByokProviderKeys({
        workspaceId: parsedQuery.data.workspaceId,
        provider: parsedQuery.data.provider,
      })

      requestLogger.info('Deleted Mothership BYOK admin keys', {
        workspaceId: result.workspaceId,
        provider: result.provider,
        authFamily: auth.context.family,
        authFingerprint: auth.context.fingerprint,
        sourceEnv: auth.context.sourceEnv,
      })

      return jsonResponse(
        adminByokDeleteContract.response.schema.parse({
          success: true,
          workspaceId: result.workspaceId,
          provider: result.provider,
        }),
        { requestId }
      )
    }

    if (isValidateKeyRequest(request.method, url.pathname)) {
      const auth = authenticateServiceRequest(request, 'runtime', env, requestId)
      if (!auth.ok) return auth.response

      const body = await readJsonBody(request, requestId)
      if (!body.ok) return body.response

      if (
        request.method === validateKeyListContract.method &&
        url.pathname === validateKeyListContract.path
      ) {
        const parsed = validateKeyListBodySchema.safeParse(body.data)
        if (!parsed.success) {
          return jsonResponse(
            {
              success: false,
              error: 'Invalid API key list request',
              code: 'invalid_request',
            },
            { status: 400, requestId }
          )
        }

        const keys = await listMothershipApiKeys({
          userId: parsed.data.userId,
          apiEncryptionKey: env.API_ENCRYPTION_KEY,
        })

        return jsonResponse(validateKeyListContract.response.schema.parse(keys), { requestId })
      }

      if (
        request.method === validateKeyGenerateContract.method &&
        url.pathname === validateKeyGenerateContract.path
      ) {
        const parsed = validateKeyGenerateBodySchema.safeParse(body.data)
        if (!parsed.success) {
          return jsonResponse(
            {
              success: false,
              error: 'Invalid API key generation request',
              code: 'invalid_request',
            },
            { status: 400, requestId }
          )
        }

        if (!env.API_ENCRYPTION_KEY) {
          return jsonResponse(
            {
              success: false,
              error: 'Mothership API key encryption is not configured',
              code: 'api_encryption_not_configured',
            },
            { status: 503, requestId }
          )
        }

        const result = await generateMothershipApiKey({
          userId: parsed.data.userId,
          name: parsed.data.name,
          apiEncryptionKey: env.API_ENCRYPTION_KEY,
        })

        requestLogger.info('Generated Mothership API key', {
          userId: parsed.data.userId,
          apiKeyId: result.id,
          authFamily: auth.context.family,
          authFingerprint: auth.context.fingerprint,
          sourceEnv: auth.context.sourceEnv,
        })

        return jsonResponse(validateKeyGenerateContract.response.schema.parse(result), {
          requestId,
        })
      }

      const parsed = validateKeyDeleteBodySchema.safeParse(body.data)
      if (!parsed.success) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid API key delete request',
            code: 'invalid_request',
          },
          { status: 400, requestId }
        )
      }

      const result = await deleteMothershipApiKey({
        userId: parsed.data.userId,
        apiKeyId: parsed.data.apiKeyId,
      })

      if (!result.deleted) {
        return jsonResponse(
          {
            success: false,
            error: 'API key not found',
            code: 'api_key_not_found',
          },
          { status: 404, requestId }
        )
      }

      requestLogger.info('Deleted Mothership API key', {
        userId: parsed.data.userId,
        apiKeyId: parsed.data.apiKeyId,
        authFamily: auth.context.family,
        authFingerprint: auth.context.fingerprint,
        sourceEnv: auth.context.sourceEnv,
      })

      return jsonResponse(validateKeyDeleteContract.response.schema.parse({ success: true }), {
        requestId,
      })
    }

    if (
      request.method === getAvailableModelsContract.method &&
      url.pathname === getAvailableModelsContract.path
    ) {
      const auth = authenticateServiceRequest(request, 'runtime', env, requestId)
      if (!auth.ok) return auth.response

      if (!configuredModels) {
        return jsonResponse(availableModelsUnavailableResponse(), { status: 503, requestId })
      }

      return jsonResponse(availableModelsResponse(configuredModels), { requestId })
    }

    if (
      request.method === generateChatTitleContract.method &&
      url.pathname === generateChatTitleContract.path
    ) {
      const auth = authenticateServiceRequest(request, 'runtime', env, requestId)
      if (!auth.ok) return auth.response

      const body = await readJsonBody(request, requestId)
      if (!body.ok) return body.response

      const parsed = generateChatTitleBodySchema.safeParse(body.data)
      if (!parsed.success) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid title generation request',
            code: 'invalid_request',
          },
          { status: 400, requestId }
        )
      }

      const result = await generateOwnedChatTitle(parsed.data, env, request.signal)
      if (result.status === 'ok') {
        return jsonResponse(
          generateChatTitleContract.response.schema.parse({ title: result.title }),
          { requestId }
        )
      }

      if (result.status === 'missing_credentials') {
        const providerLabel = result.provider === 'cliproxyapi' ? 'CliProxyAPI' : 'Anthropic'
        return jsonResponse(
          {
            success: false,
            error: `Mothership ${providerLabel} credentials are not configured`,
            code: 'owned_provider_credentials_missing',
          },
          { status: 503, requestId }
        )
      }

      if (result.status === 'unsupported_provider') {
        return jsonResponse(
          {
            success: false,
            error: 'Owned Mothership title generation is not implemented for this provider',
            code: 'owned_title_generation_not_implemented',
            model: result.model,
          },
          { status: 501, requestId }
        )
      }

      return jsonResponse(
        {
          success: false,
          error: result.message,
          code: 'owned_title_generation_error',
          model: result.model,
        },
        { status: 502, requestId }
      )
    }

    if (request.method === forkChatContract.method && url.pathname === forkChatContract.path) {
      const auth = authenticateServiceRequest(request, 'runtime', env, requestId)
      if (!auth.ok) return auth.response

      const body = await readJsonBody(request, requestId)
      if (!body.ok) return body.response

      const parsed = forkChatBodySchema.safeParse(body.data)
      if (!parsed.success) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid chat fork request',
            code: 'invalid_request',
          },
          { status: 400, requestId }
        )
      }

      const fork = await acknowledgeMothershipChatFork({
        sourceChatId: parsed.data.sourceChatId,
        newChatId: parsed.data.newChatId,
        userId: parsed.data.userId,
      })

      if (fork.status !== 'ready') {
        return jsonResponse(
          {
            success: false,
            error:
              fork.status === 'source_missing' ? 'Source chat not found' : 'New chat not found',
            code: fork.status === 'source_missing' ? 'source_chat_not_found' : 'new_chat_not_found',
          },
          { status: 404, requestId }
        )
      }

      requestLogger.info('Acknowledged Mothership chat fork', {
        sourceChatId: parsed.data.sourceChatId,
        newChatId: parsed.data.newChatId,
        copied: fork.copied,
        authFamily: auth.context.family,
        authFingerprint: auth.context.fingerprint,
      })

      return jsonResponse(
        forkChatContract.response.schema.parse({
          success: true,
          copied: fork.copied,
          sourceChatId: parsed.data.sourceChatId,
          newChatId: parsed.data.newChatId,
        }),
        { requestId }
      )
    }

    if (
      request.method === streamReplayContract.method &&
      url.pathname === streamReplayContract.path
    ) {
      const auth = authenticateServiceRequest(request, 'runtime', env, requestId)
      if (!auth.ok) return auth.response

      const parsed = streamReplayQuerySchema.safeParse(
        Object.fromEntries(url.searchParams.entries())
      )
      if (!parsed.success) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid stream replay request',
            code: 'invalid_request',
          },
          { status: 400, requestId }
        )
      }

      const afterSeq = parseReplayCursor(parsed.data.after)
      if (afterSeq === null) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid stream replay cursor',
            code: 'invalid_cursor',
          },
          { status: 400, requestId }
        )
      }

      const run = await getMothershipRunByStream({
        streamId: parsed.data.streamId,
        userId: parsed.data.userId,
      })
      if (!run) {
        return jsonResponse(
          {
            success: false,
            error: 'Stream not found',
            code: 'stream_not_found',
          },
          { status: 404, requestId }
        )
      }

      const records = await readMothershipRunEvents({
        streamId: parsed.data.streamId,
        afterSeq,
        limit: parsed.data.limit,
      })
      const events = records.map((record) => record.envelope)

      if (parsed.data.batch) {
        return jsonResponse(
          streamReplayBatchContract.response.schema.parse({
            success: true,
            events: events.map((event) => ({
              eventId: event.seq,
              streamId: event.stream.streamId,
              event,
            })),
            status: run.status,
            chatId: run.chatId,
          }),
          { requestId }
        )
      }

      return replayStreamResponse({ events, requestId })
    }

    if (isRuntimeStreamRequest(request.method, url.pathname)) {
      const auth = authenticateServiceRequest(request, 'runtime', env, requestId)
      if (!auth.ok) return auth.response

      const body = await readJsonBody(request, requestId)
      if (!body.ok) return body.response

      const parsed = mothershipChatBodySchema.safeParse(body.data)
      if (!parsed.success) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid runtime request',
            code: 'invalid_request',
          },
          { status: 400, requestId }
        )
      }

      const { chatId, executionId, runId, workspaceId } = parsed.data
      const parentRunId = getOptionalString(parsed.data.parentRunId)
      const requestedModel = getOptionalString(parsed.data.model)
      const requestedProvider = getOptionalString(parsed.data.provider)
      const providerSelection = resolveOwnedProviderSelection({
        env,
        model: requestedModel,
        provider: requestedProvider,
      })

      const entitlement = await validateMothershipApiKeyEntitlement({
        env,
        userId: parsed.data.userId,
        workspaceId,
        signal: request.signal,
      })
      if (entitlement.status !== 'ok') {
        return apiKeyEntitlementFailureResponse(entitlement, requestId)
      }

      const claim = await claimMothershipRuntimeRun({
        runId,
        executionId,
        ...(parentRunId ? { parentRunId } : {}),
        chatId,
        userId: parsed.data.userId,
        workflowId: getOptionalString(parsed.data.workflowId) ?? null,
        workspaceId,
        streamId: parsed.data.messageId,
        model: providerSelection.model,
        provider: providerSelection.provider ?? null,
        requestContext: {
          requestId,
          route: url.pathname,
          authFamily: auth.context.family,
          authFingerprint: auth.context.fingerprint,
          ...(auth.context.sourceEnv ? { sourceEnv: auth.context.sourceEnv } : {}),
        },
      })

      if (claim.status === 'stream_conflict') {
        return jsonResponse(
          {
            success: false,
            error: 'Stream belongs to a different user',
            code: 'stream_conflict',
          },
          { status: 409, requestId }
        )
      }

      if (claim.status === 'run_identity_conflict') {
        return jsonResponse(
          {
            success: false,
            error: 'Stream run identity conflicts with durable state',
            code: 'run_identity_conflict',
          },
          { status: 409, requestId }
        )
      }

      if (claim.status === 'run_terminal') {
        return jsonResponse(
          {
            success: false,
            error: 'Stream is already terminal',
            code: 'stream_not_resumable',
            status: claim.run.status,
          },
          { status: 409, requestId }
        )
      }

      return mothershipStreamResponse(
        {
          runId: claim.run.id,
          streamId: parsed.data.messageId,
          requestId,
          startSeq: 0,
        },
        async (writer) => {
          const providerResult = await runOwnedProviderContinuation({
            body: parsed.data,
            env,
            model: providerSelection.model,
            provider: providerSelection.provider,
            route: url.pathname,
            runId: claim.run.id,
            signal: request.signal,
            writer,
          })

          if (providerResult === 'handled') return

          await writer.publish({
            type: 'error',
            payload: {
              code: 'owned_provider_continuation_not_implemented',
              message: 'Owned Mothership provider continuation is not implemented yet.',
              displayMessage: 'Owned Mothership provider continuation is not implemented yet.',
              ...(providerSelection.provider ? { provider: providerSelection.provider } : {}),
              data: {
                route: url.pathname,
                model: providerSelection.model,
              },
            },
            afterPersist: async () => {
              const failedRun = await markMothershipRunFailed({
                runId: claim.run.id,
                error: 'owned_provider_continuation_not_implemented',
              })
              if (!failedRun) {
                throw new Error(`Mothership run ${claim.run.id} is not fail-able`)
              }
            },
          })
        }
      )
    }

    if (
      request.method === explicitAbortContract.method &&
      url.pathname === explicitAbortContract.path
    ) {
      const auth = authenticateServiceRequest(request, 'runtime', env, requestId)
      if (!auth.ok) return auth.response

      const body = await readJsonBody(request, requestId)
      if (!body.ok) return body.response

      const parsed = explicitAbortBodySchema.safeParse(body.data)
      if (!parsed.success) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid explicit abort request',
            code: 'invalid_request',
          },
          { status: 400, requestId }
        )
      }

      const { messageId, userId } = parsed.data
      const cancelledRun = await markMothershipRunCancelled({
        streamId: messageId,
        userId,
        reason: 'explicit_abort',
      })

      if (cancelledRun) {
        requestLogger.info('Marked Mothership run cancelled', {
          streamId: messageId,
          runId: cancelledRun.id,
          authFamily: auth.context.family,
          authFingerprint: auth.context.fingerprint,
        })

        return jsonResponse(explicitAbortContract.response.schema.parse({ success: true }), {
          requestId,
        })
      }

      const existingRun = await getMothershipRunByStream({ streamId: messageId, userId })
      if (!existingRun) {
        return jsonResponse(
          {
            success: false,
            error: 'Stream not found',
            code: 'stream_not_found',
          },
          { status: 404, requestId }
        )
      }

      return jsonResponse(
        {
          success: false,
          error: 'Stream is not abortable',
          code: 'stream_not_abortable',
          status: existingRun.status,
        },
        { status: 409, requestId }
      )
    }

    if (
      request.method === resumeToolsContract.method &&
      url.pathname === resumeToolsContract.path
    ) {
      const auth = authenticateServiceRequest(request, 'runtime', env, requestId)
      if (!auth.ok) return auth.response

      const body = await readJsonBody(request, requestId)
      if (!body.ok) return body.response

      const parsed = resumeToolsBodySchema.safeParse(body.data)
      if (!parsed.success) {
        return jsonResponse(
          {
            success: false,
            error: 'Invalid resume request',
            code: 'invalid_request',
          },
          { status: 400, requestId }
        )
      }

      const { streamId, checkpointId, userId, results } = parsed.data
      const checkpoint = await getMothershipResumeCheckpoint({
        streamId,
        checkpointId,
        userId,
      })
      if (!checkpoint) {
        return resumeFailureResponse({ status: 'missing_checkpoint' }, requestId)
      }

      if (checkpoint.runStatus !== 'paused_waiting_for_tool') {
        return resumeFailureResponse(
          {
            status: 'run_not_resumable',
            checkpoint,
            runStatus: checkpoint.runStatus,
          },
          requestId
        )
      }

      const workspaceId = getResumeEntitlementWorkspaceId(checkpoint)
      if (!workspaceId) {
        return jsonResponse(
          {
            success: false,
            error: 'Resume workspace is required',
            code: 'resume_workspace_required',
          },
          { status: 400, requestId }
        )
      }

      const requestWorkspaceId = getOptionalString(parsed.data.workspaceId)
      if (requestWorkspaceId && requestWorkspaceId !== workspaceId) {
        return jsonResponse(
          {
            success: false,
            error: 'Resume workspace conflicts with durable run state',
            code: 'resume_workspace_conflict',
          },
          { status: 409, requestId }
        )
      }

      if (!canResumeOwnedProviderRequest(checkpoint.providerRequest)) {
        return jsonResponse(
          {
            success: false,
            error: 'Resume checkpoint is missing a resumable owned provider request',
            code: 'owned_provider_resume_request_missing',
          },
          { status: 409, requestId }
        )
      }

      const entitlement = await validateMothershipApiKeyEntitlement({
        env,
        userId,
        workspaceId,
        signal: request.signal,
      })
      if (entitlement.status !== 'ok') {
        return apiKeyEntitlementFailureResponse(entitlement, requestId)
      }

      const resumeResult = await recordMothershipResumeToolResults({
        streamId,
        checkpointId,
        userId,
        workspaceId,
        results,
      })

      if (resumeResult.status !== 'ready') {
        return resumeFailureResponse(resumeResult, requestId)
      }

      requestLogger.info('Recorded Mothership resume tool results', {
        streamId,
        checkpointId,
        resultCount: resumeResult.recordedResults.length,
        authFamily: auth.context.family,
        authFingerprint: auth.context.fingerprint,
      })

      return mothershipStreamResponse(
        {
          streamId,
          requestId,
          runId: resumeResult.checkpoint.runId,
          startSeq: resumeResult.resumeEventStartSeq,
        },
        async (writer) => {
          await runOwnedProviderResume({
            body: parsed.data,
            checkpoint: resumeResult.checkpoint,
            env,
            recordedResults: resumeResult.recordedResults,
            requestResults: results,
            route: url.pathname,
            signal: request.signal,
            writer,
          })
        }
      )
    }

    return jsonResponse(
      {
        ok: false,
        error: 'Not found',
        requestId,
      },
      { status: 404, requestId }
    )
  }
}
