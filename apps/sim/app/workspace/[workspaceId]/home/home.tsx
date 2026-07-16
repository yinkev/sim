'use client'

import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LandingPromptStorage, LandingWorkflowSeedStorage } from '@/lib/core/utils/browser-storage'
import { readOAuthReturnContext } from '@/lib/credentials/client-state'
import {
  MOTHERSHIP_SEND_MESSAGE_EVENT,
  type MothershipSendMessageDetail,
} from '@/lib/mothership/events'

interface HomeProps {
  userName?: string
}

export function Home({ userName }: HomeProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const router = useRouter()
  const firstName = userName?.split(' ')[0] ?? ''
  const initializedRef = useRef(false)
  const navigationPendingRef = useRef(false)
  const [prompt, setPrompt] = useState('')

  const runtimeHref = useCallback(
    (autoSubmit: boolean) => `/workspace/${workspaceId}/chat/new${autoSubmit ? '?submit=1' : ''}`,
    [workspaceId]
  )

  const openRuntime = useCallback(
    (text: string, autoSubmit: boolean) => {
      const trimmed = text.trim()
      if (trimmed) {
        LandingPromptStorage.store(trimmed)
      } else {
        LandingPromptStorage.clear()
      }

      const href = runtimeHref(autoSubmit)
      if (navigationPendingRef.current) {
        if (autoSubmit) router.replace(href)
        return
      }

      navigationPendingRef.current = true
      router.push(href)
    },
    [router, runtimeHref]
  )

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    if (LandingWorkflowSeedStorage.hasSeed()) {
      navigationPendingRef.current = true
      router.replace(`/workspace/${workspaceId}/chat/new/template`)
      return
    }

    const storedPrompt = LandingPromptStorage.consume()
    if (readOAuthReturnContext()) {
      if (storedPrompt) LandingPromptStorage.store(storedPrompt)
      navigationPendingRef.current = true
      router.replace(runtimeHref(false))
      return
    }

    if (storedPrompt) setPrompt(storedPrompt)
  }, [router, runtimeHref, workspaceId])

  const startTask = useCallback(
    (text: string) => {
      if (!text.trim()) return
      openRuntime(text, true)
    },
    [openRuntime]
  )

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      startTask(prompt)
    },
    [prompt, startTask]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
      event.preventDefault()
      startTask(prompt)
    },
    [prompt, startTask]
  )

  const handlePromptChange = useCallback((value: string) => {
    setPrompt(value)
    if (!navigationPendingRef.current) return
    if (value.trim()) {
      LandingPromptStorage.store(value)
    } else {
      LandingPromptStorage.clear()
    }
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const message = (event as CustomEvent<MothershipSendMessageDetail>).detail?.message
      if (message) startTask(message)
    }
    window.addEventListener(MOTHERSHIP_SEND_MESSAGE_EVENT, handler)
    return () => window.removeEventListener(MOTHERSHIP_SEND_MESSAGE_EVENT, handler)
  }, [startTask])

  return (
    <div className='relative h-full overflow-y-auto bg-[var(--bg)] [scrollbar-gutter:stable_both-edges]'>
      <div className='flex min-h-full flex-col items-center justify-center px-6 pt-[2vh] pb-[22vh]'>
        <h1 className='mb-7 max-w-[48rem] text-balance font-season text-[30px] text-[var(--text-primary)]'>
          What should we get done{firstName ? `, ${firstName}` : ''}?
        </h1>
        <form
          className='w-full max-w-[48rem] rounded-[16px] border border-[var(--border-1)] bg-[var(--surface-1)] p-3 shadow-xs focus-within:border-[var(--border-2)]'
          onSubmit={handleSubmit}
        >
          <textarea
            data-testid='home-landing-input'
            aria-label='Describe what Sim should do'
            placeholder='Ask Sim to build, research, analyze, or automate…'
            rows={3}
            value={prompt}
            onFocus={() => openRuntime(prompt, false)}
            onChange={(event) => handlePromptChange(event.target.value)}
            onKeyDown={handleKeyDown}
            className='block min-h-[76px] w-full resize-none bg-transparent px-1 py-1 text-[15px] text-[var(--text-primary)] leading-6 outline-none placeholder:text-[var(--text-tertiary)]'
          />
          <div className='mt-2 flex items-center justify-between'>
            <span className='px-1 text-[11px] text-[var(--text-tertiary)]'>
              Shift+Enter for a new line
            </span>
            <button
              type='submit'
              aria-label='Start task'
              disabled={!prompt.trim()}
              className='flex size-8 items-center justify-center rounded-[10px] bg-[var(--text-primary)] text-[var(--bg)] transition-opacity disabled:cursor-not-allowed disabled:opacity-30'
            >
              <svg
                aria-hidden='true'
                viewBox='0 0 24 24'
                className='size-4'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M12 19V5' />
                <path d='m5 12 7-7 7 7' />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
