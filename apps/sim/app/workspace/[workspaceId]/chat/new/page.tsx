import type { Metadata } from 'next'
import { getServerSession } from '@/lib/auth/server-session'
import { NewChatRuntime } from '@/app/workspace/[workspaceId]/chat/new/new-chat-runtime'

export const metadata: Metadata = {
  title: 'New chat',
}

interface NewChatPageProps {
  searchParams: Promise<{ resource?: string; submit?: string }>
}

export default async function NewChatPage({ searchParams }: NewChatPageProps) {
  const [session, { resource, submit }] = await Promise.all([getServerSession(), searchParams])

  return (
    <NewChatRuntime
      userName={session?.user?.name}
      userId={session?.user?.id}
      initialResourceId={resource ?? null}
      autoSubmit={submit === '1'}
    />
  )
}
