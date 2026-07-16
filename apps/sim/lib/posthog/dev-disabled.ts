const noop = () => undefined

const disabledPostHog = {
  __loaded: false,
  capture: noop,
  group: noop,
  identify: noop,
  init: noop,
  reset: noop,
  sessionRecordingStarted: () => false,
  startSessionRecording: noop,
}

export default disabledPostHog
