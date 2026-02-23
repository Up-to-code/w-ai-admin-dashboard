"use client"

import { ChatWindow } from "../_components/ChatWindow"
import { useParams } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/mock/convex-api"
import { CircleDashed, MessageSquare } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { isLikelyConvexId } from "@/lib/convexId"

export default function ChatConversationPage() {
  const params = useParams()
  const rawChatId = params?.chatId
  const chatId = typeof rawChatId === "string" ? rawChatId : ""
  const hasValidChatId = chatId === "new" || isLikelyConvexId(chatId)
  const chats = useQuery(api.chat.listChats, {})

  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#efeae2] dark:bg-[#0b141a] h-full">
        <div className="text-center max-w-md px-6">
          <MessageSquare className="h-24 w-24 text-[#e9edef] dark:text-[#384147] mx-auto mb-8" />
          <h3 className="text-xl font-light text-[#41525d] dark:text-[#d1d7db] mb-2">Invalid chat link</h3>
          <p className="text-[#667781] dark:text-[#8696a0] text-sm mb-6">
            This chat link is missing an id.
          </p>
          <Button asChild variant="outline">
            <Link href="/chat">Back to chats</Link>
          </Button>
        </div>
      </div>
    )
  }
  if (!hasValidChatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#efeae2] dark:bg-[#0b141a] h-full">
        <div className="text-center max-w-md px-6">
          <MessageSquare className="h-24 w-24 text-[#e9edef] dark:text-[#384147] mx-auto mb-8" />
          <h3 className="text-xl font-light text-[#41525d] dark:text-[#d1d7db] mb-2">Invalid chat link</h3>
          <p className="text-[#667781] dark:text-[#8696a0] text-sm mb-6">
            This link is malformed. Please open the conversation from the chat list.
          </p>
          <Button asChild variant="outline">
            <Link href="/chat">Back to chats</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Never mount ChatWindow with "new" — Convex expects v.id("chats"), not the literal "new"
  if (chatId === "new") {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#efeae2] dark:bg-[#0b141a] h-full">
        <div className="text-center max-w-md px-6">
          <MessageSquare className="h-24 w-24 text-[#e9edef] dark:text-[#384147] mx-auto mb-8" />
          <h3 className="text-xl font-light text-[#41525d] dark:text-[#d1d7db] mb-2">New chat</h3>
          <p className="text-[#667781] dark:text-[#8696a0] text-sm">Select a conversation or start from the sidebar.</p>
        </div>
      </div>
    )
  }

  if (chats === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#efeae2] dark:bg-[#0b141a] h-full">
        <CircleDashed className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isKnownChat = chats.some((chat) => chat._id === chatId);
  if (!isKnownChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#efeae2] dark:bg-[#0b141a] h-full">
        <div className="text-center max-w-md px-6">
          <MessageSquare className="h-24 w-24 text-[#e9edef] dark:text-[#384147] mx-auto mb-8" />
          <h3 className="text-xl font-light text-[#41525d] dark:text-[#d1d7db] mb-2">Invalid chat link</h3>
          <p className="text-[#667781] dark:text-[#8696a0] text-sm mb-6">
            This chat does not exist or the link points to a different record type.
          </p>
          <Button asChild variant="outline">
            <Link href="/chat">Back to chats</Link>
          </Button>
        </div>
      </div>
    )
  }

  return <ChatWindow chatId={chatId} />
}
