'use client'

import { useParams } from 'next/navigation'
import { IntegrationDetailLoading } from '@/app/workspace/[workspaceId]/integrations/[block]/integration-detail-loading'

export default function IntegrationDetailRouteLoading() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  return <IntegrationDetailLoading workspaceId={workspaceId} />
}
