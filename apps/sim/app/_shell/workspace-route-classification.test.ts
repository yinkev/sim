import { describe, expect, it } from 'vitest'
import {
  isLightweightWorkspaceHome,
  isWorkspaceRoute,
  shouldActivateWorkspaceRuntime,
} from '@/app/_shell/workspace-route-classification'

describe('workspace route classification', () => {
  it.each([
    ['/workspace/workspace-1', true],
    ['/workspace/workspace-1/home', true],
    ['/workspace/workspace-1/chat/new', true],
    ['/workspace', false],
    ['/center', false],
    [null, false],
  ])('classifies %s as workspace=%s', (pathname, expected) => {
    expect(isWorkspaceRoute(pathname)).toBe(expected)
  })

  it.each([
    ['/workspace/workspace-1/home', true],
    ['/workspace/workspace-1/home/', true],
    ['/workspace/workspace-1/chat/new', false],
    ['/workspace/workspace-1/chat/chat-1', false],
    ['/workspace/workspace-1/w', false],
    ['/workspace/workspace-1/settings', false],
    ['/workspace', false],
    [null, false],
  ])('classifies %s as lightweight Home=%s', (pathname, expected) => {
    expect(isLightweightWorkspaceHome(pathname)).toBe(expected)
  })

  it('latches runtime activation after leaving Home', () => {
    expect(shouldActivateWorkspaceRuntime(false, '/workspace/workspace-1/home')).toBe(false)
    expect(shouldActivateWorkspaceRuntime(false, '/workspace/workspace-1/chat/new')).toBe(true)
    expect(shouldActivateWorkspaceRuntime(true, '/workspace/workspace-1/home')).toBe(true)
  })
})
