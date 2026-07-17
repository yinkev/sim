'use client'

import { ChipLink } from '@/components/emcn'
import { ArrowLeft } from '@/components/emcn/icons'

interface IntegrationDetailLoadingProps {
  workspaceId: string
}

/** Immediate route chrome while an integration detail segment resolves. */
export function IntegrationDetailLoading({ workspaceId }: IntegrationDetailLoadingProps) {
  return (
    <div className='flex h-full flex-col bg-[var(--bg)]'>
      <div className='flex flex-shrink-0 items-center bg-[var(--bg)] px-[16px] pt-[8.5px] pb-[8.5px]'>
        <ChipLink href={`/workspace/${workspaceId}/integrations`} leftIcon={ArrowLeft}>
          Integrations
        </ChipLink>
      </div>
      <div className='min-h-0 flex-1 overflow-hidden px-6'>
        <div className='mx-auto flex max-w-[48rem] animate-pulse flex-col gap-3 pb-3'>
          <div className='size-9 rounded-xl bg-[var(--surface-4)]' />
          <div className='h-5 w-40 rounded-md bg-[var(--surface-4)]' />
          <div className='h-4 w-80 max-w-full rounded-md bg-[var(--surface-4)]' />
        </div>
      </div>
    </div>
  )
}
