"use client"

import { useQuery } from "convex/react"
import { api } from "@/mock/convex-api"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { avatarColorFromString, cn, initialsFromName } from "@/lib/utils"
import { Search, MessageSquarePlus, CircleDashed } from "lucide-react"
import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useWorkspace } from "@/contexts/WorkspaceContext"

export function ChatSidebar() {
  const params = useParams()
  const selectedChatId = params?.chatId as string | undefined
  const { activePhoneNumberId } = useWorkspace()

  // "__all__" or null = show all. Convex expects undefined, not null.
  const effectivePhoneNumberId =
    !activePhoneNumberId || activePhoneNumberId === "__all__" ? undefined : activePhoneNumberId

  const chats = useQuery(api.chat.listChats, effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : {})
  const [searchQuery, setSearchQuery] = useState("")
  const totalUnread = useMemo(
    () => (chats ?? []).reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0),
    [chats]
  )

  const filteredChats = useMemo(() => {
    if (!chats) return []
    if (!searchQuery.trim()) return chats
    return chats.filter(chat =>
      chat.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.contactPhone.includes(searchQuery)
    )
  }, [chats, searchQuery])

  if (!chats) {
    return (
      <div className="w-[400px] border-l border-border bg-background flex flex-col h-full items-center justify-center">
        <div className="animate-spin text-muted-foreground">
          <CircleDashed className="h-8 w-8" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-[400px] bg-background flex flex-col h-full border-l border-border/10">
      {/* Header - Simplified */}
      <div className="h-[60px] px-5 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between shrink-0 border-b border-border/10">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-transparent text-muted-foreground">
            <MessageSquarePlus className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        <div className="text-xs font-medium text-muted-foreground">
          غير المقروء: <span className="text-foreground">{totalUnread}</span>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border/40 bg-background">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث أو بدء محادثة جديدة"
            className="pr-10 bg-muted/50 border-none h-10 text-sm rounded-xl focus-visible:ring-0 focus-visible:bg-background transition-all"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            لا توجد محادثات مطابقة
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredChats.map((chat) => {
              const isSelected = selectedChatId === chat._id
              const avatarSeed = `${chat.contactId}:${chat.contactName}:${chat.contactPhone}`

              return (
                <Link
                  key={chat._id}
                  href={`/chat/${chat._id}`}
                  className={cn(
                    "group w-full flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-200 relative rounded-xl",
                    isSelected ? "bg-primary/10 ring-1 ring-primary/10" : "hover:bg-muted/50"
                  )}
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarFallback
                      className="text-white text-sm font-semibold"
                      style={{ backgroundColor: avatarColorFromString(avatarSeed) }}
                    >
                      {initialsFromName(chat.contactName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-foreground font-medium text-[16px] truncate">
                        {chat.contactName}
                      </span>
                      <span className={cn(
                        "text-[11px] font-medium min-w-fit",
                        chat.unreadCount > 0 ? "text-primary" : "text-muted-foreground"
                      )}>
                        {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground truncate max-w-[85%] leading-5">
                        {chat.status === 'expired' ? "انتهت الجلسة" : "اضغط لعرض الرسائل"}
                      </p>
                      {chat.unreadCount > 0 && (
                        <div className="bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center">
                          {chat.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
