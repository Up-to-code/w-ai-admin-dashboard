"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useQuery } from "convex/react"
import { api } from "@/mock/convex-api"

export function WorkspaceSwitcher() {
  const { numbers, activePhoneNumberId, setActivePhoneNumberId, isLoading } = useWorkspace()
  const chats = useQuery(api.chat.listChats, {})
  const agents = useQuery(api.agents.list)
  const activeByNumber = React.useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const cfg of agents ?? []) {
      if (cfg.phoneNumberId) map[cfg.phoneNumberId] = Boolean(cfg.isActive)
    }
    return map
  }, [agents])
  const unreadByNumber = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const chat of chats ?? []) {
      const key = chat.phoneNumberId ?? "unassigned"
      map[key] = (map[key] ?? 0) + (chat.unreadCount ?? 0)
    }
    return map
  }, [chats])
  const totalUnread = React.useMemo(
    () => Object.values(unreadByNumber).reduce((sum, value) => sum + value, 0),
    [unreadByNumber]
  )

  if (isLoading || numbers.length === 0) {
    return (
      <div className="p-1">
        <div className="h-12 bg-muted/20 animate-pulse rounded-xl border border-border/10" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
        الرقم النشط
      </p>
      <div className="flex overflow-x-auto overflow-y-hidden gap-2 p-1.5 bg-muted/30 rounded-xl border border-border/10 min-h-[76px] [scrollbar-width:thin]">
        {numbers.length > 1 && (
          <button
            onClick={() => setActivePhoneNumberId(null)}
            className={cn(
              "flex flex-col items-center justify-center py-2.5 px-4 rounded-lg transition-all duration-300 relative overflow-hidden group min-w-[100px] sm:min-w-0 sm:flex-1 shrink-0 touch-manipulation",
              activePhoneNumberId == null
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <span className="text-[12px] font-bold truncate w-full text-center mb-0.5">الكل</span>
            <span className={cn(
              "text-[10px] truncate w-full text-center font-medium",
              activePhoneNumberId == null ? "text-primary-foreground/90" : "text-muted-foreground/60"
            )}>
              جميع الأرقام
            </span>
            {totalUnread > 0 && (
              <span className={cn(
                "absolute -top-1 -start-1 h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
                activePhoneNumberId == null ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
              )}>
                {totalUnread}
              </span>
            )}
          </button>
        )}
        {numbers.map((ws) => {
          const isActive = activePhoneNumberId === ws.businessNumberId
          return (
            <button
              key={ws._id}
              onClick={() => setActivePhoneNumberId(ws.businessNumberId)}
              className={cn(
                "flex flex-col items-center justify-center py-2.5 px-4 rounded-lg transition-all duration-300 relative overflow-hidden group min-w-[100px] sm:min-w-0 sm:flex-1 shrink-0 touch-manipulation",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              )}
              <span className="text-[12px] font-bold truncate w-full text-center mb-0.5">
                {ws.name}
              </span>
              <span className={cn(
                "text-[10px] font-semibold mb-0.5",
                activeByNumber[ws.businessNumberId] ? "text-emerald-500" : "text-amber-500"
              )}>
                {activeByNumber[ws.businessNumberId] ? "AI ON" : "AI OFF"}
              </span>
              <span className={cn(
                "text-[10px] truncate w-full text-center font-medium",
                isActive ? "text-primary-foreground/90" : "text-muted-foreground/60"
              )} dir="ltr">
                {ws.phone}
              </span>
              {(unreadByNumber[ws.businessNumberId] ?? 0) > 0 && (
                <span className={cn(
                  "absolute -top-1 -start-1 h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
                  isActive ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                )}>
                  {unreadByNumber[ws.businessNumberId]}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
