'use client'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang='en'>
      <body className='bg-[var(--bg)] text-[var(--text-primary)]'>
        <main className='flex min-h-screen items-center justify-center px-6'>
          <div className='flex max-w-[360px] flex-col items-center gap-4 text-center'>
            <h1 className='font-season text-[28px]'>Something went wrong</h1>
            <p className='text-[14px] text-[var(--text-tertiary)]'>
              Sim could not load this page. Try again to recover the current session.
            </p>
            <button
              type='button'
              onClick={reset}
              className='rounded-[5px] bg-[var(--text-primary)] px-3 py-2 font-medium text-[13px] text-[var(--text-inverse)]'
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
