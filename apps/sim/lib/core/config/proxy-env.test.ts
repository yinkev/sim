import { describe, expect, it } from 'vitest'
import { isHostedAppUrl, isProxyAuthDisabled, isTruthy } from './proxy-env'

describe('proxy env', () => {
  it('matches application truthy coercion', () => {
    expect(isTruthy('true')).toBe(true)
    expect(isTruthy('TRUE')).toBe(true)
    expect(isTruthy('1')).toBe(true)
    expect(isTruthy(true)).toBe(true)
    expect(isTruthy(1)).toBe(true)
    expect(isTruthy('false')).toBe(false)
    expect(isTruthy('0')).toBe(false)
    expect(isTruthy('yes')).toBe(false)
    expect(isTruthy(undefined)).toBe(false)
  })

  it('recognizes only sim.ai and its subdomains as hosted', () => {
    expect(isHostedAppUrl('https://sim.ai')).toBe(true)
    expect(isHostedAppUrl('https://staging.sim.ai/path')).toBe(true)
    expect(isHostedAppUrl('https://example.com')).toBe(false)
    expect(isHostedAppUrl('https://sim.ai.example.com')).toBe(false)
    expect(isHostedAppUrl('invalid-url')).toBe(false)
    expect(isHostedAppUrl(undefined)).toBe(false)
  })

  it('disables auth only for truthy self-hosted deployments', () => {
    expect(isProxyAuthDisabled('true', 'https://self-hosted.example')).toBe(true)
    expect(isProxyAuthDisabled('1', undefined)).toBe(true)
    expect(isProxyAuthDisabled('false', 'https://self-hosted.example')).toBe(false)
    expect(isProxyAuthDisabled('true', 'https://sim.ai')).toBe(false)
    expect(isProxyAuthDisabled('true', 'https://dev.sim.ai')).toBe(false)
  })
})
