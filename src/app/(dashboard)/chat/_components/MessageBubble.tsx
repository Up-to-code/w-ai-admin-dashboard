"use client"

import { cn } from "@/lib/utils"
import { Check, CheckCheck } from "lucide-react"
import { AudioPlayer } from "@/components/AudioPlayer"

interface MessageBubbleProps {
  message: {
    _id: string
    direction: "inbound" | "outbound"
    type: "text" | "image" | "video" | "audio" | "document" | "template"
    content?: string
    mediaUrl?: string
    timestamp: number
    status?: "sent" | "delivered" | "read" | "failed"
    mediaId?: string
    mediaHydrationStatus?: "pending" | "success" | "failed"
    mediaHydrationError?: string
  }
}

function renderTextWithLinks(text: string) {
  const regex = /((?:https?:\/\/[^\s]+|www\.[^\s]+))|(\*[^*]+\*)/g
  const parts: Array<{ type: "text" | "link" | "bold"; value: string }> = []
  let lastIndex = 0

  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) })
    }

    const fullMatch = match[0]
    if (match[1]) {
      parts.push({ type: "link", value: fullMatch })
    } else if (match[2]) {
      parts.push({ type: "bold", value: fullMatch.slice(1, -1) })
    }

    lastIndex = index + fullMatch.length
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) })
  }

  return parts.map((p, idx) => {
    if (p.type === "link") {
      const href = p.value.startsWith("http") ? p.value : `https://${p.value}`
      return (
        <a
          key={idx}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-[#027eb5] dark:text-[#53bdeb] underline break-all hover:opacity-80"
        >
          {p.value}
        </a>
      )
    }
    if (p.type === "bold") {
      return <strong key={idx} className="font-semibold">{p.value}</strong>
    }
    return <span key={idx}>{p.value}</span>
  })
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === "outbound"
  const caption =
    message.type === "text"
      ? message.content || ""
      : message.content && message.content.trim() && message.content !== message.mediaId
        ? message.content
        : ""

  return (
    <div className="flex w-full mb-0.5 px-2">
      <div
        className={cn(
          "relative max-w-[75%] rounded-[8px]",
          isOutbound
            ? "me-auto bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef]"
            : "ms-auto bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef]"
        )}
      >
        {/* WhatsApp-style bubble tail - RTL-aware (start/end) */}
        <div
          className={cn(
            "absolute top-0 w-3 h-3 overflow-hidden",
            isOutbound ? "-start-2" : "-end-2"
          )}
        >
          <div
            className={cn(
              "absolute w-3 h-3 rotate-45 transform",
              isOutbound
                ? "bg-[#d9fdd3] dark:bg-[#005c4b] -end-1.5 top-0"
                : "bg-white dark:bg-[#202c33] -start-1.5 top-0"
            )}
          />
        </div>

        {/* Content wrapper with padding */}
        <div className="p-1.5 pb-0">
          {/* Media Rendering */}
          {message.type === "image" && message.mediaUrl && (
            <div className="mb-1 rounded-md overflow-hidden bg-black/5 min-h-[100px] min-w-[200px]">
              <img
                src={message.mediaUrl}
                alt="صورة"
                className="w-full h-auto object-cover max-h-[350px] cursor-pointer hover:opacity-95 transition-opacity"
                loading="lazy"
              />
            </div>
          )}
          {message.type === "image" && !message.mediaUrl && message.mediaHydrationStatus === "failed" && (
            <div className="mb-1 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300 min-w-[200px]">
              تعذر تحميل الصورة من WhatsApp. حاول إعادة الإرسال.
              {message.mediaHydrationError && (
                <div className="mt-1 opacity-80 break-words">{message.mediaHydrationError}</div>
              )}
            </div>
          )}
          {message.type === "image" && !message.mediaUrl && message.mediaHydrationStatus === "pending" && (
            <div className="mb-1 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground min-w-[200px]">
              جاري تحميل الصورة...
            </div>
          )}

          {message.type === "video" && message.mediaUrl && (
            <div className="mb-1 rounded-md overflow-hidden min-w-[250px] bg-black">
              <video controls className="w-full rounded-md">
                <source src={message.mediaUrl} />
              </video>
            </div>
          )}

          {message.type === "audio" && message.mediaUrl && (
            <div className="min-w-[280px] py-1">
              <AudioPlayer src={message.mediaUrl} isOutbound={isOutbound} />
            </div>
          )}

          {message.type === "template" && (
            <div className="text-xs font-medium opacity-70 px-1 pb-1 italic">
              📋 قالب: {message.content || "Template"}
            </div>
          )}

          {message.type === "document" && (
            <div className="px-1 pb-1">
              {message.mediaUrl ? (
                <a
                  href={message.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[#027eb5] dark:text-[#53bdeb] underline break-all hover:opacity-80 flex items-center gap-1"
                >
                  📄 فتح المستند
                </a>
              ) : (
                <span className="text-sm opacity-60">📄 مستند</span>
              )}
            </div>
          )}

          {caption && (
            <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[20px] px-1.5 py-1 text-start">
              {renderTextWithLinks(caption)}
            </p>
          )}
        </div>

        {/* Timestamp & Status - WhatsApp style */}
        <div className="flex items-center justify-end gap-1 text-[11px] px-2 pb-1.5 -mt-1">
          <span className={cn(
            isOutbound
              ? "text-[#667781] dark:text-[#8696a0]"
              : "text-[#667781] dark:text-[#8696a0]"
          )}>
            {new Date(message.timestamp).toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
            })}
          </span>
          {isOutbound && (
            <span className={cn(
              message.status === "read" ? "text-[#53bdeb]" : "text-[#8696a0]"
            )}>
              {message.status === "read" || message.status === "delivered" ? (
                <CheckCheck className="h-[18px] w-[18px]" />
              ) : (
                <Check className="h-[16px] w-[16px]" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
