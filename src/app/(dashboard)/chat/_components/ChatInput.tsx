"use client"

import { cn } from "@/lib/utils"
import { useState, useRef, useEffect, useCallback } from "react"
import { ProductPicker } from "./ProductPicker"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/mock/convex-api"
import { markScopedTemplatesSynced, shouldSyncScopedTemplates } from "@/lib/templateSyncCache"
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery"
import { runConvexActionSafe } from "@/lib/convexActionSafe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Paperclip, Mic, Image as ImageIcon, FileText, Smile, Search } from "lucide-react"
import { MediaLibraryModal } from "@/components/MediaLibraryModal"
import { AudioRecorder } from "@/components/AudioRecorder"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ChatInputProps {
  chatId: string
}

export function ChatInput({ chatId }: ChatInputProps) {
  const enableExtendedCampaignApis = process.env.NEXT_PUBLIC_EXTENDED_CAMPAIGN_APIS === "1"
  const isRealChatId = chatId && chatId !== "new"
  const chat = useQuery(api.chat.getChat, isRealChatId ? { chatId: chatId as any } : "skip") as any
  const legacyTemplates = useQuery(
    api.templates.list,
    chat?.phoneNumberId ? { phoneNumberId: chat.phoneNumberId } : "skip"
  ) as any[] | undefined
  const scopedTemplatesQuery = useOptionalConvexQuery<any[]>(
    (api as any).templates.listScopedApproved,
    enableExtendedCampaignApis && chat?.phoneNumberId ? { phoneNumberId: chat.phoneNumberId } : "skip",
    enableExtendedCampaignApis
  )
  const templatesSource = (enableExtendedCampaignApis && scopedTemplatesQuery.data
    ? scopedTemplatesQuery.data
    : legacyTemplates) as any[] | undefined
  const templates = (templatesSource || []).filter((template: any) => template.status === "APPROVED")
  const templateHealthQuery = useOptionalConvexQuery<any>(
    (api as any).templates.getScopedTemplateHealth,
    enableExtendedCampaignApis && chat?.phoneNumberId ? { phoneNumberId: chat.phoneNumberId } : "skip",
    enableExtendedCampaignApis
  )
  const templateHealth = templateHealthQuery.data
  const sendReadinessQuery = useOptionalConvexQuery<any>(
    (api as any).campaigns.getSendReadiness,
    enableExtendedCampaignApis && chat?.phoneNumberId ? { phoneNumberId: chat.phoneNumberId } : "skip",
    enableExtendedCampaignApis
  )
  const sendReadiness = sendReadinessQuery.data
  const sendMessage = useMutation(api.chat.sendMessage)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const saveFile = useMutation(api.files.saveFile)
  const uploadMediaToMeta = useAction(api.whatsapp.uploadMedia)
  const saveExternalImage = useAction(api.files.saveExternalImage)
  const syncTemplatesForNumber = useAction(api.templates.syncFromMeta)

  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [templateSearch, setTemplateSearch] = useState("")
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false)
  const [templateSyncError, setTemplateSyncError] = useState<string | null>(null)
  const [templateSyncWarning, setTemplateSyncWarning] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const isTemplateAuthFailed = templateHealth?.tokenStatus === "auth_failed"
  const templateAuthFailedMessage = templateHealth?.lastAuthErrorMessage as string | undefined
  const readinessBlockingReason = sendReadiness?.blockingReason as string | null | undefined
  const isTemplateReadinessHardBlocked =
    readinessBlockingReason === "AUTH_FAILED" ||
    readinessBlockingReason === "TOKEN_MISSING" ||
    readinessBlockingReason === "NUMBER_NOT_FOUND"
  const readinessBlockingMessage =
    isTemplateReadinessHardBlocked
      ? (sendReadiness?.recommendedAction as string | undefined) ||
        "Cannot sync/send templates for this number until sending readiness issues are resolved."
      : null
  const optionalExtendedApisUnavailable =
    scopedTemplatesQuery.unavailable ||
    templateHealthQuery.unavailable ||
    sendReadinessQuery.unavailable

  const isAiActive = chat?.aiMode

  const handleSendText = async () => {
    if (!inputValue.trim()) return
    if (isSending) return
    setIsSending(true)
    try {
      await sendMessage({ chatId: chatId as any, content: inputValue, type: "text" })
      setInputValue("")
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInputValue((prev) => prev + emojiData.emoji)
  }

  const handleSendFile = async (fileDoc: any) => {
    setIsSending(true)
    try {
      const mediaId = await uploadMediaToMeta({
        storageId: fileDoc.storageId,
        type: fileDoc.mimeType,
        phoneNumberId: chat?.phoneNumberId ?? undefined,
      })

      let type = "document";
      if (fileDoc.mimeType.startsWith("image")) type = "image";
      else if (fileDoc.mimeType.startsWith("video")) type = "video";
      else if (fileDoc.mimeType.startsWith("audio")) type = "audio";

      await sendMessage({
        chatId: chatId as any,
        type: type as any,
        content: "",
        mediaId: mediaId,
        storageId: fileDoc.storageId
      })
    } catch (error) {
      console.error("Failed to send file", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleQuickImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsSending(true)
    try {
      const postUrl = await generateUploadUrl()
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      const { storageId } = await result.json()

      await saveFile({
        storageId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        category: "image",
      })

      const mediaId = await uploadMediaToMeta({
        storageId: storageId,
        type: file.type,
        phoneNumberId: chat?.phoneNumberId ?? undefined,
      })

      await sendMessage({
        chatId: chatId as any,
        type: "image",
        content: "",
        mediaId,
        storageId,
      })

      if (imageInputRef.current) imageInputRef.current.value = ""
    } catch (error) {
      console.error("Failed to send image", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleVoiceNote = async (file: File) => {
    setIsSending(true)
    try {
      const postUrl = await generateUploadUrl()
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      const { storageId } = await result.json()

      await saveFile({
        storageId,
        name: "voice_note.webm",
        mimeType: "audio/webm",
        size: file.size,
        category: "audio"
      })

      const mediaId = await uploadMediaToMeta({
        storageId: storageId,
        type: "audio/webm",
        phoneNumberId: chat?.phoneNumberId ?? undefined,
      })

      await sendMessage({
        chatId: chatId as any,
        type: "audio",
        content: "",
        mediaId: mediaId,
        storageId: storageId
      })

      setIsRecording(false)

    } catch (error) {
      console.error("Failed to send voice note", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleSendProduct = async (product: any) => {
    setIsSending(true)
    try {
      // 1. Prepare Content
      const textCaption = `*${product.name}*\n${product.price} ${product.currency}\n\n${product.description ? product.description.substring(0, 100) + (product.description.length > 100 ? "..." : "") : ""}`

      // 2. If no image, send as text
      if (!product.image) {
        await sendMessage({ chatId: chatId as any, content: textCaption + `\n${product.url || ""}`, type: "text" })
        return
      }

      // 3. Process Image (Server-Side to avoid CORS)
      const fileName = `${product.name.replace(/\s+/g, '_')}.jpg`
      const { storageId, mimeType } = await saveExternalImage({
        url: product.image,
        name: fileName,
      })

      // Upload to Meta
      const mediaId = await uploadMediaToMeta({
        storageId: storageId,
        type: mimeType,
        phoneNumberId: chat?.phoneNumberId ?? undefined,
      })

      // 4. Send as Image with Formatted Caption
      const formattedCaption = `*${product.name}*\n\n${product.description ? product.description.substring(0, 150) + (product.description.length > 150 ? "..." : "") : ""}\n\n${product.url || ""}`

      await sendMessage({
        chatId: chatId as any,
        type: "image",
        content: formattedCaption,
        mediaId: mediaId,
        storageId: storageId,
      })

    } catch (error) {
      console.error("Failed to send product", error)
    } finally {
      setIsSending(false)
    }
  }

  const filterTemplates = (list: any[]) => {
    if (!templateSearch) return list
    return list.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
  }

  const triggerScopedTemplateSync = useCallback(async (force: boolean = false) => {
    if (!chat?.phoneNumberId) return
    if (isTemplateReadinessHardBlocked) {
      setTemplateSyncError(readinessBlockingMessage || "Cannot sync templates for this number until number auth/token setup is fixed.")
      return
    }
    if (isTemplateAuthFailed) {
      setTemplateSyncError("لا يمكن مزامنة القوالب لهذا الرقم حتى إعادة ربط Access Token من صفحة الإعدادات والربط.")
      return
    }
    if (!force && !shouldSyncScopedTemplates(chat.phoneNumberId)) return
    setIsSyncingTemplates(true)
    setTemplateSyncError(null)
    setTemplateSyncWarning(null)
    try {
      const fallbackResult = await runConvexActionSafe(syncTemplatesForNumber as any, {
        phoneNumberId: chat.phoneNumberId,
      }, { actionName: "templates:syncFromMeta" })
      if (!fallbackResult.ok) {
        setTemplateSyncError(
          fallbackResult.unavailable
            ? "دالة مزامنة القوالب غير متاحة على نسخة Convex الحالية. قم بنشر backend ثم أعد المحاولة."
            : (fallbackResult.message || "تعذر مزامنة القوالب.")
        )
        return
      }
      if (enableExtendedCampaignApis) {
        setTemplateSyncWarning("تمت مزامنة القوالب عبر المسار المتوافق مع هذه النسخة.")
      }
      markScopedTemplatesSynced(chat.phoneNumberId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setTemplateSyncError(message || "تعذر مزامنة القوالب.")
    } finally {
      setIsSyncingTemplates(false)
    }
  }, [
    chat?.phoneNumberId,
    enableExtendedCampaignApis,
    isTemplateAuthFailed,
    isTemplateReadinessHardBlocked,
    readinessBlockingMessage,
    syncTemplatesForNumber,
  ])

  useEffect(() => {
    if (!isTemplateOpen || !chat?.phoneNumberId) return
    void triggerScopedTemplateSync(false)
  }, [chat?.phoneNumberId, isTemplateOpen, triggerScopedTemplateSync])

  const approvedTemplates = filterTemplates(templates || [])
  const allTemplates = approvedTemplates

  return (
    <div className="flex flex-col">
        {isAiActive && (
            <div className="bg-primary/10 text-primary text-xs px-4 py-1 text-center font-medium border-t border-primary/20">
                الذكاء الاصطناعي نشط في هذه المحادثة
            </div>
        )}
    <div className="min-h-[62px] bg-[#f0f2f5] dark:bg-[#202c33] border-t border-border/10 flex items-center gap-2 px-4 py-2 z-10 shrink-0">

      {isRecording ? (
        <AudioRecorder onRecordingComplete={handleVoiceNote} onCancel={() => setIsRecording(false)} />
      ) : (
        <>
          {/* Apps / Attachments */}
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0">
                  <Smile className="h-6 w-6" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-full p-0 border-none shadow-none bg-transparent">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.AUTO}
                  lazyLoadEmojis={true}
                />
              </PopoverContent>
            </Popover>

            <MediaLibraryModal onSelect={handleSendFile}>
              <Button variant="ghost" size="icon" aria-label="إرسال ملف" className="text-muted-foreground hover:text-foreground shrink-0">
                <Paperclip className="h-5 w-5 rotate-45" />
              </Button>
            </MediaLibraryModal>

            <ProductPicker onSelect={handleSendProduct} />
          </div>

          <div className="relative">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQuickImageUpload}
              disabled={isSending}
            />
          </div>

          <Input
            placeholder="اكتب رسالة..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="اكتب رسالة"
            disabled={isSending}
            className="flex-1 bg-white dark:bg-secondary border-none focus-visible:ring-0 rounded-xl h-10 px-4 mx-2 text-[15px] placeholder:text-muted-foreground/70"
          />

          {/* Template Dialog */}
          <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="القوالب" className="text-muted-foreground hover:text-foreground shrink-0">
                <FileText className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>قوالب الرسائل</DialogTitle>
                <DialogDescription>اختر قالباً معتمداً لإرساله من الرقم المرتبط بهذه المحادثة.</DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {chat?.phoneNumberId ? "القوالب المرتبطة بالرقم الحالي فقط" : "اختر محادثة برقم إرسال لعرض القوالب"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!chat?.phoneNumberId || isSyncingTemplates || isTemplateAuthFailed || isTemplateReadinessHardBlocked || optionalExtendedApisUnavailable}
                  onClick={() => void triggerScopedTemplateSync(true)}
                >
                  {isSyncingTemplates ? "جارٍ المزامنة..." : "مزامنة"}
                </Button>
              </div>
              {isTemplateReadinessHardBlocked ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {readinessBlockingMessage}
                </div>
              ) : null}
              {isTemplateAuthFailed ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  لا يمكن مزامنة أو إرسال القوالب لهذا الرقم حتى إعادة ربط Access Token.
                  {templateAuthFailedMessage ? ` (${templateAuthFailedMessage})` : ""}
                </div>
              ) : null}
              {templateSyncError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  تعذر مزامنة القوالب: {templateSyncError}
                </div>
              ) : null}
              {templateSyncWarning ? (
                <div className="rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                  {templateSyncWarning}
                </div>
              ) : null}
              {optionalExtendedApisUnavailable ? (
                <div className="rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                  بعض واجهات القوالب غير متاحة في نسخة Convex الحالية. سيتم عرض القوالب المتاحة فقط.
                </div>
              ) : null}

              <div className="relative mb-4">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="بحث في القوالب..."
                  className="pr-9"
                />
              </div>

              <Tabs defaultValue="approved" className="flex-1 flex flex-col min-h-0">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="approved">معتمدة ({approvedTemplates.length})</TabsTrigger>
                  <TabsTrigger value="all">الكل ({allTemplates.length})</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto mt-4 pr-1">
                  <TabsContent value="approved" className="mt-0 h-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                      {approvedTemplates.map((t: any) => (
                        <Card key={t._id} className="cursor-pointer hover:border-primary transition-all" onClick={async () => {
                          if (isTemplateAuthFailed || isTemplateReadinessHardBlocked || optionalExtendedApisUnavailable || !!templateSyncError) return
                          setIsSending(true)
                          setIsTemplateOpen(false)
                          try {
                            await sendMessage({
                              chatId: chatId as any,
                              type: "template",
                              content: t.name,
                              template: { name: t.name, language: t.language, components: [] },
                            })
                          } finally {
                            setIsSending(false)
                          }
                        }}>
                          <CardContent className="p-4">
                            <div className="font-semibold text-foreground text-sm">{t.name}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                              <span>{t.category}</span>
                              <div className="flex items-center gap-1">
                                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded text-[10px]">{t.language}</span>
                                <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px]">
                                  {t.phoneNumberId ? "Scoped" : "Global"}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {approvedTemplates.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          لا توجد قوالب معتمدة لهذا الرقم. قم بالمزامنة أو افتح صفحة القوالب.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="all" className="mt-0 h-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                      {(allTemplates).map((t: any) => (
                        <Card key={t._id} className="cursor-pointer hover:border-primary transition-all" onClick={async () => {
                          if (isTemplateAuthFailed || isTemplateReadinessHardBlocked || optionalExtendedApisUnavailable || !!templateSyncError) return
                          if (t.status !== 'APPROVED') return
                          setIsSending(true)
                          setIsTemplateOpen(false)
                          try {
                            await sendMessage({
                              chatId: chatId as any,
                              type: "template",
                              content: t.name,
                              template: { name: t.name, language: t.language, components: [] },
                            })
                          } finally {
                            setIsSending(false)
                          }
                        }}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="font-semibold text-foreground text-sm">{t.name}</div>
                              <div className={cn("text-[10px] px-1.5 py-0.5 rounded",
                                t.status === 'APPROVED' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                              )}>
                                {t.status}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {t.category} · {t.language} · {t.phoneNumberId ? "Scoped" : "Global"}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </DialogContent>
          </Dialog>

          {/* Send Button */}
          <Button
            onClick={handleSendText}
            disabled={(!inputValue.trim() && !isRecording) || isSending}
            size="icon"
            className={cn(
              "shrink-0 transition-all duration-200",
              inputValue.trim() || isRecording ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-transparent"
            )}
          >
            {inputValue.trim() ? (
              <Send className="h-5 w-5 text-white" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>
        </>
      )}
    </div>
    </div>
  )
}
