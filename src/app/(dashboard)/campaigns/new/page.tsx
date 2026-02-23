"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useConvex, useAction } from "convex/react"
import { api } from "@/mock/convex-api"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    ArrowRight,
    Users,
    MessageSquare,
    Calendar as CalendarIcon,
    CheckCircle2,
    Clock,
    Tag,
    Smartphone,
    LayoutTemplate,
    ChevronRight,
    ChevronDown,
    Play,
    Shield,
    X,
    AlertTriangle
} from "lucide-react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { CronScheduler } from "@/components/CronScheduler"
import { SchedulePicker } from "@/components/SchedulePicker"
import { TemplatePreview } from "@/components/TemplatePreview"
import { getScopedTemplateSyncTtlMs, markScopedTemplatesSynced, shouldSyncScopedTemplates } from "@/lib/templateSyncCache"
import type { Id } from "@/mock/dataModel"
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery"
import { toast } from "sonner"
import { toUserSafeConvexMessage } from "@/lib/convexErrors"
import { runConvexActionSafe } from "@/lib/convexActionSafe"

export default function NewCampaignPage() {
    const enableExtendedCampaignApis = process.env.NEXT_PUBLIC_EXTENDED_CAMPAIGN_APIS === "1"
    const router = useRouter()
    const convex = useConvex()
    const { isAdmin } = useAuth()
    const { numbers, activePhoneNumberId } = useWorkspace()
    const [currentStep, setCurrentStep] = useState(0)

    // Form Data
    const [name, setName] = useState("")
    const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string | null>(null)
    const [scheduledAt, setScheduledAt] = useState<string>("")
    const [recurrenceCronSpec, setRecurrenceCronSpec] = useState<string>("")
    const [selectedTemplate, setSelectedTemplate] = useState<{
        _id: string
        name: string
        language?: string
        phoneNumberId?: string | null
        status?: string
        components?: { type?: string; text?: string }[]
        content?: string
    } | null>(null)
    const [templateAutoClearedMessage, setTemplateAutoClearedMessage] = useState<string | null>(null)
    const previousPhoneNumberIdRef = useRef<string | null>(null)
    const [targetAudience, setTargetAudience] = useState<"all" | "tags" | "selected">("all")
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [selectedContactIds, setSelectedContactIds] = useState<Id<"contacts">[]>([])

    // Anti-spam sending config
    const [sendingConfig, setSendingConfig] = useState({
        messagesPerSecond: 10,
        delayBetweenMessages: 100,
        maxRetries: 3,
        skipRecentlyContacted: true,
        recentContactHours: 24,
    })
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
    const [isTestCampaign, setIsTestCampaign] = useState(false)
    const [testBypassRecentContact, setTestBypassRecentContact] = useState(false)
    const [testContactPhones, setTestContactPhones] = useState<string[]>([])
    const [testPhoneInput, setTestPhoneInput] = useState("")
    const testContactLimit = 5

    // Queries
    const legacyTemplates = useQuery(
        api.templates.list,
        selectedPhoneNumberId ? { phoneNumberId: selectedPhoneNumberId } : "skip"
    ) as any[] | undefined
    const scopedTemplatesQuery = useOptionalConvexQuery<any[]>(
        (api as any).templates.listScopedApproved,
        enableExtendedCampaignApis && selectedPhoneNumberId ? { phoneNumberId: selectedPhoneNumberId } : "skip",
        enableExtendedCampaignApis
    )
    const templatesSource = (enableExtendedCampaignApis && scopedTemplatesQuery.data
        ? scopedTemplatesQuery.data
        : legacyTemplates) as any[] | undefined
    const templates = templatesSource?.filter((template: any) => template.status === "APPROVED")
    const templateHealthQuery = useOptionalConvexQuery<any>(
        (api as any).templates.getScopedTemplateHealth,
        enableExtendedCampaignApis && selectedPhoneNumberId ? { phoneNumberId: selectedPhoneNumberId } : "skip",
        enableExtendedCampaignApis
    )
    const templateHealth = templateHealthQuery.data
    const sendReadinessQuery = useOptionalConvexQuery<any>(
        (api as any).campaigns.getSendReadiness,
        enableExtendedCampaignApis && selectedPhoneNumberId ? { phoneNumberId: selectedPhoneNumberId } : "skip",
        enableExtendedCampaignApis
    )
    const sendReadiness = sendReadinessQuery.data
    const [templateValidation, setTemplateValidation] = useState<any | null>(null)
    const [isTemplateValidationLoading, setIsTemplateValidationLoading] = useState(false)
    const [isSyncingTemplates, setIsSyncingTemplates] = useState(false)
    const [templateSyncError, setTemplateSyncError] = useState<string | null>(null)
    const [templateSyncWarning, setTemplateSyncWarning] = useState<string | null>(null)
    const [runtimeInfo, setRuntimeInfo] = useState<any | null>(null)
    const [runtimeInfoUnavailable, setRuntimeInfoUnavailable] = useState(false)
    const contacts = useQuery(api.contacts.list, { limit: 1000 }) as any[] | undefined

    const createCampaign = useMutation(api.campaigns.create) as any
    const syncTemplatesForNumber = useAction(api.templates.syncFromMeta)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Derived Stats
    const filteredContacts = contacts?.filter((c: any) => {
        if (targetAudience === 'all') return true
        if (targetAudience === 'selected') return selectedContactIds.includes(c._id)
        return Array.isArray(c.tags) && c.tags.some((t: string) => selectedTags.includes(t))
    }) || []

    const uniqueTags = Array.from(new Set(contacts?.flatMap((c: any) => c.tags || []) || []))
    const normalizedTestPhones = testContactPhones
        .map((phone) => phone.replace(/[^\d+]/g, ""))
        .filter((phone) => phone.length > 0)
    const testBypassValidationError =
        isTestCampaign && testBypassRecentContact && normalizedTestPhones.length === 0
            ? "أضف رقم اختبار واحد على الأقل لتفعيل التجاوز."
            : null
    const testContactOverflowWarning =
        isTestCampaign && normalizedTestPhones.length > testContactLimit
            ? `حد أرقام الاختبار هو ${testContactLimit}.`
            : null
    const testAudienceWarning =
        isTestCampaign && filteredContacts.length > testContactLimit
            ? `تحذير: جمهور حملة الاختبار أكبر من ${testContactLimit} مستلمين.`
            : null
    const syncTtlMinutes = Math.floor(getScopedTemplateSyncTtlMs() / 60000)
    const isTemplateAuthFailed = templateHealth?.tokenStatus === "auth_failed"
    const templateAuthFailedMessage = templateHealth?.lastAuthErrorMessage
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
    const templateCriticalApisUnavailable = !enableExtendedCampaignApis || optionalExtendedApisUnavailable
    const strictTemplateChecksEnabled = !templateCriticalApisUnavailable
    // Allow proceeding when Convex campaign/template APIs are not deployed (user cannot deploy)
    const apisUnavailableBypass =
        optionalExtendedApisUnavailable &&
        !!selectedTemplate &&
        !isTemplateReadinessHardBlocked &&
        !isTemplateAuthFailed &&
        !templateSyncError &&
        !isSyncingTemplates
    const contentStepCanProceed =
        apisUnavailableBypass ||
        (!templateCriticalApisUnavailable &&
            !!selectedTemplate &&
            !isTemplateValidationLoading &&
            !!templateValidation?.ok)

    const triggerScopedTemplateSync = useCallback(async (force: boolean = false) => {
        if (!selectedPhoneNumberId) return
        if (isTemplateReadinessHardBlocked) {
            setTemplateSyncError(readinessBlockingMessage || "Cannot sync templates for this number until number auth/token setup is fixed.")
            return
        }
        if (isTemplateAuthFailed) {
            setTemplateSyncError("لا يمكن مزامنة القوالب لهذا الرقم حتى إعادة ربط Access Token من صفحة الإعدادات والربط.")
            return
        }
        if (!force && !shouldSyncScopedTemplates(selectedPhoneNumberId)) return
        setIsSyncingTemplates(true)
        setTemplateSyncError(null)
        setTemplateSyncWarning(null)
        try {
            const fallbackResult = await runConvexActionSafe(syncTemplatesForNumber as any, {
                phoneNumberId: selectedPhoneNumberId,
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
            markScopedTemplatesSynced(selectedPhoneNumberId)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            setTemplateSyncError(message || "تعذر مزامنة القوالب.")
        } finally {
            setIsSyncingTemplates(false)
        }
    }, [
        enableExtendedCampaignApis,
        isTemplateAuthFailed,
        selectedPhoneNumberId,
        isTemplateReadinessHardBlocked,
        readinessBlockingMessage,
        syncTemplatesForNumber,
    ])

    useEffect(() => {
        if (numbers.length > 0 && selectedPhoneNumberId === null) {
            setSelectedPhoneNumberId(activePhoneNumberId ?? numbers[0].businessNumberId)
        }
    }, [numbers, activePhoneNumberId, selectedPhoneNumberId])

    useEffect(() => {
        const previousPhoneNumberId = previousPhoneNumberIdRef.current
        if (
            previousPhoneNumberId !== null &&
            previousPhoneNumberId !== selectedPhoneNumberId &&
            selectedTemplate
        ) {
            setSelectedTemplate(null)
            setTemplateAutoClearedMessage("Selected template is no longer valid for this number; please reselect.")
        }
        previousPhoneNumberIdRef.current = selectedPhoneNumberId
        setTemplateValidation(null)
        setTemplateSyncError(null)
        setTemplateSyncWarning(null)
    }, [selectedPhoneNumberId, selectedTemplate])

    useEffect(() => {
        if (!selectedTemplate || !templates) return
        const stillExists = templates.some((template) => template._id === selectedTemplate._id)
        if (stillExists) return
        setSelectedTemplate(null)
        setTemplateAutoClearedMessage("Selected template is no longer valid for this number; please reselect.")
    }, [selectedTemplate, templates])

    useEffect(() => {
        if (currentStep !== 2 || !selectedPhoneNumberId) return
        void triggerScopedTemplateSync(false)
    }, [currentStep, selectedPhoneNumberId, triggerScopedTemplateSync])

    useEffect(() => {
        if (!isTestCampaign) {
            setTestBypassRecentContact(false)
            setTestContactPhones([])
            setTestPhoneInput("")
        }
    }, [isTestCampaign])

    useEffect(() => {
        let cancelled = false
        const validateTemplate = async () => {
            if (!selectedTemplate?.name || !selectedPhoneNumberId) {
                if (!cancelled) {
                    setTemplateValidation(null)
                    setIsTemplateValidationLoading(false)
                }
                return
            }
            if (!strictTemplateChecksEnabled) {
                if (!cancelled) {
                    setTemplateValidation({
                        ok: true,
                        bypass: true,
                        reasonCode: "MISSING_REQUIRED_APIS",
                        message: "واجهات التحقق غير متاحة. يمكنك المتابعة باستخدام القالب المختار.",
                        suggestedAction: "لتفعيل التحقق الكامل، انشر دوال الحملات/القوالب على hardy-gopher-480.",
                    })
                    setIsTemplateValidationLoading(false)
                }
                return
            }
            if (!cancelled) {
                setIsTemplateValidationLoading(true)
            }
            try {
                const result = await convex.query((api as any).campaigns.validateTemplateSelection, {
                    templateName: selectedTemplate.name,
                    phoneNumberId: selectedPhoneNumberId,
                    requestedLanguage: selectedTemplate.language ?? undefined,
                })
                if (!cancelled) {
                    setTemplateValidation(result)
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                const missingFunction = message.includes("Could not find public function for 'campaigns:validateTemplateSelection'")
                if (!cancelled) {
                    if (missingFunction) {
                        setTemplateValidation({
                            ok: false,
                            reasonCode: "VALIDATOR_UNAVAILABLE",
                            message: "دالة التحقق من القالب غير متاحة على نسخة Convex الحالية.",
                            suggestedAction: "قم بنشر backend (campaigns:validateTemplateSelection) ثم أعد المحاولة.",
                        })
                    } else {
                        setTemplateValidation({
                            ok: false,
                            message: "تعذر التحقق من القالب حالياً",
                            suggestedAction: "حاول مزامنة القوالب أو إعادة المحاولة بعد قليل.",
                        })
                    }
                }
            } finally {
                if (!cancelled) {
                    setIsTemplateValidationLoading(false)
                }
            }
        }
        void validateTemplate()
        return () => {
            cancelled = true
        }
    }, [convex, strictTemplateChecksEnabled, selectedTemplate?.name, selectedTemplate?.language, selectedPhoneNumberId])

    useEffect(() => {
        let cancelled = false
        const loadRuntimeInfo = async () => {
            if (!isAdmin || !enableExtendedCampaignApis) return
            try {
                const result = await convex.query((api as any).system.getRuntimeDeploymentInfo, {
                    includeEnvKeys: true,
                })
                if (!cancelled) {
                    setRuntimeInfo(result)
                    setRuntimeInfoUnavailable(false)
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                const missingFunction = message.includes("Could not find public function for 'system:getRuntimeDeploymentInfo'")
                if (!cancelled) {
                    if (missingFunction) {
                        setRuntimeInfoUnavailable(true)
                        setRuntimeInfo(null)
                    } else {
                        setRuntimeInfo({
                            deploymentUrl: "unknown",
                            buildMarker: "unknown",
                            error: "Runtime diagnostics are temporarily unavailable.",
                        })
                    }
                }
            }
        }
        void loadRuntimeInfo()
        return () => {
            cancelled = true
        }
    }, [convex, enableExtendedCampaignApis, isAdmin])

    const handleSubmit = async () => {
        if (testBypassValidationError || testContactOverflowWarning) return
        if (!selectedPhoneNumberId || !selectedTemplate?._id) return
        if (!apisUnavailableBypass && templateCriticalApisUnavailable) {
            toast.error("لا يمكن إنشاء الحملة الآن لأن واجهات التحقق الأساسية غير متاحة على نسخة الخادم الحالية.")
            return
        }
        if (isTemplateReadinessHardBlocked || isTemplateAuthFailed || !!templateSyncError) {
            toast.error("لا يمكن إنشاء الحملة قبل إصلاح حالة الرقم/القوالب لهذا الرقم.")
            return
        }
        if (!apisUnavailableBypass && (isTemplateValidationLoading || !templateValidation?.ok)) {
            toast.error("التحقق من القالب لم يكتمل أو فشل. أصلح المشكلة ثم أعد المحاولة.")
            return
        }
        if (isTestCampaign && optionalExtendedApisUnavailable) {
            toast.error("حملات الاختبار تتطلب نشر نسخة Convex المحدثة (npx convex deploy).")
            return
        }
        setIsSubmitting(true)
        const payload: Record<string, unknown> = {
            name,
            templateId: selectedTemplate?._id,
            templateName: selectedTemplate?.name || "",
            phoneNumberId: selectedPhoneNumberId ?? undefined,
            targetTags: targetAudience === 'tags' ? selectedTags : undefined,
            targetContactIds: targetAudience === 'selected' && selectedContactIds.length > 0 ? selectedContactIds : undefined,
            scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : Date.now(),
            recurrenceCronSpec: recurrenceCronSpec || undefined,
            sendingConfig
        }
        if (!optionalExtendedApisUnavailable) {
            if (selectedTemplate?.language) payload.templateLanguage = selectedTemplate.language
            if (isTestCampaign) {
                payload.isTestCampaign = true
                payload.testBypassRecentContact = testBypassRecentContact
                if (normalizedTestPhones.length > 0) payload.testContactPhones = normalizedTestPhones
            }
        }
        try {
            await createCampaign(payload)
            router.push("/campaigns?success=true")
        } catch (error) {
            console.error("Failed to create campaign:", error)
            toast.error(
                toUserSafeConvexMessage(
                    error,
                    "تعذر إنشاء الحملة.",
                    "ميزة إنشاء الحملات المتقدمة غير متاحة حالياً على نسخة الخادم الحالية."
                )
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const steps = [
        { id: 0, title: "التفاصيل", icon: <LayoutTemplate className="h-4 w-4" /> },
        { id: 1, title: "الجمهور", icon: <Users className="h-4 w-4" /> },
        { id: 2, title: "المحتوى", icon: <MessageSquare className="h-4 w-4" /> },
        { id: 3, title: "المراجعة", icon: <CheckCircle2 className="h-4 w-4" /> },
    ]

    const addTestPhone = () => {
        const normalized = testPhoneInput.replace(/[^\d+]/g, "")
        if (!normalized) return
        if (testContactPhones.includes(normalized)) {
            setTestPhoneInput("")
            return
        }
        setTestContactPhones((prev) => [...prev, normalized])
        setTestPhoneInput("")
    }

    return (
        <div className="max-w-6xl mx-auto p-6 sm:p-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")} className="rounded-xl">
                    <ArrowRight className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">إنشاء حملة جديدة</h1>
                    <p className="text-muted-foreground">قم بإعداد حملتك في 4 خطوات بسيطة</p>
                </div>
            </div>
            {isAdmin && enableExtendedCampaignApis && (
                <Card className="mb-6 border-dashed">
                    <CardContent className="py-4 space-y-2 text-sm">
                        <div className="flex items-center gap-2 font-medium">
                            <Shield className="h-4 w-4" />
                            Runtime Deployment Diagnostics
                        </div>
                        {runtimeInfoUnavailable ? (
                            <div className="flex items-center gap-2 text-amber-600">
                                <AlertTriangle className="h-4 w-4" />
                                <span>`system:getRuntimeDeploymentInfo` is unavailable on this deployment.</span>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <span className="text-muted-foreground">Deployment URL:</span>{" "}
                                    <code>{runtimeInfo?.deploymentUrl ?? "loading..."}</code>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Build Marker:</span>{" "}
                                    <code>{runtimeInfo?.buildMarker ?? "loading..."}</code>
                                </div>
                                {runtimeInfo?.error ? (
                                    <div className="text-amber-600">{runtimeInfo.error}</div>
                                ) : null}
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Steps Sidebar */}
                <div className="lg:col-span-3 space-y-2">
                    {steps.map((step) => (
                        <div
                            key={step.id}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                                currentStep === step.id 
                                    ? "bg-primary text-primary-foreground" 
                                    : currentStep > step.id 
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground"
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                currentStep === step.id ? "bg-white/20" : "bg-muted-foreground/10"
                            }`}>
                                {currentStep > step.id ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
                            </div>
                            <span className="font-medium">{step.title}</span>
                            {currentStep === step.id && <ChevronRight className="h-4 w-4 mr-auto animate-pulse" />}
                        </div>
                    ))}
                </div>

                {/* Main Form Area */}
                <div className="lg:col-span-9">
                    <Card className="border bg-card/50 min-h-[500px]">
                        <CardContent className="p-6">
                            {/* Step 1: Details */}
                            {currentStep === 0 && (
                                <div className="space-y-6 max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-2">
                                        <Label className="text-base">اسم الحملة</Label>
                                        <Input
                                            placeholder="مثال: عروض الجمعة البيضاء"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="h-12 text-lg"
                                            autoFocus
                                        />
                                    </div>

                                    {numbers.length > 0 && (
                                        <div className="space-y-2">
                                            <Label className="text-base">رقم الإرسال</Label>
                                            <select
                                                value={selectedPhoneNumberId ?? ""}
                                                onChange={(e) => setSelectedPhoneNumberId(e.target.value || null)}
                                                className="flex h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                {numbers.map((n) => (
                                                    <option key={n._id} value={n.businessNumberId}>
                                                        {n.name} ({n.phone})
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-muted-foreground">سيتم إرسال رسائل الحملة من هذا الرقم</p>
                                        </div>
                                    )}
                                    
                                    <SchedulePicker
                                        value={scheduledAt}
                                        onChange={(datetime) => setScheduledAt(datetime || "")}
                                        label="وقت الإرسال"
                                    />

                                    {/* Recurrence Section - Collapsible */}
                                    <div className="space-y-4 pt-6 border-t mt-6">
                                        <div 
                                            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                                                recurrenceCronSpec 
                                                    ? 'border-primary bg-primary/5' 
                                                    : 'border-border hover:border-primary/50'
                                            }`}
                                            onClick={() => {
                                                if (!recurrenceCronSpec) {
                                                    // Set default daily at 9 AM if enabling
                                                    setRecurrenceCronSpec("0 9 * * *")
                                                }
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    if (!recurrenceCronSpec) {
                                                        setRecurrenceCronSpec("0 9 * * *")
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                    recurrenceCronSpec ? 'border-primary' : 'border-muted-foreground'
                                                }`}>
                                                    {recurrenceCronSpec && <div className="w-3 h-3 rounded-full bg-primary" />}
                                                </div>
                                                <div className="flex-1">
                                                    <Label className="cursor-pointer font-bold text-lg">
                                                        تكرار دوري (اختياري)
                                                    </Label>
                                                </div>
                                                {recurrenceCronSpec && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setRecurrenceCronSpec("")
                                                        }}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground mr-9">
                                                {recurrenceCronSpec 
                                                    ? "الحملة ستعيد الإرسال تلقائياً حسب الجدولة" 
                                                    : "إرسال الحملة بشكل متكرر (يومي، أسبوعي، شهري، سنوي)"}
                                            </p>
                                        </div>
                                        {recurrenceCronSpec && (
                                            <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                                <CronScheduler
                                                    value={recurrenceCronSpec}
                                                    onChange={setRecurrenceCronSpec}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Anti-spam Settings */}
                                    <div className="space-y-4 pt-6 border-t">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-5 w-5 text-green-600" />
                                            <Label className="text-base font-semibold">حماية من الحظر</Label>
                                        </div>
                                        
                                        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg p-4 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <span className="font-medium">تخطي المتصل مؤخراً</span>
                                                    <p className="text-xs text-muted-foreground">
                                                        تجنب إرسال رسائل متكررة لنفس العميل
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={sendingConfig.skipRecentlyContacted}
                                                    onCheckedChange={(checked) => 
                                                        setSendingConfig(prev => ({ ...prev, skipRecentlyContacted: checked }))
                                                    }
                                                />
                                            </div>
                                            
                                            {sendingConfig.skipRecentlyContacted && (
                                                <div className="flex items-center gap-3 pr-4">
                                                    <Label className="text-sm text-muted-foreground whitespace-nowrap">خلال:</Label>
                                                    <select
                                                        value={sendingConfig.recentContactHours}
                                                        onChange={(e) => 
                                                            setSendingConfig(prev => ({ ...prev, recentContactHours: Number(e.target.value) }))
                                                        }
                                                        className="h-9 px-3 rounded-lg border bg-background text-sm"
                                                    >
                                                        <option value={12}>12 ساعة</option>
                                                        <option value={24}>24 ساعة</option>
                                                        <option value={48}>48 ساعة</option>
                                                        <option value={72}>72 ساعة</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Advanced Settings Toggle */}
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                                            إعدادات متقدمة
                                        </button>

                                        {showAdvancedSettings && (
                                            <div className="bg-muted/30 border rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">معدل الإرسال (رسائل/ثانية)</Label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={80}
                                                            value={sendingConfig.messagesPerSecond}
                                                            onChange={(e) => 
                                                                setSendingConfig(prev => ({ ...prev, messagesPerSecond: Number(e.target.value) }))
                                                            }
                                                            className="h-9"
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            الحد الأقصى: 80 (ننصح بـ 10)
                                                        </p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">التأخير بين الرسائل (مللي ثانية)</Label>
                                                        <Input
                                                            type="number"
                                                            min={50}
                                                            max={5000}
                                                            value={sendingConfig.delayBetweenMessages}
                                                            onChange={(e) => 
                                                                setSendingConfig(prev => ({ ...prev, delayBetweenMessages: Number(e.target.value) }))
                                                            }
                                                            className="h-9"
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            ننصح بـ 100ms أو أكثر
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-sm">محاولات إعادة الإرسال</Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={5}
                                                        value={sendingConfig.maxRetries}
                                                        onChange={(e) => 
                                                            setSendingConfig(prev => ({ ...prev, maxRetries: Number(e.target.value) }))
                                                        }
                                                        className="h-9 w-24"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {isAdmin && (
                                        <div className="space-y-4 pt-6 border-t">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-base font-semibold">وضع حملة اختبار</Label>
                                                <Badge variant="outline" className="text-xs">Admin</Badge>
                                            </div>

                                            <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium">تفعيل حملة اختبار</p>
                                                        <p className="text-xs text-muted-foreground">لاستخدام إعدادات اختبار خاصة فقط</p>
                                                    </div>
                                                    <Switch
                                                        checked={isTestCampaign}
                                                        onCheckedChange={setIsTestCampaign}
                                                    />
                                                </div>

                                                {isTestCampaign && (
                                                    <div className="space-y-4 border-t pt-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="font-medium">تجاوز شرط &quot;تم التواصل مؤخراً&quot;</p>
                                                                <p className="text-xs text-muted-foreground">يطبق فقط على أرقام الاختبار المحددة</p>
                                                            </div>
                                                            <Switch
                                                                checked={testBypassRecentContact}
                                                                onCheckedChange={(checked) => {
                                                                    setTestBypassRecentContact(checked)
                                                                    if (checked && testContactPhones.length === 0) {
                                                                        setTestContactPhones(["201015638178"])
                                                                    }
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="text-sm">أرقام الاختبار المسموح لها بالتجاوز</Label>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    value={testPhoneInput}
                                                                    onChange={(e) => setTestPhoneInput(e.target.value)}
                                                                    placeholder="مثال: 201015638178"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") {
                                                                            e.preventDefault()
                                                                            addTestPhone()
                                                                        }
                                                                    }}
                                                                />
                                                                <Button type="button" variant="outline" onClick={addTestPhone}>
                                                                    إضافة
                                                                </Button>
                                                            </div>
                                                            {testContactPhones.length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {testContactPhones.map((phone) => (
                                                                        <Badge key={phone} variant="secondary" className="gap-1">
                                                                            {phone}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setTestContactPhones((prev) => prev.filter((p) => p !== phone))}
                                                                                className="text-xs"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {testBypassValidationError && (
                                                                <p className="text-xs text-destructive">{testBypassValidationError}</p>
                                                            )}
                                                            {testContactOverflowWarning && (
                                                                <p className="text-xs text-amber-700 dark:text-amber-400">{testContactOverflowWarning}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 2: Audience */}
                            {currentStep === 1 && (
                                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div
                                            className={`relative p-6 border rounded-lg cursor-pointer transition-all overflow-hidden ${targetAudience === 'all' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                                            onClick={() => setTargetAudience('all')}
                                        >
                                            <div className="relative z-10">
                                                <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center mb-4 border">
                                                    <Users className="h-6 w-6 text-primary" />
                                                </div>
                                                <h3 className="text-lg font-bold mb-1">جميع العملاء</h3>
                                                <p className="text-muted-foreground text-sm">إرسال لجميع جهات الاتصال المسجلة</p>
                                                <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-background text-sm font-medium border">
                                                    {contacts?.length || 0} عميل
                                                </div>
                                            </div>
                                            {targetAudience === 'all' && <div className="absolute top-4 left-4 text-primary"><CheckCircle2 className="h-6 w-6" /></div>}
                                        </div>

                                        <div
                                            className={`relative p-6 border rounded-lg cursor-pointer transition-all overflow-hidden ${targetAudience === 'tags' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                                            onClick={() => setTargetAudience('tags')}
                                        >
                                            <div className="relative z-10">
                                                <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center mb-4 border">
                                                    <Tag className="h-6 w-6 text-primary" />
                                                </div>
                                                <h3 className="text-lg font-bold mb-1">تحديد فئات</h3>
                                                <p className="text-muted-foreground text-sm">استهداف مجموعة محددة حسب التصنيفات</p>
                                            </div>
                                            {targetAudience === 'tags' && <div className="absolute top-4 left-4 text-primary"><CheckCircle2 className="h-6 w-6" /></div>}
                                        </div>

                                        <div
                                            className={`relative p-6 border rounded-lg cursor-pointer transition-all overflow-hidden ${targetAudience === 'selected' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                                            onClick={() => setTargetAudience('selected')}
                                        >
                                            <div className="relative z-10">
                                                <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center mb-4 border">
                                                    <CheckCircle2 className="h-6 w-6 text-primary" />
                                                </div>
                                                <h3 className="text-lg font-bold mb-1">جهات اتصال محددة</h3>
                                                <p className="text-muted-foreground text-sm">إرسال فقط للمحددين من القائمة</p>
                                                <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-background text-sm font-medium border">
                                                    {selectedContactIds.length} محدد
                                                </div>
                                            </div>
                                            {targetAudience === 'selected' && <div className="absolute top-4 left-4 text-primary"><CheckCircle2 className="h-6 w-6" /></div>}
                                        </div>
                                    </div>

                                    {targetAudience === 'selected' && (
                                        <div className="space-y-4 bg-muted/30 p-6 rounded-lg border animate-in fade-in zoom-in-95">
                                            <Label className="text-base">اختر جهات الاتصال المستهدفة</Label>
                                            <p className="text-sm text-muted-foreground">سيتم إرسال الحملة فقط لهؤلاء المستلمين.</p>
                                            <ScrollArea className="h-[280px] border rounded-lg p-3">
                                                <div className="space-y-2">
                                                    {contacts?.map(c => (
                                                        <label
                                                            key={c._id}
                                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                                                        >
                                                            <Checkbox
                                                                checked={selectedContactIds.includes(c._id)}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) setSelectedContactIds(prev => [...prev, c._id])
                                                                    else setSelectedContactIds(prev => prev.filter(id => id !== c._id))
                                                                }}
                                                            />
                                                            <span className="font-medium">{c.name || c.phone || "بدون اسم"}</span>
                                                            {c.phone && <span className="text-muted-foreground text-sm">{c.phone}</span>}
                                                        </label>
                                                    ))}
                                                    {(!contacts || contacts.length === 0) && <p className="text-muted-foreground text-sm">لا يوجد جهات اتصال</p>}
                                                </div>
                                            </ScrollArea>
                                            <div className="flex gap-2">
                                                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedContactIds(contacts?.map(c => c._id) ?? [])}>
                                                    تحديد الكل
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedContactIds([])}>
                                                    إلغاء التحديد
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {targetAudience === 'tags' && (
                                        <div className="space-y-4 bg-muted/30 p-6 rounded-lg border animate-in fade-in zoom-in-95">
                                            <Label className="text-base">اختر التصنيفات المستهدفة</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {uniqueTags.map(tag => (
                                                    <Badge
                                                        key={tag}
                                                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                                                        className={`text-sm py-2 px-4 cursor-pointer hover:bg-primary/90 transition-all ${selectedTags.includes(tag) ? 'bg-primary text-primary-foreground' : 'bg-background hover:text-foreground'}`}
                                                        onClick={() => {
                                                            if (selectedTags.includes(tag)) {
                                                                setSelectedTags(selectedTags.filter(t => t !== tag))
                                                            } else {
                                                                setSelectedTags([...selectedTags, tag])
                                                            }
                                                        }}
                                                    >
                                                        {tag}
                                                        {selectedTags.includes(tag) && <CheckCircle2 className="h-3.5 w-3.5 mr-2" />}
                                                    </Badge>
                                                ))}
                                                {uniqueTags.length === 0 && <p className="text-muted-foreground text-sm">لا توجد تصنيفات متاحة</p>}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 text-blue-800 dark:text-blue-300">
                                        <span className="font-medium flex items-center gap-2">
                                            <Users className="h-5 w-5" />
                                            إجمالي المستلمين المتوقع:
                                        </span>
                                        <span className="text-xl font-bold">{filteredContacts.length}</span>
                                    </div>
                                    {testAudienceWarning && (
                                        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                            {testAudienceWarning}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Content */}
                            {currentStep === 2 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-base">اختر القالب</Label>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="font-normal">{templates?.length || 0} قوالب متاحة</Badge>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={!selectedPhoneNumberId || isSyncingTemplates || isTemplateReadinessHardBlocked}
                                                    onClick={() => void triggerScopedTemplateSync(true)}
                                                >
                                                    {isSyncingTemplates ? "جارٍ المزامنة..." : "مزامنة القوالب"}
                                                </Button>
                                            </div>
                                        </div>
                                        {isTemplateReadinessHardBlocked && (
                                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                                                {readinessBlockingMessage}
                                                <div className="mt-2">
                                                    <Button size="sm" variant="ghost" onClick={() => router.push("/integrations")}>
                                                        فتح الإعدادات والربط
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {isTemplateAuthFailed && (
                                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                                                لا يمكن مزامنة أو إرسال القوالب لهذا الرقم حتى إعادة ربط Access Token من صفحة الإعدادات والربط.
                                                {templateAuthFailedMessage ? ` (${templateAuthFailedMessage})` : ""}
                                            </div>
                                        )}
                                        {optionalExtendedApisUnavailable && (
                                            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                                                بعض واجهات التحقق غير متاحة في نسخة Convex الحالية. يمكنك المتابعة باختيار قالب ثم النقر &quot;التالي&quot; — قد تفشل الحملة إذا كان القالب غير صالح. لتفعيل التحقق الكامل، انشر دوال الحملات/القوالب.
                                            </div>
                                        )}

                                        {isSyncingTemplates && (
                                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
                                                جارٍ مزامنة القوالب لهذا الرقم...
                                            </div>
                                        )}
                                        {templateSyncError && (
                                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                                                تعذر مزامنة القوالب. حاول مرة أخرى. {templateSyncError}
                                            </div>
                                        )}
                                        {templateSyncWarning && (
                                            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                                                {templateSyncWarning}
                                            </div>
                                        )}

                                        <ScrollArea className="h-[400px] pr-4">
                                            <div className="space-y-3">
                                                {!selectedPhoneNumberId ? (
                                                    <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                                                        اختر رقم إرسال أولاً لعرض القوالب المرتبطة به.
                                                    </div>
                                                ) : !templates ? (
                                                    [1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)
                                                ) : templates.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                                                        <p>لا توجد قوالب معتمدة مرتبطة بهذا الرقم بعد.</p>
                                                        <p className="text-xs">
                                                            تتم المزامنة تلقائياً كل {syncTtlMinutes} دقائق لكل رقم. يمكنك المزامنة الآن أو إدارة القوالب من صفحة القوالب.
                                                        </p>
                                                        {templateHealth?.hasAnyGlobalApproved ? (
                                                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                                                توجد قوالب عامة لكن الإرسال الآن يتطلب قوالب مرتبطة بالرقم فقط.
                                                            </p>
                                                        ) : null}
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => void triggerScopedTemplateSync(true)}
                                                                disabled={isSyncingTemplates || isTemplateReadinessHardBlocked}
                                                            >
                                                                مزامنة القوالب
                                                            </Button>
                                                            <Button size="sm" variant="ghost" onClick={() => router.push("/integrations")}>
                                                                إعادة ربط الرقم
                                                            </Button>
                                                            <Button size="sm" variant="ghost" onClick={() => router.push("/templates")}>
                                                                الذهاب إلى القوالب
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    templates.map(template => (
                                                        <div
                                                            key={template._id}
                                                            className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedTemplate?._id === template._id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                                                            onClick={() => {
                                                                setSelectedTemplate(template)
                                                                setTemplateAutoClearedMessage(null)
                                                            }}
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-semibold">{template.name}</h4>
                                                                {selectedTemplate?._id === template._id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                                            </div>
                                                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                                                {(template.components as { type?: string; text?: string }[] | undefined)?.find(c => c.type === 'BODY')?.text || template.content}
                                                            </p>
                                                            <div className="mt-3 flex gap-2">
                                                                <Badge variant="secondary" className="text-[10px]">{template.category}</Badge>
                                                                <Badge variant="outline" className="text-[10px]">{template.language}</Badge>
                                                                <Badge variant="outline" className="text-[10px]">Scoped</Badge>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </ScrollArea>
                                        {selectedTemplate && templateValidation && !templateValidation.ok && (
                                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                                <p className="font-medium">{templateValidation.message}</p>
                                                <p className="text-xs mt-1">{templateValidation.suggestedAction}</p>
                                                <div className="mt-2">
                                                    <Button size="sm" variant="outline" onClick={() => router.push("/templates")}>
                                                        مزامنة القوالب
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {isTemplateValidationLoading && selectedTemplate && (
                                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
                                                جارٍ التحقق من القالب...
                                            </div>
                                        )}
                                        {templateAutoClearedMessage && (
                                            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                                                {templateAutoClearedMessage}
                                            </div>
                                        )}
                                    </div>

                                    {/* Phone Preview */}
                                    <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-900 border-[14px] rounded-[2.5rem] h-[500px] w-[300px]">
                                        <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute"></div>
                                        <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
                                        <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                                        <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
                                        <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
                                        <div className="rounded-[2rem] overflow-hidden w-full h-full bg-[#E5DDD5] dark:bg-[#111b21] relative flex flex-col">
                                            {/* WhatsApp Header */}
                                            <div className="bg-[#008069] dark:bg-[#202c33] p-3 pt-8 flex items-center gap-2 text-white">
                                                <ChevronRight className="h-5 w-5 rotate-180" />
                                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                                    <Smartphone className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold">W-AI Demo</div>
                                                </div>
                                            </div>
                                            
                                            {/* Message Area */}
                                            <div className="flex-1 p-3 overflow-y-auto bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-90">
                                                <TemplatePreview 
                                                    template={selectedTemplate}
                                                    className="max-w-[85%]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Review */}
                            {currentStep === 3 && (
                                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4 border rounded-lg p-4">
                                            <div>
                                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">الحملة</Label>
                                                <div className="text-xl font-bold mt-1">{name}</div>
                                            </div>
                                            <div>
                                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">التوقيت</Label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock className="h-5 w-5 text-primary" />
                                                    <span className="text-lg font-medium">
                                                        {scheduledAt ? format(new Date(scheduledAt), "PPP p", { locale: ar }) : "إرسال فوري"}
                                                    </span>
                                                </div>
                                                {recurrenceCronSpec && (
                                                    <Badge variant="outline" className="mt-2">تكرار: {recurrenceCronSpec}</Badge>
                                                )}
                                            </div>
                                            <div>
                                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">الجمهور</Label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Users className="h-5 w-5 text-primary" />
                                                    <span className="text-lg font-medium">{filteredContacts.length} مستلم</span>
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    {targetAudience === 'all' && 'جميع جهات الاتصال'}
                                                    {targetAudience === 'tags' && `التصنيفات: ${selectedTags.join(', ')}`}
                                                    {targetAudience === 'selected' && `${selectedContactIds.length} جهة اتصال محددة`}
                                                </div>
                                            </div>
                                            {numbers.length > 0 && (
                                                <div>
                                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">رقم الإرسال</Label>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Smartphone className="h-5 w-5 text-primary" />
                                                        <span className="text-lg font-medium">
                                                            {numbers.find((n) => n.businessNumberId === selectedPhoneNumberId)?.name ?? selectedPhoneNumberId ?? "افتراضي"}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {isAdmin && isTestCampaign && (
                                                <div>
                                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">وضع الاختبار</Label>
                                                    <div className="text-sm mt-1">
                                                        <p className="font-medium text-foreground">مفعل</p>
                                                        {testBypassRecentContact && normalizedTestPhones.length > 0 && (
                                                            <p className="text-muted-foreground">
                                                                Anti-spam bypass enabled for: {normalizedTestPhones.join(", ")}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border rounded-lg p-4">
                                            <Label className="text-muted-foreground text-xs mb-3 block">محتوى الرسالة</Label>
                                            {selectedTemplate ? (
                                                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                                                    <Badge variant="secondary">{selectedTemplate.name}</Badge>
                                                    <Badge variant="outline">{selectedTemplate.language || "unknown"}</Badge>
                                                    <Badge variant="outline">Scoped</Badge>
                                                </div>
                                            ) : null}
                                            <TemplatePreview template={selectedTemplate} />
                                        </div>
                                    </div>

                                    {/* Anti-spam Settings Summary */}
                                    <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Shield className="h-5 w-5 text-green-600" />
                                            <Label className="text-green-700 dark:text-green-300 font-semibold">حماية من الحظر مفعلة</Label>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">معدل الإرسال:</span>
                                                <span className="font-medium mr-2">{sendingConfig.messagesPerSecond} رسائل/ثانية</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">التأخير:</span>
                                                <span className="font-medium mr-2">{sendingConfig.delayBetweenMessages}ms</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">إعادة المحاولة:</span>
                                                <span className="font-medium mr-2">{sendingConfig.maxRetries} مرات</span>
                                            </div>
                                            {sendingConfig.skipRecentlyContacted && (
                                                <div className="col-span-2 sm:col-span-3">
                                                    <span className="text-muted-foreground">تخطي المتصل خلال:</span>
                                                    <span className="font-medium mr-2">{sendingConfig.recentContactHours} ساعة</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 p-4 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 rounded-lg text-yellow-800 dark:text-yellow-200">
                                        <Play className="h-5 w-5 mt-0.5 shrink-0" />
                                        <div className="text-sm">
                                            <p className="font-semibold mb-1">تنبيه هام</p>
                                            <p className="opacity-90">
                                                سيتم جدولة الحملة وإرسال الرسائل بشكل تدريجي (Batching) لتجنب الحظر من WhatsApp.
                                                يمكنك متابعة حالة الإرسال في لوحة التحكم.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Navigation */}
                            <div className="flex justify-between pt-8 border-t mt-8">
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                                    disabled={currentStep === 0}
                                    className="px-8"
                                >
                                    السابق
                                </Button>
                                
                                {currentStep < 3 ? (
                                    <Button
                                        onClick={() => setCurrentStep(currentStep + 1)}
                                        disabled={
                                            (currentStep === 0 && (!name || !selectedPhoneNumberId)) ||
                                            (currentStep === 1 && (filteredContacts.length === 0 || (targetAudience === 'selected' && selectedContactIds.length === 0))) ||
                                            (currentStep === 2 &&
                                                (
                                                    !selectedPhoneNumberId ||
                                                    !contentStepCanProceed ||
                                                    !!templateSyncError ||
                                                    isTemplateReadinessHardBlocked ||
                                                    isTemplateAuthFailed
                                                ))
                                        }
                                        className="px-8 gap-2"
                                    >
                                        التالي <ArrowRight className="h-4 w-4 rotate-180" />
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleSubmit}
                                        className="px-10 gap-2 bg-[#004D3D] hover:bg-[#003D2D]"
                                        disabled={
                                            isSubmitting ||
                                            !!testBypassValidationError ||
                                            !!testContactOverflowWarning ||
                                            !contentStepCanProceed ||
                                            isTemplateReadinessHardBlocked ||
                                            isTemplateAuthFailed ||
                                            !!templateSyncError
                                        }
                                    >
                                        {isSubmitting ? "جاري الإنشاء..." : scheduledAt ? "تأكيد الجدولة" : "إرسال الحملة"}
                                        {!isSubmitting && <CheckCircle2 className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
