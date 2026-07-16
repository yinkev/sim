'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createLogger } from '@sim/logger'
import { getErrorMessage } from '@sim/utils/errors'
import { generateId } from '@sim/utils/id'
import { useParams, useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { LandingPromptStorage } from '@/lib/core/utils/browser-storage'
import {
  MOTHERSHIP_SEND_MESSAGE_EVENT,
  type MothershipSendMessageDetail,
} from '@/lib/mothership/events'
import { captureEvent } from '@/lib/posthog/client'
import { ChatSurfaceProvider } from '@/app/workspace/[workspaceId]/home/components/chat-surface-context'
import { CreditsChip } from '@/app/workspace/[workspaceId]/home/components/credits-chip'
import { SuggestedActions } from '@/app/workspace/[workspaceId]/home/components/suggested-actions'
import {
  UserInput,
  type UserInputHandle,
} from '@/app/workspace/[workspaceId]/home/components/user-input'
import type { FileAttachmentForApi } from '@/app/workspace/[workspaceId]/home/types'
import { useOAuthReturnRouter } from '@/hooks/use-oauth-return'
import { useMothershipDraftsStore } from '@/stores/mothership-drafts/store'
import type { ChatContext } from '@/stores/panel'
import { abortNewChatHandoff, startNewChatHandoff } from './new-chat-handoff'

const logger = createLogger('NewChatRuntime')

interface NewChatRuntimeProps {
  userName?: string
  userId?: string
  initialResourceId?: string | null
  autoSubmit?: boolean
}

interface NewChatHandoff {
  initialPrompt: string
}

interface ActiveHandoff {
  chatId?: string
  controller: AbortController
  requestId?: string
  traceparent?: string
  userMessageId: string
}

export function NewChatRuntime({
  userName,
  userId,
  initialResourceId = null,
  autoSubmit = false,
}: NewChatRuntimeProps) {
  useOAuthReturnRouter()
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const router = useRouter()
  const posthog = usePostHog()
  const posthogRef = useRef(posthog)
  posthogRef.current = posthog
  const initializedRef = useRef(false)
  const submittedInitialPromptRef = useRef(false)
  const activeHandoffRef = useRef<ActiveHandoff | null>(null)
  const inputRef = useRef<UserInputHandle>(null)
  const [handoff, setHandoff] = useState<NewChatHandoff | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    setHandoff({ initialPrompt: LandingPromptStorage.consume() ?? '' })
  }, [])

  const handleSubmit = useCallback(
    (text: string, fileAttachments?: FileAttachmentForApi[], contexts?: ChatContext[]) => {
      const trimmed = text.trim()
      if (!trimmed && !(fileAttachments && fileAttachments.length > 0)) return
      if (activeHandoffRef.current) return

      captureEvent(posthogRef.current, 'task_message_sent', {
        workspace_id: workspaceId,
        has_attachments: !!(fileAttachments && fileAttachments.length > 0),
        has_contexts: !!(contexts && contexts.length > 0),
        is_new_task: true,
      })

      const userMessageId = generateId()
      const controller = new AbortController()
      const activeHandoff: ActiveHandoff = { controller, userMessageId }
      activeHandoffRef.current = activeHandoff
      setSendError(null)
      setIsSending(true)

      void startNewChatHandoff({
        workspaceId,
        message: trimmed || 'Analyze the attached file(s).',
        userMessageId,
        fileAttachments,
        contexts,
        signal: controller.signal,
        onRequestStarted: ({ requestId, userMessageId }) => {
          activeHandoff.requestId = requestId
          captureEvent(posthogRef.current, 'task_request_started', {
            workspace_id: workspaceId,
            view: 'mothership',
            request_id: requestId,
            user_message_id: userMessageId,
          })
        },
      })
        .then(({ chatId, traceparent }) => {
          if (activeHandoffRef.current !== activeHandoff || controller.signal.aborted) return
          activeHandoff.chatId = chatId
          activeHandoff.traceparent = traceparent
          const resourceQuery = initialResourceId
            ? `?resource=${encodeURIComponent(initialResourceId)}`
            : ''
          router.replace(`/workspace/${workspaceId}/chat/${chatId}${resourceQuery}`)
        })
        .catch((error: unknown) => {
          if (activeHandoffRef.current !== activeHandoff) return
          activeHandoffRef.current = null
          setIsSending(false)
          if (error instanceof Error && error.name === 'AbortError') return
          setSendError(getErrorMessage(error, 'Failed to start chat'))
          logger.error('Failed to start new chat handoff', error)
        })
    },
    [initialResourceId, router, workspaceId]
  )

  useEffect(() => {
    if (!autoSubmit || !handoff?.initialPrompt || submittedInitialPromptRef.current) {
      return
    }
    submittedInitialPromptRef.current = true
    useMothershipDraftsStore.getState().clearDraft(`${workspaceId}:new`)
    handleSubmit(handoff.initialPrompt)
  }, [autoSubmit, handleSubmit, handoff, workspaceId])

  useEffect(() => {
    const handler = (event: Event) => {
      const message = (event as CustomEvent<MothershipSendMessageDetail>).detail?.message
      if (message) handleSubmit(message)
    }
    window.addEventListener(MOTHERSHIP_SEND_MESSAGE_EVENT, handler)
    return () => window.removeEventListener(MOTHERSHIP_SEND_MESSAGE_EVENT, handler)
  }, [handleSubmit])

  useEffect(() => {
    return () => {
      const activeHandoff = activeHandoffRef.current
      if (!activeHandoff || activeHandoff.chatId) return
      activeHandoffRef.current = null
      activeHandoff.controller.abort('new_chat_route_unmounted')
      void abortNewChatHandoff({
        streamId: activeHandoff.userMessageId,
        traceparent: activeHandoff.traceparent,
      }).catch((error) => logger.warn('Failed to abort abandoned new chat handoff', error))
    }
  }, [])

  const handleStopGeneration = useCallback(() => {
    const activeHandoff = activeHandoffRef.current
    if (!activeHandoff) return
    activeHandoffRef.current = null
    activeHandoff.controller.abort('user_stop:new_chat_handoff')
    setIsSending(false)
    captureEvent(posthogRef.current, 'task_generation_aborted', {
      workspace_id: workspaceId,
      view: 'mothership',
      request_id: activeHandoff.requestId,
    })
    void abortNewChatHandoff({
      streamId: activeHandoff.userMessageId,
      chatId: activeHandoff.chatId,
      traceparent: activeHandoff.traceparent,
    }).catch((error) => logger.warn('Failed to abort new chat handoff', error))
  }, [workspaceId])

  if (!handoff) {
    return (
      <div className='flex h-full items-center justify-center bg-[var(--bg)]'>
        <div
          className='size-[18px] animate-spin rounded-full border border-[var(--text-tertiary)] border-t-transparent'
          aria-label='Loading task'
        />
      </div>
    )
  }

  const firstName = userName?.split(' ')[0] ?? ''

  return (
    <div className='relative h-full overflow-y-auto bg-[var(--bg)] [scrollbar-gutter:stable_both-edges]'>
      <div className='absolute top-[8.5px] right-[16px] z-10'>
        <CreditsChip deferData />
      </div>
      <div className='flex min-h-full flex-col items-center justify-center px-6 pt-[2vh] pb-[22vh]'>
        <h1 className='mb-7 max-w-[48rem] text-balance font-season text-[30px] text-[var(--text-primary)]'>
          What should we get done{firstName ? `, ${firstName}` : ''}?
        </h1>
        <div className='relative w-full max-w-[48rem]'>
          <ChatSurfaceProvider userId={userId}>
            <UserInput
              ref={inputRef}
              defaultValue={handoff.initialPrompt}
              autoFocus={!autoSubmit}
              draftScopeKey={`${workspaceId}:new`}
              onSubmit={handleSubmit}
              isSending={isSending}
              onStopGeneration={handleStopGeneration}
            />
          </ChatSurfaceProvider>
          <div className='absolute inset-x-0 top-full'>
            <SuggestedActions
              deferSignalQueries
              onSelectPrompt={(prompt) => inputRef.current?.populatePrompt(prompt)}
            />
            {sendError && (
              <p className='mt-3 text-center text-[13px] text-[var(--text-error)]' role='alert'>
                {sendError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
