"use client"

import { useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquare, Bell } from "lucide-react"
import { useWorkspace } from "@/contexts/WorkspaceContext"

const SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3"

export function GlobalNotification() {
    const latestMessage = useQuery(api.chat.getLatestGlobalMessage)
    const notifications = useQuery(api.notifications.list, { limit: 5 })
    const markAsRead = useMutation(api.notifications.markAsRead)
    const { setActivePhoneNumberId, numbers } = useWorkspace()

    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const lastMessageIdRef = useRef<string | null>(null)
    const lastNotificationIdRef = useRef<string | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const isFirstRun = useRef(true)

    // Initialize Audio
    useEffect(() => {
        audioRef.current = new Audio(SOUND_URL)
        audioRef.current.volume = 0.6
    }, [])

    // --- System Notifications Logic ---
    useEffect(() => {
        if (!notifications || notifications.length === 0) return

        // Skip initial load
        if (isFirstRun.current && !lastNotificationIdRef.current) {
            // Set the ref to the latest one so we don't alert on existing ones
            if (notifications.length > 0) {
                lastNotificationIdRef.current = notifications[0]._id
            }
            // We don't return here because we might want to handle chat messages below
            // But we should flag that we processed notifications
        }

        // Find the latest unread notification that is NEW (different ID from last seen)
        // We assume the list is ordered by desc createdAt
        const latest = notifications[0]

        if (latest && !latest.read && latest._id !== lastNotificationIdRef.current) {
            // It's a new notification!
            if (!isFirstRun.current) { // Only play if not first run (double check)
                audioRef.current?.play().catch(() => { })

                toast.custom((t) => (
                    <div
                        className="w-[360px] cursor-pointer"
                        onClick={() => {
                            toast.dismiss(t)
                            markAsRead({ id: latest._id })
                            if (latest.link) router.push(latest.link)
                        }}
                    >
                        <div className="relative overflow-hidden rounded-[22px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 p-4 shadow-2xl transition-all hover:scale-[1.02]">
                            <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${latest.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                        latest.type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                                            latest.type === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                                'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm text-foreground">{latest.title}</h4>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{latest.message}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-2">الآن</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 6000, position: "top-right" })
            }
            lastNotificationIdRef.current = latest._id
        }
    }, [notifications, markAsRead, router])

    useEffect(() => {
        if (!latestMessage) return

        // 1. Initial Load Handling
        if (isFirstRun.current) {
            lastMessageIdRef.current = latestMessage.messageId
            isFirstRun.current = false
            return
        }

        // 2. Check for NEW messages only
        if (lastMessageIdRef.current === latestMessage.messageId) return

        // Update Ref (It is new)
        lastMessageIdRef.current = latestMessage.messageId

        // 3. Suppression Logic (Active Chat)
        // "If I am in the same chat window, don't make the sound"
        const activeChatId = pathname?.startsWith("/chat/") ? pathname.split("/").pop() : null
        const isChatOpen = pathname?.startsWith("/chat/") && activeChatId === latestMessage.chatId

        if (isChatOpen) return

        // 4. Play Sound & Show Notification
        audioRef.current?.play().catch(e => console.error("Audio play failed", e))

        const workspaceNumber = latestMessage.phoneNumberId
            ? numbers.find((n) => n.businessNumberId === latestMessage.phoneNumberId)
            : null
        const recipientContext =
            latestMessage.businessName ||
            workspaceNumber?.name ||
            latestMessage.businessPhone ||
            workspaceNumber?.phone ||
            latestMessage.phoneNumberId ||
            "default number"

        toast.custom((t) => (
            <div
                className="w-[360px] cursor-pointer"
                onClick={() => {
                    toast.dismiss(t)
                    if (latestMessage.phoneNumberId) setActivePhoneNumberId(latestMessage.phoneNumberId)
                    router.push(`/chat/${latestMessage.chatId}`)
                }}
            >
                <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-white/60 to-white/40 dark:from-[#1C1C1E]/70 dark:to-[#2C2C2E]/50 backdrop-blur-[80px] border border-white/30 dark:border-white/10 p-[14px] transition-all hover:brightness-105 active:scale-[0.98] group">

                    {/* Header: Icon + App Name + Time */}
                    <div className="flex items-center justify-between mb-2.5 pl-0.5">
                        <div className="flex items-center gap-2">
                            {/* iOS Green Message Icon */}
                            <div className="w-[18px] h-[18px] rounded-[4px] bg-[#4ADE80] flex items-center justify-center">
                                <MessageSquare className="w-2.5 h-2.5 text-white fill-current" />
                            </div>
                            <span className="text-[11px] font-semibold tracking-wide text-black/60 dark:text-white/60 uppercase">
                                MESSAGES • TO {recipientContext}
                            </span>
                        </div>
                        <span className="text-[11px] font-normal text-black/40 dark:text-white/40">
                            now
                        </span>
                    </div>

                    {/* Content */}
                    <div className="flex items-start gap-3.5">
                        <Avatar className="h-[42px] w-[42px] rounded-full shrink-0 border border-black/5 dark:border-white/10">
                            <AvatarImage src="" />
                            <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-200 text-sm font-semibold">
                                {latestMessage.contactName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 flex flex-col justify-center h-[42px]">
                            <h4 className="text-[15px] font-semibold text-black dark:text-white leading-tight mb-0.5 truncate pr-2">
                                {latestMessage.contactName}
                            </h4>
                            <p className="text-[15px] text-black/90 dark:text-white/90 leading-snug line-clamp-2">
                                {latestMessage.type === "image" ? "Sent an image" :
                                    latestMessage.type === "audio" ? "Sent a voice message" :
                                        latestMessage.content}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        ), {
            duration: 5000,
            position: "top-right",
            className: "p-0 bg-transparent border-0 shadow-none !bg-transparent !p-0 !m-0",
        })

    }, [latestMessage, pathname, searchParams, numbers, router, setActivePhoneNumberId])

    return null
}
