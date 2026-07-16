/** Publishes current NEXT_PUBLIC_* values before client hydration. */
export function PublicEnvScript() {
  const publicEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (/^NEXT_PUBLIC_/i.test(key) && value !== undefined) {
      publicEnv[key] = value
    }
  }

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window['__ENV'] = ${JSON.stringify(publicEnv)}`,
      }}
    />
  )
}
