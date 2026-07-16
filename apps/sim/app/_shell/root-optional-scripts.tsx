import Script from 'next/script'

const GTM_ID = 'GTM-T7PHSRX5' as const
const GA_ID = 'G-DR7YBE70VS' as const

interface RootOptionalScriptsProps {
  isReactGrabEnabled: boolean
  isReactScanEnabled: boolean
}

interface RootHostedScriptsProps {
  isHosted: boolean
}

/** Development-only root scripts. */
export function RootOptionalScripts({
  isReactGrabEnabled,
  isReactScanEnabled,
}: RootOptionalScriptsProps) {
  return (
    <>
      {isReactScanEnabled && (
        <Script
          src='https://unpkg.com/react-scan/dist/auto.global.js'
          crossOrigin='anonymous'
          strategy='beforeInteractive'
        />
      )}
      {isReactGrabEnabled && (
        <Script
          src='https://unpkg.com/react-grab/dist/index.global.js'
          crossOrigin='anonymous'
          strategy='beforeInteractive'
        />
      )}
      {isReactGrabEnabled && (
        <Script
          src='https://unpkg.com/@react-grab/cursor/dist/client.global.js'
          strategy='lazyOnload'
        />
      )}
    </>
  )
}

/** Hosted-only analytics scripts. */
export function RootOptionalAnalyticsScripts({ isHosted }: RootHostedScriptsProps) {
  if (!isHosted) return null

  return (
    <>
      <Script
        id='gtm'
        strategy='afterInteractive'
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
        }}
      />
      <Script
        id='gtag-src'
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy='afterInteractive'
      />
      <Script
        id='gtag-init'
        strategy='afterInteractive'
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
        }}
      />
    </>
  )
}

/** Hosted-only analytics fallback. */
export function RootOptionalBody({ isHosted }: RootHostedScriptsProps) {
  if (!isHosted) return null

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        title='Google Tag Manager'
        height='0'
        width='0'
        className='invisible hidden'
      />
    </noscript>
  )
}
