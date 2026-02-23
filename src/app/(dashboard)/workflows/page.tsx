"use client"

import { useState, useEffect, useCallback } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/mock/convex-api"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { markScopedTemplatesSynced, shouldSyncScopedTemplates } from "@/lib/templateSyncCache"
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery"
import { runConvexActionSafe } from "@/lib/convexActionSafe"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Zap,
    Plus,
    MessageSquare,
    Tag,
    Bell,
    Send,
    Clock,
    ArrowRight,
    MoreVertical,
    Play,
    Pause,
    Trash,
    Edit,
    ChevronDown,
    Users,
    UserPlus
} from "lucide-react"

// Mock Workflows
const MOCK_WORKFLOWS = [
    {
        id: "1",
        name: "رد ترحيبي",
        trigger: "رسالة جديدة",
        triggerDetails: "كلمة: مرحبا",
        action: "إرسال رد",
        actionDetails: "قالب: رسالة ترحيب",
        enabled: true,
        runs: 245
    },
    {
        id: "2",
        name: "تصنيف VIP",
        trigger: "رسالة جديدة",
        triggerDetails: "من: عملاء مميزين",
        action: "إضافة وسم",
        actionDetails: "وسم: VIP",
        enabled: true,
        runs: 89
    },
    {
        id: "3",
        name: "تنبيه الدعم",
        trigger: "كلمة مفتاحية",
        triggerDetails: "كلمة: شكوى",
        action: "إشعار",
        actionDetails: "تنبيه فريق الدعم",
        enabled: false,
        runs: 12
    },
]

const TRIGGERS = [
    { value: "new_message", label: "رسالة جديدة", icon: MessageSquare },
    { value: "contact_created", label: "عميل جديد", icon: Users },
    { value: "keyword", label: "كلمة مفتاحية", icon: Tag },
    { value: "tag_added", label: "إضافة وسم", icon: Tag },
]

const ACTIONS = [
    { value: "send_template", label: "إرسال قالب", icon: Send },
    { value: "add_tag", label: "إضافة وسم", icon: Tag },
    { value: "remove_tag", label: "إزالة وسم", icon: Trash },
    { value: "assign_user", label: "تعيين موظف", icon: UserPlus },
    { value: "notify", label: "إرسال تنبيه", icon: Bell },
]

export default function WorkflowsPage() {
    const enableExtendedCampaignApis = process.env.NEXT_PUBLIC_EXTENDED_CAMPAIGN_APIS === "1"
    const { activePhoneNumberId } = useWorkspace()
    const effectivePhoneNumberId =
        !activePhoneNumberId || activePhoneNumberId === "__all__" ? undefined : activePhoneNumberId
    const workflows = (useQuery(api.workflows.list, effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : {}) as any[] | undefined) || []
    const legacyTemplates = useQuery(
        api.templates.list,
        effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : "skip"
    ) as any[] | undefined
    const scopedTemplatesQuery = useOptionalConvexQuery<any[]>(
        (api as any).templates.listScopedApproved,
        enableExtendedCampaignApis && effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : "skip",
        enableExtendedCampaignApis
    )
    const templatesSource = (enableExtendedCampaignApis && scopedTemplatesQuery.data
        ? scopedTemplatesQuery.data
        : legacyTemplates) as any[] | undefined
    const templates = (templatesSource || []).filter((template: any) => template.status === "APPROVED")
    const templateHealthQuery = useOptionalConvexQuery<any>(
        (api as any).templates.getScopedTemplateHealth,
        enableExtendedCampaignApis && effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : "skip",
        enableExtendedCampaignApis
    )
    const templateHealth = templateHealthQuery.data
    const sendReadinessQuery = useOptionalConvexQuery<any>(
        (api as any).campaigns.getSendReadiness,
        enableExtendedCampaignApis && effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : "skip",
        enableExtendedCampaignApis
    )
    const sendReadiness = sendReadinessQuery.data
    const users = (useQuery(api.users.list) as any[] | undefined) || [] // Add this query
    const createWorkflow = useMutation(api.workflows.create)
    const updateWorkflow = useMutation(api.workflows.update)
    const toggleWorkflowMutation = useMutation(api.workflows.toggle)
    const deleteWorkflow = useMutation(api.workflows.remove)
    const syncTemplatesForNumber = useAction(api.templates.syncFromMeta)

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [name, setName] = useState("")
    const [selectedTrigger, setSelectedTrigger] = useState("")
    const [triggerConfig, setTriggerConfig] = useState<any>({})
    const [selectedAction, setSelectedAction] = useState("")
    const [actionConfig, setActionConfig] = useState<any>({})
    const [isSyncingTemplates, setIsSyncingTemplates] = useState(false)
    const [templateSyncError, setTemplateSyncError] = useState<string | null>(null)
    const [templateSyncWarning, setTemplateSyncWarning] = useState<string | null>(null)
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
    const selectedTemplateDoc = (templates || []).find((t: any) => t._id === actionConfig.templateId)
        || (templates || []).find((t: any) => t.name === actionConfig.template)
    const isTemplateActionInvalid =
        selectedAction === "send_template" &&
        (!effectivePhoneNumberId || !actionConfig.templateId || !selectedTemplateDoc || isTemplateAuthFailed || isTemplateReadinessHardBlocked || optionalExtendedApisUnavailable)

    const triggerScopedTemplateSync = useCallback(async (force: boolean = false) => {
        if (!effectivePhoneNumberId) return
        if (isTemplateReadinessHardBlocked) {
            setTemplateSyncError(readinessBlockingMessage || "Cannot sync templates for this number until number auth/token setup is fixed.")
            return
        }
        if (isTemplateAuthFailed) {
            setTemplateSyncError("لا يمكن مزامنة القوالب لهذا الرقم حتى إعادة ربط Access Token من صفحة الإعدادات والربط.")
            return
        }
        if (!force && !shouldSyncScopedTemplates(effectivePhoneNumberId)) return
        setIsSyncingTemplates(true)
        setTemplateSyncError(null)
        setTemplateSyncWarning(null)
        try {
            const fallbackResult = await runConvexActionSafe(syncTemplatesForNumber as any, {
                phoneNumberId: effectivePhoneNumberId,
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
            markScopedTemplatesSynced(effectivePhoneNumberId)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            setTemplateSyncError(message || "تعذر مزامنة القوالب.")
        } finally {
            setIsSyncingTemplates(false)
        }
    }, [
        effectivePhoneNumberId,
        enableExtendedCampaignApis,
        isTemplateAuthFailed,
        isTemplateReadinessHardBlocked,
        readinessBlockingMessage,
        syncTemplatesForNumber,
    ])

    useEffect(() => {
        if (!isCreateOpen || !effectivePhoneNumberId) return
        void triggerScopedTemplateSync(false)
    }, [isCreateOpen, effectivePhoneNumberId, triggerScopedTemplateSync])

    useEffect(() => {
        if (selectedAction !== "send_template") return
        if (!actionConfig.templateId && actionConfig.template && templates.length > 0) {
            const matched = templates.find((template: any) => template.name === actionConfig.template)
            if (matched) {
                setActionConfig((prev: any) => ({
                    ...prev,
                    templateId: matched._id,
                    template: matched.name,
                    language: matched.language,
                }))
            }
        }
    }, [actionConfig.template, actionConfig.templateId, selectedAction, templates])

    const toggleWorkflow = async (id: string) => {
        await toggleWorkflowMutation({ id: id as any })
    }

    const handleEdit = (workflow: any) => {
        setEditingId(workflow._id)
        setName(workflow.name)
        setSelectedTrigger(workflow.trigger)
        setTriggerConfig(workflow.triggerConfig || {})
        setSelectedAction(workflow.action)
        const nextActionConfig = { ...(workflow.actionConfig || {}) }
        if (workflow.action === "send_template" && !nextActionConfig.templateId && nextActionConfig.template) {
            const matched = templates.find((template: any) => template.name === nextActionConfig.template)
            if (matched) {
                nextActionConfig.templateId = matched._id
                nextActionConfig.language = matched.language
            }
        }
        setActionConfig(nextActionConfig)
        setTemplateSyncError(null)
        setIsCreateOpen(true)
    }

    const handleSave = async () => {
        try {
            if (selectedAction === "send_template" && isTemplateActionInvalid) {
                console.error("[INVALID_TEMPLATE_PRECHECK][Workflows][UI] Cannot save workflow with invalid template selection", {
                    templateName: actionConfig.template ?? null,
                    requestedLanguage: null,
                    approvedLanguage: selectedTemplateDoc?.language ?? null,
                    resolvedPhoneNumberId: effectivePhoneNumberId ?? null,
                    reasonCode: !actionConfig.templateId ? "TEMPLATE_MISSING" : "TEMPLATE_INVALID",
                })
                return
            }
            if (selectedAction === "send_template" && templateSyncError) {
                return
            }

            if (editingId) {
                await updateWorkflow({
                    id: editingId as any,
                    name,
                    trigger: selectedTrigger,
                    triggerConfig,
                    action: selectedAction,
                    actionConfig,
                    phoneNumberId: effectivePhoneNumberId,
                })
            } else {
                await createWorkflow({
                    name: name || "قاعدة جديدة",
                    trigger: selectedTrigger,
                    triggerConfig,
                    action: selectedAction,
                    actionConfig,
                    phoneNumberId: effectivePhoneNumberId,
                })
            }
            setIsCreateOpen(false)
            resetForm()
        } catch (error) {
            console.error("Failed to save workflow", error)
        }
    }

    const resetForm = () => {
        setEditingId(null)
        setName("")
        setSelectedTrigger("")
        setTriggerConfig({})
        setSelectedAction("")
        setActionConfig({})
        setTemplateSyncError(null)
        setTemplateSyncWarning(null)
    }

    return (
        <div className="space-y-6 m-16">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">الأتمتة</h1>
                    <p className="text-muted-foreground text-sm mt-1">إنشاء قواعد تلقائية للردود والإجراءات</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            قاعدة جديدة
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "تعديل القاعدة" : "إنشاء قاعدة أتمتة"}</DialogTitle>
                            <DialogDescription>حدد المشغّل والإجراء لإنشاء قاعدة أتمتة تعمل على هذا الرقم.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            {/* Workflow Name */}
                            <div className="space-y-2">
                                <Label>اسم القاعدة</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: رد ترحيبي للعملاء الجدد" />
                            </div>

                            {/* Trigger */}
                            <div className="space-y-3">
                                <Label className="text-base font-semibold flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-warning/20 text-warning flex items-center justify-center">
                                        <Zap className="w-3 h-3" />
                                    </div>
                                    عندما يحدث (المشغّل)
                                </Label>
                                <div className="grid grid-cols-3 gap-3">
                                    {TRIGGERS.map(trigger => {
                                        const Icon = trigger.icon
                                        return (
                                            <div
                                                key={trigger.value}
                                                className={`border rounded-xl p-4 cursor-pointer transition-all ${selectedTrigger === trigger.value ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                                                onClick={() => setSelectedTrigger(trigger.value)}
                                            >
                                                <Icon className="h-5 w-5 mb-2 text-primary" />
                                                <p className="font-medium text-sm">{trigger.label}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                                {selectedTrigger === "keyword" && (
                                    <div className="space-y-2 p-4 bg-muted/50 rounded-xl">
                                        <Label>الكلمة المفتاحية</Label>
                                        <Input
                                            placeholder="أدخل الكلمة..."
                                            value={triggerConfig.keyword || ""}
                                            onChange={e => setTriggerConfig({ ...triggerConfig, keyword: e.target.value })}
                                        />
                                    </div>
                                )}
                                {selectedTrigger === "tag_added" && (
                                    <div className="space-y-2 p-4 bg-muted/50 rounded-xl">
                                        <Label>عند إضافة وسم (اختياري)</Label>
                                        <Input
                                            placeholder="اتركه فارغاً لأي وسم، أو حدد وسماً محدداً"
                                            value={triggerConfig.tag || ""}
                                            onChange={e => setTriggerConfig({ ...triggerConfig, tag: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Arrow */}
                            <div className="flex justify-center">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </div>

                            {/* Action */}
                            <div className="space-y-3">
                                <Label className="text-base font-semibold flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center">
                                        <Play className="w-3 h-3" />
                                    </div>
                                    نفّذ (الإجراء)
                                </Label>
                                <div className="grid grid-cols-3 gap-3">
                                    {ACTIONS.map(action => {
                                        const Icon = action.icon
                                        return (
                                            <div
                                                key={action.value}
                                                className={`border rounded-xl p-4 cursor-pointer transition-all ${selectedAction === action.value ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                                                onClick={() => setSelectedAction(action.value)}
                                            >
                                                <Icon className="h-5 w-5 mb-2 text-success" />
                                                <p className="font-medium text-sm">{action.label}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                                {selectedAction === "send_template" && (
                                    <div className="space-y-2 p-4 bg-muted/50 rounded-xl">
                                        <div className="flex items-center justify-between">
                                            <Label>اختر القالب</Label>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={!effectivePhoneNumberId || isSyncingTemplates || isTemplateAuthFailed || isTemplateReadinessHardBlocked || optionalExtendedApisUnavailable}
                                                onClick={() => void triggerScopedTemplateSync(true)}
                                            >
                                                {isSyncingTemplates ? "جارٍ المزامنة..." : "مزامنة"}
                                            </Button>
                                        </div>
                                        {isTemplateReadinessHardBlocked && (
                                            <div className="space-y-2 text-xs text-destructive">
                                                <div>{readinessBlockingMessage}</div>
                                                <a href="/integrations" className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] text-foreground hover:bg-muted">
                                                    فتح الإعدادات والربط
                                                </a>
                                            </div>
                                        )}
                                        {isTemplateAuthFailed && (
                                            <div className="space-y-2 text-xs text-destructive">
                                                <div>
                                                    لا يمكن مزامنة أو إرسال القوالب لهذا الرقم حتى إعادة ربط Access Token.
                                                    {templateAuthFailedMessage ? ` (${templateAuthFailedMessage})` : ""}
                                                </div>
                                                <a href="/integrations" className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] text-foreground hover:bg-muted">
                                                    فتح الإعدادات والربط
                                                </a>
                                            </div>
                                        )}
                                        <Select
                                            value={actionConfig.templateId || ""}
                                            onValueChange={(v) => {
                                                const template = templates.find((row: any) => row._id === v)
                                                setActionConfig({
                                                    ...actionConfig,
                                                    templateId: v,
                                                    template: template?.name,
                                                    language: template?.language,
                                                })
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر قالب..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templates
                                                    .map(t => (
                                                        <SelectItem key={t._id} value={t._id}>
                                                            {t.name} ({t.language})
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        {!effectivePhoneNumberId && (
                                            <div className="text-xs text-destructive">اختر رقمًا محددًا بدلاً من &quot;كل الأرقام&quot;.</div>
                                        )}
                                        {templateSyncError && (
                                            <div className="space-y-2 text-xs text-destructive">
                                                <div>تعذر مزامنة القوالب: {templateSyncError}</div>
                                                <a href="/templates" className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] text-foreground hover:bg-muted">
                                                    افتح صفحة القوالب
                                                </a>
                                            </div>
                                        )}
                                        {templateSyncWarning && (
                                            <div className="text-xs text-amber-700 dark:text-amber-300">
                                                {templateSyncWarning}
                                            </div>
                                        )}
                                        {optionalExtendedApisUnavailable && (
                                            <div className="text-xs text-amber-700 dark:text-amber-300">
                                                بعض واجهات القوالب غير متاحة في نسخة Convex الحالية. سيتم استخدام القوالب المتاحة فقط.
                                            </div>
                                        )}
                                        {templates.length === 0 && effectivePhoneNumberId && !isSyncingTemplates && !templateSyncError && (
                                            <div className="space-y-2 text-xs text-muted-foreground">
                                                <div>لا توجد قوالب مرتبطة بهذا الرقم بعد المزامنة.</div>
                                                <a href="/templates" className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] text-foreground hover:bg-muted">
                                                    إدارة القوالب
                                                </a>
                                            </div>
                                        )}
                                        {selectedTemplateDoc && (
                                            <div className="text-xs text-muted-foreground">
                                                اللغة المعتمدة: <span className="font-medium">{selectedTemplateDoc.language}</span>
                                            </div>
                                        )}
                                        {!selectedTemplateDoc && actionConfig.templateId && (
                                            <div className="space-y-2 text-xs text-destructive">
                                                <div>القالب غير متاح لهذا الرقم. يرجى مزامنة القوالب أو اختيار قالب آخر.</div>
                                                <a href="/templates" className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] text-foreground hover:bg-muted">
                                                    مزامنة القوالب
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {selectedAction === "add_tag" && (
                                    <div className="space-y-2 p-4 bg-muted/50 rounded-xl">
                                        <Label>اسم الوسم</Label>
                                        <Input
                                            placeholder="مثال: VIP"
                                            value={actionConfig.tag || ""}
                                            onChange={e => setActionConfig({ ...actionConfig, tag: e.target.value })}
                                        />
                                    </div>
                                )}
                                {selectedAction === "remove_tag" && (
                                    <div className="space-y-2 p-4 bg-muted/50 rounded-xl">
                                        <Label>اسم الوسم</Label>
                                        <Input
                                            placeholder="مثال: VIP"
                                            value={actionConfig.tag || ""}
                                            onChange={e => setActionConfig({ ...actionConfig, tag: e.target.value })}
                                        />
                                    </div>
                                )}
                                {selectedAction === "assign_user" && (
                                    <div className="space-y-2 p-4 bg-muted/50 rounded-xl">
                                        <Label>اختر الموظف</Label>
                                        <Select
                                            value={actionConfig.userId}
                                            onValueChange={(v) => setActionConfig({ ...actionConfig, userId: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر موظف..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {users.map((u: any) => (
                                                    <SelectItem key={u._id} value={u._id}>
                                                        {u.name || u.email || "مستخدم غير معروف"}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {selectedAction === "notify" && (
                                    <div className="space-y-2 p-4 bg-muted/50 rounded-xl">
                                        <Label>رسالة التنبيه</Label>
                                        <Input
                                            placeholder="مثال: تم إضافة وسم VIP لعميل"
                                            value={actionConfig.message || ""}
                                            onChange={e => setActionConfig({ ...actionConfig, message: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>إلغاء</Button>
                            <Button
                                onClick={handleSave}
                                disabled={!selectedTrigger || !selectedAction || isTemplateActionInvalid || isSyncingTemplates || !!templateSyncError}
                            >
                                حفظ القاعدة
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="flex items-center gap-4 pt-0">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Zap className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{workflows.length}</p>
                            <p className="text-sm text-muted-foreground">قواعد الأتمتة</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 pt-0">
                        <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                            <Play className="h-6 w-6 text-success" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{workflows.filter(w => w.enabled).length}</p>
                            <p className="text-sm text-muted-foreground">قواعد نشطة</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 pt-0">
                        <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                            <Clock className="h-6 w-6 text-info" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{workflows.reduce((sum, w) => sum + (w.stats?.runs || 0), 0)}</p>
                            <p className="text-sm text-muted-foreground">إجمالي التنفيذات</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>الحالة</TableHead>
                            <TableHead>اسم القاعدة</TableHead>
                            <TableHead>المشغّل (Trigger)</TableHead>
                            <TableHead>الإجراء (Action)</TableHead>
                            <TableHead>التنفيذات</TableHead>
                            <TableHead>آخر نشاط</TableHead>
                            <TableHead className="text-left">إجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {workflows.map((workflow) => (
                            <TableRow key={workflow._id} className={!workflow.enabled ? 'opacity-60 bg-muted/50' : ''}>
                                <TableCell>
                                    <Switch
                                        checked={workflow.enabled}
                                        onCheckedChange={() => toggleWorkflow(workflow._id)}
                                    />
                                </TableCell>
                                <TableCell className="font-medium">
                                    {workflow.name}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                                        {TRIGGERS.find(t => t.value === workflow.trigger)?.label || workflow.trigger}
                                        {workflow.triggerConfig?.keyword ? `: ${workflow.triggerConfig.keyword}` : ''}
                                        {workflow.triggerConfig?.tag ? `: ${workflow.triggerConfig.tag}` : ''}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                                        {ACTIONS.find(a => a.value === workflow.action)?.label || workflow.action}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {workflow.stats?.runs || 0}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {workflow.stats?.lastRun ? new Date(workflow.stats.lastRun).toLocaleString('en-US', {
                                        month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
                                    }) : '-'}
                                </TableCell>
                                <TableCell className="text-left">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(workflow)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteWorkflow({ id: workflow._id })} className="text-destructive hover:text-destructive">
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {workflows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    لا توجد قواعد أتمتة حتى الآن. ابدأ بإنشاء قاعدة جديدة.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
