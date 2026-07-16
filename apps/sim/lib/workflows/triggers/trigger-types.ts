/** Stable workflow trigger identifiers without registry dependencies. */
export const TRIGGER_TYPES = {
  INPUT: 'input_trigger',
  MANUAL: 'manual_trigger',
  CHAT: 'chat_trigger',
  API: 'api_trigger',
  WEBHOOK: 'webhook',
  GENERIC_WEBHOOK: 'generic_webhook',
  SCHEDULE: 'schedule',
  SIM: 'sim_workspace_event',
  START: 'start_trigger',
  STARTER: 'starter',
} as const

export type TriggerType = (typeof TRIGGER_TYPES)[keyof typeof TRIGGER_TYPES]
