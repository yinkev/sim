'use client'

import { FileViewer } from '@/app/workspace/[workspaceId]/files/components/file-viewer/file-viewer'
import { Files } from '@/app/workspace/[workspaceId]/files/files'

export function FileDetail() {
  return <Files FileViewerComponent={FileViewer} />
}
