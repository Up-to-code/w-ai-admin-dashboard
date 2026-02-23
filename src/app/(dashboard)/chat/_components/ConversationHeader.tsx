"use client"

import { useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { avatarColorFromString, initialsFromName } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Bot } from "lucide-react"
import { Label } from "@/components/ui/label"

export function ConversationHeader({ chatId }: { chatId?: string }) {
  const isRealChatId = chatId && chatId !== "new"
  const chat = useQuery(api.chat.getChat, isRealChatId ? { chatId: chatId as any } : "skip")
  const toggleAi = useMutation(api.chat.toggleAiMode)

  const content = useMemo(() => {
    if (!chatId || !chat) {
      return <div className="h-full" />
    }

    const avatarSeed = `${chat.contactId}:${chat.contactName}:${chat.contactPhone}`
    const avatarBg = avatarColorFromString(avatarSeed)

    return (
      <div className="flex items-center justify-between w-full h-full px-4 py-2 bg-card dark:bg-secondary border-b border-border/10 z-20">
        <div className="flex items-center gap-3 cursor-pointer">
          <Avatar className="h-10 w-10 shrink-0 border border-black/5">
            <AvatarFallback className="text-white text-sm font-semibold" style={{ backgroundColor: avatarBg }}>
              {initialsFromName(chat.contactName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col justify-center">
            <div className="font-semibold text-foreground text-[15px] leading-5">{chat.contactName}</div>
            <div className="text-[12px] text-muted-foreground leading-4 mt-0.5">
              {chat.contactPhone}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-lg border border-black/5">
                <Bot className={`h-4 w-4 ${chat.aiMode ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                <Label htmlFor="ai-mode" className="text-xs cursor-pointer font-medium">AI Agent</Label>
                <Switch 
                    id="ai-mode"
                    checked={chat.aiMode || false}
                    onCheckedChange={(checked) => toggleAi({ chatId: chat._id, enabled: checked })}
                    className="scale-75 data-[state=checked]:bg-primary"
                />
            </div>
        </div>
      </div>
    )
  }, [chat, chatId, toggleAi])

  if (!chatId) return null

  return <div className="w-full h-[60px] relative z-20 shrink-0 bg-[#f0f2f5] dark:bg-[#202c33]">{content}</div>
}
