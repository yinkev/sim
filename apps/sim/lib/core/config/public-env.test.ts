/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { getEnv, isTruthy } from '@/lib/core/config/public-env'

interface RuntimeEnvWindow extends Window {
  __ENV?: Record<string, string | undefined>
}

const runtimeWindow = window as RuntimeEnvWindow

afterEach(() => {
  runtimeWindow.__ENV = undefined
  Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_TEST_VALUE')
})

describe('getEnv', () => {
  it('prefers runtime public env injected into the browser', () => {
    process.env.NEXT_PUBLIC_TEST_VALUE = 'build-value'
    runtimeWindow.__ENV = { NEXT_PUBLIC_TEST_VALUE: 'runtime-value' }

    expect(getEnv('NEXT_PUBLIC_TEST_VALUE')).toBe('runtime-value')
  })

  it('falls back to the bundled process env value in the browser', () => {
    process.env.NEXT_PUBLIC_TEST_VALUE = 'build-value'

    expect(getEnv('NEXT_PUBLIC_TEST_VALUE')).toBe('build-value')
  })
})

describe('isTruthy', () => {
  it('preserves env boolean coercion semantics', () => {
    expect(isTruthy('true')).toBe(true)
    expect(isTruthy('1')).toBe(true)
    expect(isTruthy('false')).toBe(false)
    expect(isTruthy('0')).toBe(false)
    expect(isTruthy(undefined)).toBe(false)
  })
})
