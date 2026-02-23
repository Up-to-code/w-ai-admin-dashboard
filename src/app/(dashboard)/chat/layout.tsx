import { ChatSidebar } from "./_components/ChatSidebar"

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-4rem)] font-sans bg-background overflow-hidden">
      <ChatSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}
