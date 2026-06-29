import { CenterSurface } from '@/app/center/[workspaceId]/center-surface'

export default async function CenterPage() {
  return (
    <div className='flex h-screen w-full flex-col overflow-hidden bg-[var(--surface-1)]'>
      <div className='flex min-h-0 flex-1'>
        <div className='flex min-w-0 flex-1 flex-col p-[8px]'>
          <div className='flex-1 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg)]'>
            <CenterSurface />
          </div>
        </div>
      </div>
    </div>
  )
}
