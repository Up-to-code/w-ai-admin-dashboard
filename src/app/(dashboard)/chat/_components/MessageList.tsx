"use client"

import { usePaginatedQuery } from "convex/react"
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react"
import { api } from "@/mock/convex-api"
import { MessageBubble } from "./MessageBubble"
import { Button } from "@/components/ui/button"
import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"

interface MessageListProps {
    chatId: string
}

const SKIP = "skip" as const

export function MessageList({ chatId }: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [showScrollButton, setShowScrollButton] = useState(false)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const isRealChatId = chatId && chatId !== "new"

    const { results: messagesDesc, status, loadMore, isLoading } = usePaginatedQuery(
        api.chat.getMessagesPage,
        isRealChatId ? { chatId: chatId as any } : SKIP,
        { initialNumItems: 50 }
    )

    const messages = useMemo(() => [...messagesDesc].reverse(), [messagesDesc])

    // Scroll to bottom helper
    const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }

    // Initial scroll to bottom
    useLayoutEffect(() => {
        scrollToBottom()
    }, [chatId]) // When chat changes

    // Auto-scroll on new messages if we were at bottom
    useEffect(() => {
        if (isAtBottom) {
            scrollToBottom("smooth")
        }
    }, [messages.length, isAtBottom])

    // Preserve scroll position when loading more
    const prevScrollHeightRef = useRef(0)
    useLayoutEffect(() => {
        if (status === "LoadingMore") {
            prevScrollHeightRef.current = scrollRef.current?.scrollHeight || 0
        } else if (prevScrollHeightRef.current > 0 && scrollRef.current) {
            const newScrollHeight = scrollRef.current.scrollHeight
            const diff = newScrollHeight - prevScrollHeightRef.current
            scrollRef.current.scrollTop = diff + 50 // maintain position roughly
            prevScrollHeightRef.current = 0
        }
    }, [messages.length, status])


    // Scroll handler
    const handleScroll = () => {
        if (!scrollRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current

        // Check if at bottom (with some threshold)
        const isBottom = scrollHeight - scrollTop - clientHeight < 100
        setIsAtBottom(isBottom)
        setShowScrollButton(!isBottom)

        // Load more when near top
        if (scrollTop < 100 && status === "CanLoadMore" && !isLoading) {
            prevScrollHeightRef.current = scrollHeight
            loadMore(20)
        }
    }

    return (
        <div className="relative flex-1 h-full overflow-hidden bg-[#efeae2] dark:bg-[#0b141a]">
            {/* Background Pattern - Subtle & Clean */}
            <div className="absolute inset-0 z-0 opacity-[0.4] dark:opacity-[0.03] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] pointer-events-none" />

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="relative z-10 h-full overflow-y-auto custom-scrollbar p-4 md:px-16 lg:px-24 flex flex-col gap-2"
            >
                {status === "LoadingFirstPage" ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                        جاري تحميل الرسائل...
                    </div>
                ) : (
                    <>
                        {status === "CanLoadMore" && (
                            <div className="flex justify-center py-2">
                                {isLoading ? (
                                    <span className="text-xs text-muted-foreground">جاري التحميل...</span>
                                ) : (
                                    <Button variant="ghost" size="sm" onClick={() => loadMore(20)} className="text-xs">
                                        تحميل المزيد
                                    </Button>
                                )}
                            </div>
                        )}

                        <AnimatePresence initial={false}>
                            {messages.map((msg, index) => (
                                <motion.div
                                    key={msg._id}
                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.2 }}
                                    className="w-full flex flex-col"
                                    style={{ contentVisibility: "auto", containIntrinsicSize: "0 80px" }}
                                >
                                    <MessageBubble message={msg as any} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </>
                )}

                <div className="h-2" /> {/* Bottom spacer */}
            </div>

            {/* Scroll to bottom button */}
            {showScrollButton && (
                <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-4 right-4 z-20 rounded-full h-10 w-10 bg-background hover:bg-muted"
                    onClick={() => scrollToBottom("smooth")}
                >
                    <ArrowDown className="h-5 w-5 text-muted-foreground" />
                </Button>
            )}
        </div>
    )
}
