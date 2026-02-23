"use client"

import { useEffect } from "react"
import { useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { MessageList } from "./MessageList"
import { ConversationHeader } from "./ConversationHeader"
import { ChatInput } from "./ChatInput"
import { useAuth } from "@/contexts/AuthContext"

interface ChatWindowProps {
  chatId: string
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  const markAsRead = useMutation(api.chat.markAsRead)
  const setActiveChat = useMutation(api.chat.setActiveChat)
  const clearActiveChat = useMutation(api.chat.clearActiveChat)
  const { userId } = useAuth()

  const isRealChatId = chatId && chatId !== "new"

  // Instant Read Effect (only for real chat IDs; "new" is the new-chat route)
  useEffect(() => {
    if (isRealChatId) {
      markAsRead({ chatId: chatId as any }).catch(console.error)
    }
  }, [chatId, isRealChatId, markAsRead])

  useEffect(() => {
    if (!isRealChatId || !userId) return

    const heartbeat = () =>
      setActiveChat({
        chatId: chatId as any,
        userId: userId as any,
      }).catch(console.error)

    heartbeat()
    const intervalId = setInterval(heartbeat, 20_000)

    return () => {
      clearInterval(intervalId)
      clearActiveChat({ userId: userId as any }).catch(console.error)
    }
  }, [chatId, isRealChatId, userId, setActiveChat, clearActiveChat])

  return (
    <div className="flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] relative">
      {/* Header */}
      <ConversationHeader chatId={chatId} />

      {/* Messages */}
      <MessageList chatId={chatId} />

      {/* Input Area */}
      <ChatInput chatId={chatId} />
    </div>
  )
}
