import { inter } from '@/app/_styles/fonts/inter/inter'

export default function NewChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`flex h-full flex-1 flex-col overflow-hidden ${inter.variable}`}>
      {children}
    </div>
  )
}
