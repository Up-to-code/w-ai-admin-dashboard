"use client"

import { MessageSquare } from "lucide-react"

export default function ChatIndexPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] dark:bg-[#202c33] border-b-[6px] border-[#25d366]/40 h-full">
      {/* WhatsApp Web-style placeholder */}
      <div className="text-center max-w-md px-6">
        <div className="mb-8">
          <MessageSquare className="h-24 w-24 text-[#e9edef] dark:text-[#384147] mx-auto" />
        </div>
        <h3 className="text-3xl font-light text-[#41525d] dark:text-[#d1d7db] mb-4">ChatCB Web</h3>
        <p className="text-[#667781] dark:text-[#8696a0] text-sm leading-6">
          أرسل واستقبل الرسائل دون الحاجة لإبقاء هاتفك متصلاً. استخدم ChatCB على ما يصل إلى 4 أجهزة وحاتف واحد في نفس الوقت.
        </p>
      </div>
    </div>
  )
}
