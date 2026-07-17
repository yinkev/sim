import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { INTEGRATIONS } from '@/lib/integrations/catalog'
import { getIntegrationDetails } from '@/lib/integrations/integration-details'
import { IntegrationBlockDetail } from '@/app/workspace/[workspaceId]/integrations/[block]/integration-block-detail'
import { IntegrationDetailLoading } from '@/app/workspace/[workspaceId]/integrations/[block]/integration-detail-loading'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ block: string }>
}): Promise<Metadata> {
  const { block } = await params
  const integration = INTEGRATIONS.find((i) => i.slug === block)
  return {
    title: integration ? `${integration.name} Integration` : 'Integration',
  }
}

export default async function IntegrationBlockPage({
  params,
}: {
  params: Promise<{ workspaceId: string; block: string }>
}) {
  const { workspaceId, block } = await params
  const integration = INTEGRATIONS.find((i) => i.slug === block)
  if (!integration) notFound()
  const details = getIntegrationDetails(integration.type)

  return (
    <Suspense fallback={<IntegrationDetailLoading workspaceId={workspaceId} />}>
      <IntegrationBlockDetail
        integration={integration}
        workspaceId={workspaceId}
        templates={details.templates}
        suggestedSkills={details.skills}
      />
    </Suspense>
  )
}
