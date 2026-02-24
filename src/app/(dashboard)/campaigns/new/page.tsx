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
import {
    ArrowRight,
    Users,
    MessageSquare,
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
import { useScopedApprovedTemplates } from "@/hooks/useScopedApprovedTemplates"
import { toast } from "sonner"
import { toUserSafeConvexMessage } from "@/lib/convexErrors"
import { runConvexActionSafe } from "@/lib/convexActionSafe"

type CampaignCreateResultRow = {
    phoneNumberId: string
    status: "created" | "skipped" | "failed"
    campaignId?: string
    reason?: string
    downgradedTestMode?: boolean
}

type ScopedTemplateCandidate = {
    _id: string
    name: string
    language?: string | null
    phoneNumberId?: string | null
    status?: string
    lastSyncedAt?: number | null
    _creationTime?: number
}

const DEFAULT_TEST_PHONE = "201015638178"

function normalizeTemplateLanguageCode(value: string | null | undefined): string {
    return String(value ?? "").trim().toLowerCase().replace("-", "_")
}

function languageFamily(value: string | null | undefined): string {
    const normalized = normalizeTemplateLanguageCode(value)
    return normalized.split("_")[0] ?? ""
}

function templateRecency(template: ScopedTemplateCandidate): number {
    return Number(template.lastSyncedAt ?? template._creationTime ?? 0)
}

function pickLatestTemplate(templates: ScopedTemplateCandidate[]): ScopedTemplateCandidate | null {
    if (templates.length === 0) return null
    return templates.slice().sort((a, b) => templateRecency(b) - templateRecency(a))[0] ?? null
}

function isMissingFunctionError(message: string): boolean {
    return message.includes("Could not find public function")
}

function toAsciiDigits(value: string): string {
    return value
        .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
}

function normalizeCampaignTestPhone(raw: string | null | undefined): string {
    return toAsciiDigits(String(raw ?? "")).replace(/\D/g, "")
}

function normalizeCampaignTestPhoneList(phones: string[] | null | undefined): string[] {
    return Array.from(
        new Set(
            (phones ?? [])
                .map((phone) => normalizeCampaignTestPhone(phone))
                .filter((phone) => phone.length > 0)
        )
    )
}

function mapResultReasonToArabic(reason: string): string {
    switch (reason) {
        case "NUMBER_NOT_FOUND":
            return "الرقم غير موجود أو غير مهيأ"
        case "TOKEN_MISSING":
            return "رمز الوصول مفقود لهذا الرقم"
        case "AUTH_FAILED":
            return "فشل المصادقة لهذا الرقم"
        case "WABA_MISMATCH":
            return "عدم تطابق بين الرقم وحساب WABA لهذا الرقم"
        case "TEMPLATE_NOT_AVAILABLE_FOR_NUMBER":
            return "القالب غير متاح لهذا الرقم"
        case "CREATE_VALIDATION_ERROR":
            return "فشل إنشاء الحملة بسبب تحقق الخادم"
        case "CREATE_FAILED":
            return "تعذر إنشاء الحملة"
        default:
            return reason
    }
}

function mapReadinessReasonToArabic(
    reason: string | null | undefined,
    fallbackMessage?: string
): string {
    switch (reason) {
        case "NUMBER_NOT_FOUND":
            return "الرقم غير موجود أو غير مهيأ. تحقق من إعدادات التكاملات ثم أعد المحاولة."
        case "TOKEN_MISSING":
            return "رمز الوصول مفقود لهذا الرقم. أضف Access Token من صفحة الإعدادات والربط."
        case "AUTH_FAILED":
            return "فشل التحقق من رمز الوصول لهذا الرقم. أعد ربط الرقم من صفحة الإعدادات والربط."
        case "WABA_MISMATCH":
            return "عدم تطابق بين رقم الإرسال وحساب WABA المهيأ. عدّل الربط في الإعدادات والربط ثم أعد مزامنة القوالب."
        case "NO_SCOPED_TEMPLATES":
            return "لا توجد قوالب معتمدة لهذا الرقم. قم بمزامنة القوالب ثم اختر قالباً معتمداً."
        default:
            return fallbackMessage || "الرقم غير جاهز حالياً لإرسال القوالب."
    }
}

function mapTemplateSyncErrorToArabic(message: string): string {
    const value = String(message ?? "").trim()
    if (!value) return "تعذر مزامنة القوالب."
    const lower = value.toLowerCase()
    if (
        lower.includes("[waba_mismatch]") ||
        lower.includes("mismatch between sending number and configured waba") ||
        lower.includes("not a member of configured waba")
    ) {
        return "عدم تطابق بين رقم الإرسال وحساب WABA المهيأ. عدّل الربط في الإعدادات والربط ثم أعد مزامنة القوالب."
    }
    return value
}

type TemplateSyncAttemptResult = {
    ok: boolean
    unavailable: boolean
    message?: string
}

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
    const [createForAllNumbers, setCreateForAllNumbers] = useState(false)
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
    const {
        templates,
        loading: templatesLoading,
        source: templatesSource,
    } = useScopedApprovedTemplates(selectedPhoneNumberId)
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
    const normalizedTestPhones = normalizeCampaignTestPhoneList(testContactPhones)
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
        readinessBlockingReason === "NUMBER_NOT_FOUND" ||
        readinessBlockingReason === "WABA_MISMATCH"
    const readinessBlockingMessage =
        isTemplateReadinessHardBlocked
            ? mapReadinessReasonToArabic(
                readinessBlockingReason,
                sendReadiness?.recommendedAction as string | undefined
            )
            : null
    const optionalExtendedApisUnavailable =
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
        createForAllNumbers
            ? !!selectedTemplate && !isSyncingTemplates
            : apisUnavailableBypass ||
              (!templateCriticalApisUnavailable &&
                  !!selectedTemplate &&
                  !isTemplateValidationLoading &&
                  !!templateValidation?.ok)

    const syncTemplatesForPhoneNumber = useCallback(async (phoneNumberId: string): Promise<TemplateSyncAttemptResult> => {
        const fallbackResult = await runConvexActionSafe(
            syncTemplatesForNumber as any,
            { phoneNumberId },
            { actionName: "templates:syncFromMeta" }
        )
        if (!fallbackResult.ok) {
            return {
                ok: false,
                unavailable: fallbackResult.unavailable,
                message: fallbackResult.unavailable
                    ? "دالة مزامنة القوالب غير متاحة على نسخة Convex الحالية. قم بنشر backend ثم أعد المحاولة."
                    : mapTemplateSyncErrorToArabic(fallbackResult.message || "تعذر مزامنة القوالب."),
            }
        }
        markScopedTemplatesSynced(phoneNumberId)
        return { ok: true, unavailable: false }
    }, [syncTemplatesForNumber])

    const triggerScopedTemplateSync = useCallback(async (force: boolean = false) => {
        if (!selectedPhoneNumberId) return
        if (isTemplateReadinessHardBlocked) {
            setTemplateSyncError(null)
            return
        }
        if (isTemplateAuthFailed) {
            setTemplateSyncError(null)
            return
        }
        if (!force && !shouldSyncScopedTemplates(selectedPhoneNumberId)) return
        setIsSyncingTemplates(true)
        setTemplateSyncError(null)
        setTemplateSyncWarning(null)
        try {
            const syncResult = await syncTemplatesForPhoneNumber(selectedPhoneNumberId)
            if (!syncResult.ok) {
                setTemplateSyncError(syncResult.message ?? "تعذر مزامنة القوالب.")
                return
            }
            if (enableExtendedCampaignApis) {
                setTemplateSyncWarning("تمت مزامنة القوالب عبر المسار المتوافق مع هذه النسخة.")
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            setTemplateSyncError(mapTemplateSyncErrorToArabic(message || "تعذر مزامنة القوالب."))
        } finally {
            setIsSyncingTemplates(false)
        }
    }, [
        enableExtendedCampaignApis,
        isTemplateAuthFailed,
        selectedPhoneNumberId,
        isTemplateReadinessHardBlocked,
        readinessBlockingMessage,
        syncTemplatesForPhoneNumber,
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
        if (!selectedTemplate) return
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
        if (!selectedPhoneNumberId || !selectedTemplate?.name) return
        if (!createForAllNumbers && (isTemplateReadinessHardBlocked || isTemplateAuthFailed || !!templateSyncError)) {
            toast.error("لا يمكن إنشاء الحملة قبل إصلاح حالة الرقم/القوالب لهذا الرقم.")
            return
        }
        if (!createForAllNumbers && !apisUnavailableBypass && (isTemplateValidationLoading || !templateValidation?.ok)) {
            toast.error("التحقق من القالب لم يكتمل أو فشل. أصلح المشكلة ثم أعد المحاولة.")
            return
        }

        setIsSubmitting(true)

        try {
            const numberById = new Map(numbers.map((number) => [number.businessNumberId, number]))
            const rawTargetIds = createForAllNumbers
                ? numbers.map((number) => number.businessNumberId)
                : [selectedPhoneNumberId]
            const targetPhoneNumberIds = Array.from(
                new Set(rawTargetIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))
            )

            if (targetPhoneNumberIds.length === 0) {
                toast.error("لا يوجد رقم إرسال صالح لإنشاء الحملة.")
                return
            }

            const requestedTemplateLanguage = selectedTemplate.language ?? undefined
            const requestedTemplateLanguageNormalized = normalizeTemplateLanguageCode(requestedTemplateLanguage)
            const scheduledAtMs = scheduledAt ? new Date(scheduledAt).getTime() : Date.now()
            const targetTagsValue = targetAudience === "tags" ? selectedTags : undefined
            const targetContactIdsValue =
                targetAudience === "selected" && selectedContactIds.length > 0 ? selectedContactIds : undefined
            const includeTestFields = isTestCampaign && !optionalExtendedApisUnavailable
            const downgradeTestMode = isTestCampaign && !includeTestFields
            const results: CampaignCreateResultRow[] = []
            const syncWarnings: string[] = []

            for (const phoneNumberId of targetPhoneNumberIds) {
                if (!numberById.has(phoneNumberId)) {
                    results.push({
                        phoneNumberId,
                        status: "skipped",
                        reason: "NUMBER_NOT_FOUND",
                        downgradedTestMode: downgradeTestMode,
                    })
                    continue
                }

                try {
                    const readiness = await convex.query((api as any).campaigns.getSendReadiness, { phoneNumberId })
                    const blockingReason = String(readiness?.blockingReason ?? "")
                    const tokenStatus = String(readiness?.tokenStatus ?? "")
                    if (blockingReason === "NUMBER_NOT_FOUND" || blockingReason === "MISSING_NUMBER") {
                        results.push({
                            phoneNumberId,
                            status: "skipped",
                            reason: "NUMBER_NOT_FOUND",
                            downgradedTestMode: downgradeTestMode,
                        })
                        continue
                    }
                    if (blockingReason === "TOKEN_MISSING" || tokenStatus === "missing") {
                        results.push({
                            phoneNumberId,
                            status: "skipped",
                            reason: "TOKEN_MISSING",
                            downgradedTestMode: downgradeTestMode,
                        })
                        continue
                    }
                    if (blockingReason === "AUTH_FAILED" || blockingReason === "AUTH_BLOCKED" || tokenStatus === "auth_failed") {
                        results.push({
                            phoneNumberId,
                            status: "skipped",
                            reason: "AUTH_FAILED",
                            downgradedTestMode: downgradeTestMode,
                        })
                        continue
                    }
                    if (blockingReason === "WABA_MISMATCH") {
                        results.push({
                            phoneNumberId,
                            status: "skipped",
                            reason: "WABA_MISMATCH",
                            downgradedTestMode: downgradeTestMode,
                        })
                        continue
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    if (!isMissingFunctionError(message)) {
                        console.warn("[CampaignCreate] getSendReadiness failed", { phoneNumberId, message })
                    }
                }

                // Always attempt a fresh per-number template sync before resolving.
                // If sync fails, keep going with cached templates to avoid all-or-nothing failures.
                try {
                    const syncResult = await syncTemplatesForPhoneNumber(phoneNumberId)
                    if (!syncResult.ok && syncResult.message) {
                        syncWarnings.push(`${phoneNumberId}: ${syncResult.message}`)
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    syncWarnings.push(`${phoneNumberId}: ${mapTemplateSyncErrorToArabic(message)}`)
                }

                let resolvedTemplate: ScopedTemplateCandidate | null = null
                try {
                    const validation = await convex.query((api as any).campaigns.validateTemplateSelection, {
                        templateName: selectedTemplate.name,
                        phoneNumberId,
                        requestedLanguage: requestedTemplateLanguage,
                    })
                    if (validation?.ok && validation?.templateId) {
                        resolvedTemplate = {
                            _id: String(validation.templateId),
                            name: String(validation.name ?? selectedTemplate.name),
                            language: validation.language ?? requestedTemplateLanguage ?? undefined,
                            phoneNumberId,
                            status: "APPROVED",
                        }
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    if (!isMissingFunctionError(message)) {
                        console.warn("[CampaignCreate] validateTemplateSelection failed", { phoneNumberId, message })
                    }
                }

                if (!resolvedTemplate) {
                    try {
                        const byName = await convex.query((api as any).templates.getByName, {
                            name: selectedTemplate.name,
                            phoneNumberId,
                        })
                        if (byName && String(byName.status ?? "APPROVED").toUpperCase() === "APPROVED") {
                            const byNameLanguage = normalizeTemplateLanguageCode(byName.language)
                            if (
                                !requestedTemplateLanguageNormalized ||
                                byNameLanguage === requestedTemplateLanguageNormalized
                            ) {
                                resolvedTemplate = {
                                    _id: String(byName._id),
                                    name: String(byName.name ?? selectedTemplate.name),
                                    language: byName.language ?? requestedTemplateLanguage ?? undefined,
                                    phoneNumberId,
                                    status: "APPROVED",
                                    lastSyncedAt: byName.lastSyncedAt,
                                    _creationTime: byName._creationTime,
                                }
                            }
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        console.warn("[CampaignCreate] templates.getByName failed", { phoneNumberId, message })
                    }
                }

                if (!resolvedTemplate) {
                    try {
                        const rows = (await convex.query((api as any).templates.list, { phoneNumberId })) as ScopedTemplateCandidate[]
                        const sameNameApproved = rows.filter((row) => {
                            return (
                                row?.name === selectedTemplate.name &&
                                String(row?.status ?? "").toUpperCase() === "APPROVED"
                            )
                        })
                        if (sameNameApproved.length > 0) {
                            const exactLanguage = requestedTemplateLanguageNormalized
                                ? pickLatestTemplate(
                                      sameNameApproved.filter(
                                          (row) => normalizeTemplateLanguageCode(row.language) === requestedTemplateLanguageNormalized
                                      )
                                  )
                                : null
                            const familyLanguage =
                                !exactLanguage && requestedTemplateLanguageNormalized
                                    ? pickLatestTemplate(
                                          sameNameApproved.filter((row) => {
                                              return (
                                                  languageFamily(row.language) ===
                                                  languageFamily(requestedTemplateLanguageNormalized)
                                              )
                                          })
                                      )
                                    : null
                            resolvedTemplate = exactLanguage ?? familyLanguage ?? pickLatestTemplate(sameNameApproved)
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        console.warn("[CampaignCreate] templates.list failed", { phoneNumberId, message })
                    }
                }

                if (!resolvedTemplate) {
                    results.push({
                        phoneNumberId,
                        status: "skipped",
                        reason: "TEMPLATE_NOT_AVAILABLE_FOR_NUMBER",
                        downgradedTestMode: downgradeTestMode,
                    })
                    continue
                }

                const payload: Record<string, unknown> = {
                    name,
                    templateId: resolvedTemplate._id,
                    templateName: selectedTemplate.name,
                    templateLanguage: resolvedTemplate.language ?? requestedTemplateLanguage ?? undefined,
                    phoneNumberId,
                    targetTags: targetTagsValue,
                    targetContactIds: targetContactIdsValue,
                    scheduledAt: scheduledAtMs,
                    recurrenceCronSpec: recurrenceCronSpec || undefined,
                    sendingConfig,
                }
                if (includeTestFields) {
                    payload.isTestCampaign = true
                    payload.testBypassRecentContact = testBypassRecentContact
                    if (normalizedTestPhones.length > 0) payload.testContactPhones = normalizedTestPhones
                }

                try {
                    const createdCampaignId = await createCampaign(payload)
                    results.push({
                        phoneNumberId,
                        status: "created",
                        campaignId: String(createdCampaignId),
                        downgradedTestMode: downgradeTestMode,
                    })
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    const isValidationError =
                        message.includes("Template") ||
                        message.includes("validation") ||
                        message.includes("not approved")
                    results.push({
                        phoneNumberId,
                        status: "failed",
                        reason: isValidationError ? "CREATE_VALIDATION_ERROR" : "CREATE_FAILED",
                        downgradedTestMode: downgradeTestMode,
                    })
                }
            }

            if (process.env.NODE_ENV !== "production") {
                console.debug("[CampaignCreate] per-number results", results)
            }

            const createdCount = results.filter((row) => row.status === "created").length
            const skippedCount = results.filter((row) => row.status === "skipped").length
            const failedCount = results.filter((row) => row.status === "failed").length
            const downgradedCount = results.filter((row) => row.status === "created" && row.downgradedTestMode).length
            const totalCount = results.length

            if (createdCount > 0) {
                toast.success(
                    `تم إنشاء ${createdCount} حملة من أصل ${totalCount}.${skippedCount > 0 ? ` تم التخطي: ${skippedCount}.` : ""}${failedCount > 0 ? ` فشل: ${failedCount}.` : ""}`
                )
            } else {
                toast.error(`تعذر إنشاء أي حملة. تمت معالجة ${totalCount} رقم بدون نجاح.`)
            }

            if (downgradedCount > 0) {
                toast.warning(
                    `تم إنشاء الحملات كحملات عادية بدون إعدادات الاختبار المتقدمة لعدد ${downgradedCount} رقم بسبب عدم توفر الواجهات الاختيارية.`
                )
            }

            if (syncWarnings.length > 0) {
                toast.warning(
                    `تمت محاولة مزامنة القوالب لكل رقم، لكن فشلت المزامنة لبعض الأرقام (${syncWarnings.length}). سيتم استخدام القوالب المحلية المتاحة عند الإمكان.`
                )
            }

            const skippedReasons = results
                .filter((row) => row.status !== "created" && row.reason)
                .reduce<Record<string, number>>((acc, row) => {
                    const reason = row.reason as string
                    acc[reason] = (acc[reason] ?? 0) + 1
                    return acc
                }, {})
            const skippedReasonItems = Object.entries(skippedReasons)
                .map(([reason, count]) => `${mapResultReasonToArabic(reason)} (${count})`)
                .join("، ")
            if (skippedReasonItems) {
                toast.warning(`تفاصيل الأرقام غير المكتملة: ${skippedReasonItems}`)
            }

            if (createdCount > 0 && skippedCount === 0 && failedCount === 0) {
                router.push("/campaigns?success=true")
            }
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
        const normalized = normalizeCampaignTestPhone(testPhoneInput)
        if (!normalized) return
        if (normalizedTestPhones.includes(normalized)) {
            setTestPhoneInput("")
            return
        }
        setTestContactPhones((prev) => normalizeCampaignTestPhoneList([...prev, normalized]))
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
                                    <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="font-medium">إنشاء حملة لكل أرقام الإرسال</p>
                                                <p className="text-xs text-muted-foreground">
                                                    سيتم إنشاء حملة منفصلة لكل رقم إرسال مهيأ في مساحة العمل.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={createForAllNumbers}
                                                onCheckedChange={setCreateForAllNumbers}
                                                disabled={numbers.length === 0}
                                            />
                                        </div>
                                        {createForAllNumbers && (
                                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                                وضع متعدد الأرقام مفعل: سيتم إنشاء حملة لكل رقم صالح مع تخطي الأرقام غير الجاهزة.
                                            </p>
                                        )}
                                    </div>
                                    
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
                                                        onCheckedChange={(checked) => {
                                                            setIsTestCampaign(checked)
                                                            if (checked) {
                                                                setTestBypassRecentContact(true)
                                                                setTestContactPhones((prev) =>
                                                                    normalizeCampaignTestPhoneList(
                                                                        prev.length > 0 ? prev : [DEFAULT_TEST_PHONE]
                                                                    )
                                                                )
                                                            }
                                                        }}
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
                                                                    if (checked && normalizedTestPhones.length === 0) {
                                                                        setTestContactPhones([DEFAULT_TEST_PHONE])
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
                                        {!selectedPhoneNumberId ? (
                                            <div className="rounded-lg border-2 border-dashed border-amber-300/70 bg-amber-50/80 dark:bg-amber-900/20 p-6 text-center">
                                                <p className="text-amber-900 dark:text-amber-200 font-medium">اختر رقم إرسال أولاً</p>
                                                <p className="text-sm text-amber-800/90 dark:text-amber-300/90 mt-1">
                                                    يجب تحديد رقم الإرسال في الخطوة الأولى لعرض القوالب المعتمدة لهذا الرقم.
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    className="mt-4"
                                                    onClick={() => setCurrentStep(0)}
                                                >
                                                    العودة لتحديد الرقم
                                                </Button>
                                            </div>
                                        ) : (
                                        <>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-base">اختر القالب</Label>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="font-normal">{templates.length} قوالب متاحة</Badge>
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
                                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium leading-relaxed text-destructive">
                                                {readinessBlockingMessage}
                                                <div className="mt-2">
                                                    <Button size="sm" variant="ghost" onClick={() => router.push("/integrations")}>
                                                        فتح الإعدادات والربط
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {isTemplateAuthFailed && (
                                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium leading-relaxed text-destructive">
                                                لا يمكن مزامنة أو إرسال القوالب لهذا الرقم حتى إعادة ربط Access Token من صفحة الإعدادات والربط.
                                                {templateAuthFailedMessage ? ` (${templateAuthFailedMessage})` : ""}
                                            </div>
                                        )}
                                        {optionalExtendedApisUnavailable && (
                                            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                                                بعض واجهات التحقق غير متاحة في نسخة Convex الحالية. يمكنك المتابعة باختيار قالب ثم النقر &quot;التالي&quot; — قد تفشل الحملة إذا كان القالب غير صالح. لتفعيل التحقق الكامل، انشر دوال الحملات/القوالب.
                                            </div>
                                        )}
                                        {templatesSource === "listFallback" && (
                                            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                                                تستخدم هذه الصفحة مساراً توافقياً لعرض القوالب المعتمدة لأن دالة `listScopedApproved` غير متاحة في نسخة Convex الحالية.
                                            </div>
                                        )}

                                        {isSyncingTemplates && (
                                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-relaxed text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
                                                جارٍ مزامنة القوالب لهذا الرقم...
                                            </div>
                                        )}
                                        {templateSyncError && (
                                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium leading-relaxed text-destructive">
                                                {templateSyncError}
                                            </div>
                                        )}
                                        {templateSyncWarning && (
                                            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                                                {templateSyncWarning}
                                            </div>
                                        )}

                                        <ScrollArea className="h-[400px] pr-4">
                                            <div className="space-y-3">
                                                {!selectedPhoneNumberId ? (
                                                    <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                                                        اختر رقم إرسال أولاً لعرض القوالب المرتبطة به.
                                                    </div>
                                                ) : templatesLoading ? (
                                                    [1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)
                                                ) : templates.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                                                        <p className="font-medium text-foreground">
                                                            لا توجد قوالب معتمدة لهذا الرقم.
                                                        </p>
                                                        <p className="text-xs">
                                                            استخدم &quot;مزامنة القوالب&quot; لجلبها من Meta، أو أنشئ واعتمد القوالب في Meta Business Suite أولاً.
                                                        </p>
                                                        <p className="text-xs">
                                                            تتم المزامنة تلقائياً كل {syncTtlMinutes} دقائق لكل رقم. يمكنك المزامنة الآن أو إدارة القوالب من صفحة القوالب.
                                                        </p>
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
                                                                <Badge variant="outline" className="text-[10px]">الرقم الحالي</Badge>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </ScrollArea>
                                        {selectedTemplate && templateValidation?.ok === true && (
                                            <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
                                                <span className="font-medium flex items-center gap-2">
                                                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                    معتمد لهذا الرقم
                                                </span>
                                            </div>
                                        )}
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
                                        </>
                                        )}
                                    </div>

                                    <Card className="mx-auto w-full max-w-[320px] overflow-hidden border shadow-sm">
                                        <CardContent className="space-y-3 bg-muted/30 p-4">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <LayoutTemplate className="h-4 w-4" />
                                                معاينة القالب
                                            </div>
                                            <TemplatePreview template={selectedTemplate} />
                                        </CardContent>
                                    </Card>
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
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        {createForAllNumbers
                                                            ? `سيتم الإنشاء لكل الأرقام (${numbers.length})`
                                                            : "سيتم الإنشاء لهذا الرقم فقط"}
                                                    </p>
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
                                                    <Badge variant="outline">الرقم الحالي</Badge>
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
                                                    (!createForAllNumbers && !!templateSyncError) ||
                                                    (!createForAllNumbers && isTemplateReadinessHardBlocked) ||
                                                    (!createForAllNumbers && isTemplateAuthFailed)
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
                                            (!createForAllNumbers && isTemplateReadinessHardBlocked) ||
                                            (!createForAllNumbers && isTemplateAuthFailed) ||
                                            (!createForAllNumbers && !!templateSyncError)
                                        }
                                    >
                                        {isSubmitting
                                            ? "جاري الإنشاء..."
                                            : createForAllNumbers
                                              ? "إنشاء الحملات"
                                              : scheduledAt
                                                ? "تأكيد الجدولة"
                                                : "إرسال الحملة"}
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
