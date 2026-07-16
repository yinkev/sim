import { describe, expect, it } from 'vitest'
import { getIntegrationMatcher, mentionifyIntegrations } from '@/blocks/integration-matcher'

describe('integration matcher', () => {
  it('matches longest standalone names and keeps existing mentions idempotent', () => {
    expect(mentionifyIntegrations('Use Google Sheets, Slackbot, Slack, and @Slack.')).toBe(
      'Use @Google Sheets, Slackbot, @Slack, and @Slack.'
    )
  })

  it('retains canonical block types in the lookup', () => {
    const { byName } = getIntegrationMatcher()

    expect(byName.get('slack')).toMatchObject({ blockType: 'slack', name: 'Slack' })
    expect(byName.get('google sheets')).toMatchObject({
      blockType: 'google_sheets_v2',
      name: 'Google Sheets',
    })
  })
})
