import type { Metadata } from 'next'
import { getPageSession } from '@/lib/auth/page-session'
import { Home } from './home'

export const metadata: Metadata = {
  title: 'New chat',
}

interface HomePageProps {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ resource?: string }>
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const [session, { workspaceId }, { resource }] = await Promise.all([
    getPageSession(),
    params,
    searchParams,
  ])

  if (resource) {
    const { redirect } = await import('next/navigation')
    redirect(`/workspace/${workspaceId}/chat/new?resource=${encodeURIComponent(resource)}`)
  }

  return <Home userName={session?.user?.name} />
}
