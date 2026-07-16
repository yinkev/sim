/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequestJson } = vi.hoisted(() => ({
  mockRequestJson: vi.fn(),
}))

vi.mock('@/lib/api/client/request', () => ({
  requestJson: mockRequestJson,
}))

import { getVoiceSettingsContract } from '@/lib/api/contracts/common'
import { useSpeechToText } from '@/hooks/use-speech-to-text'

type SpeechHook = ReturnType<typeof useSpeechToText>

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('useSpeechToText availability', () => {
  let container: HTMLDivElement
  let root: Root
  let hook: SpeechHook

  function Harness() {
    hook = useSpeechToText({ onTranscript: vi.fn() })
    return null
  }

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('AudioContext', class AudioContextMock {})
    vi.stubGlobal('WebSocket', class WebSocketMock {})
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
    })
    mockRequestJson.mockReset().mockResolvedValue({ sttAvailable: false })

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(<Harness />)
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
  })

  it('shows browser-capable voice input without requesting settings on mount', () => {
    expect(hook.isSupported).toBe(true)
    expect(mockRequestJson).not.toHaveBeenCalled()
  })

  it('checks settings once on first intent and hides unavailable voice input', async () => {
    mockRequestJson.mockResolvedValue({ sttAvailable: false })

    await act(async () => {
      hook.toggleListening()
    })

    expect(mockRequestJson).toHaveBeenCalledTimes(1)
    expect(mockRequestJson).toHaveBeenCalledWith(getVoiceSettingsContract, {})
    expect(hook.isSupported).toBe(false)
    expect(hook.isListening).toBe(false)
  })

  it('deduplicates repeated intent while the settings check is pending', async () => {
    const settings = createDeferred<{ sttAvailable: boolean }>()
    mockRequestJson.mockReturnValue(settings.promise)

    act(() => {
      hook.toggleListening()
      hook.toggleListening()
    })

    expect(mockRequestJson).toHaveBeenCalledTimes(1)
    expect(mockRequestJson).toHaveBeenCalledWith(getVoiceSettingsContract, {})

    await act(async () => {
      settings.resolve({ sttAvailable: false })
      await settings.promise
    })

    expect(hook.isListening).toBe(false)
  })

  it('does not request settings in an unsupported browser', async () => {
    await act(async () => {
      root.unmount()
    })
    vi.stubGlobal('AudioContext', undefined)

    root = createRoot(container)
    await act(async () => {
      root.render(<Harness />)
    })

    expect(hook.isSupported).toBe(false)
    act(() => hook.toggleListening())
    expect(mockRequestJson).not.toHaveBeenCalled()
  })

  it('does not continue startup when unmounted during the settings check', async () => {
    const settings = createDeferred<{ sttAvailable: boolean }>()
    mockRequestJson.mockReturnValue(settings.promise)

    act(() => hook.toggleListening())
    expect(mockRequestJson).toHaveBeenCalledTimes(1)

    await act(async () => {
      root.unmount()
      settings.resolve({ sttAvailable: true })
      await settings.promise
    })

    expect(mockRequestJson).toHaveBeenCalledTimes(1)
  })
})
