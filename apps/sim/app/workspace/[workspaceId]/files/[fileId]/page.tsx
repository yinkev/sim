import { Suspense } from 'react'
import type { Metadata } from 'next'
import { FileDetail } from '@/app/workspace/[workspaceId]/files/[fileId]/file-detail'

export const metadata: Metadata = {
  title: 'Files',
  robots: { index: false },
}

export default function FilesFilePage() {
  return (
    <Suspense fallback={null}>
      <FileDetail />
    </Suspense>
  )
}
