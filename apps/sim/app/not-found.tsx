import type { Metadata } from 'next'
import AuthBackground from '@/app/(auth)/components/auth-background'
import { AUTH_PRIMARY_CTA_BASE } from '@/app/(auth)/components/auth-button-classes'

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <AuthBackground className='dark'>
      <main className='relative flex min-h-full items-center justify-center px-4 pb-24 text-[var(--landing-text)]'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <h1 className='text-balance font-[430] text-[40px] text-white leading-[110%] tracking-[-0.02em]'>
            Page not found
          </h1>
          <p className='font-[430] text-[color-mix(in_srgb,var(--landing-text-subtle)_60%,transparent)] text-lg leading-[125%] tracking-[0.02em]'>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <a href='/' className={`${AUTH_PRIMARY_CTA_BASE} mt-3`}>
            Return to Home
          </a>
        </div>
      </main>
    </AuthBackground>
  )
}
