import type { Metadata } from 'next'
import { getServerSession } from '@/lib/auth/server-session'
import { HomeRuntime } from '@/app/workspace/[workspaceId]/home/home-runtime'

export const metadata: Metadata = {
  title: 'Chat',
}

interface ChatPageProps {
  params: Promise<{
    workspaceId: string
    chatId: string
  }>
  searchParams: Promise<{ resource?: string }>
}

export default async function ChatPage({ params, searchParams }: ChatPageProps) {
  const [{ chatId }, { resource }, session] = await Promise.all([
    params,
    searchParams,
    getServerSession(),
  ])
  return (
    <HomeRuntime
      key={chatId}
      chatId={chatId}
      userName={session?.user?.name}
      userId={session?.user?.id}
      initialResourceId={resource ?? null}
    />
  )
}
