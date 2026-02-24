"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useAction } from "convex/react"
import { api } from "@/mock/convex-api"
import { Doc } from "@/mock/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatCard } from "@/components/ui/stat-card"
import {
    Plus,
    Search,
    FileText,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Edit,
    Eye,
    Image as ImageIcon,
    Video,
    RefreshCw,
    Trash2,
    Phone,
    MoreVertical
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery"
import { TemplatePreview } from "@/components/TemplatePreview"
import { runConvexActionSafe } from "@/lib/convexActionSafe"

export default function TemplatesPage() {
    const enableExtendedCampaignApis = process.env.NEXT_PUBLIC_EXTENDED_CAMPAIGN_APIS === "1"
    const { activePhoneNumberId } = useWorkspace()
    const syncFromMeta = useAction(api.templates.syncFromMeta)
    const deleteTemplate = useAction(api.templates.deleteTemplate)
    
    // "__all__" or null = default number. Convex expects undefined, not null.
    const effectivePhoneNumberId =
      !activePhoneNumberId || activePhoneNumberId === "__all__" ? undefined : activePhoneNumberId
    const templateHealthQuery = useOptionalConvexQuery<any>(
        (api as any).templates.getScopedTemplateHealth,
        enableExtendedCampaignApis && effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : "skip",
        enableExtendedCampaignApis
    )
    const templateHealth = templateHealthQuery.data
    const templates =
        useQuery(api.templates.list, effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : "skip") as Doc<"templates">[] | undefined
    const templatesList = templates ?? []
    const isTokenAuthFailed = templateHealth?.tokenStatus === "auth_failed"
    const tokenAuthFailedMessage = templateHealth?.lastAuthErrorMessage as string | undefined

    const [search, setSearch] = useState("")
    const [activeTab, setActiveTab] = useState("all")
    const [previewTemplate, setPreviewTemplate] = useState<any>(null)
    const [deleteTemplateData, setDeleteTemplateData] = useState<any>(null)
    const [isSyncing, setIsSyncing] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)

    const showToast = (type: "success" | "error", message: string) => {
        setToast({ type, message })
        setTimeout(() => setToast(null), 3000)
    }

    const handleSync = async () => {
        if (!effectivePhoneNumberId) {
            showToast("error", "حدد رقماً أولاً لعرض ومزامنة قوالبه من Meta.")
            return
        }
        if (isTokenAuthFailed) {
            showToast("error", "لا يمكن مزامنة القوالب حتى إعادة ربط Access Token لهذا الرقم.")
            return
        }
        setIsSyncing(true)
        try {
            const syncResult = await runConvexActionSafe(syncFromMeta as any, { phoneNumberId: effectivePhoneNumberId }, {
                actionName: "templates:syncFromMeta",
            })
            if (!syncResult.ok) {
                showToast(
                    "error",
                    syncResult.unavailable
                        ? "دالة مزامنة القوالب غير متاحة في نسخة Convex الحالية. انشر backend ثم أعد المحاولة."
                        : (syncResult.message || "تعذر مزامنة القوالب.")
                )
                return
            }
            const rawResult = syncResult.data as any
            const fetched = Number(typeof rawResult === "number" ? rawResult : rawResult?.fetchedCount ?? 0)
            const upserted = Number(typeof rawResult === "number" ? rawResult : rawResult?.upsertedCount ?? fetched)
            const deleted = Number(typeof rawResult === "number" ? 0 : rawResult?.deletedCount ?? 0)
            const deduped = Number(typeof rawResult === "number" ? 0 : rawResult?.dedupedCount ?? 0)
            const removedGlobal = Number(typeof rawResult === "number" ? 0 : rawResult?.removedGlobalCount ?? 0)
            showToast(
                "success",
                `تمت مزامنة ${fetched} قالب (تحديث/إضافة: ${upserted}، حذف محلي: ${deleted}، إزالة مكرر: ${deduped}، إزالة قديم عام: ${removedGlobal}).`
            )
        } catch (error) {
            console.error("Sync failed:", error)
            const message = error instanceof Error ? error.message : "فشل في المزامنة"
            showToast("error", message)
        } finally {
            setIsSyncing(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteTemplateData) return
        if (!effectivePhoneNumberId) {
            showToast("error", "حدد رقماً أولاً لحذف قالبه.")
            return
        }
        setIsDeleting(true)
        try {
            await deleteTemplate({ name: deleteTemplateData.name, phoneNumberId: effectivePhoneNumberId })
            showToast("success", `تم حذف القالب "${deleteTemplateData.name}" بنجاح`)
            setDeleteTemplateData(null)
        } catch (error: any) {
            console.error("Delete failed:", error)
            const errorMessage = error.message || String(error)
            if (errorMessage.includes("Permission") || errorMessage.includes("(#100)")) {
                 showToast("error", "فشل الحذف: لا تملك صلاحيات كافية في حساب Meta")
            } else {
                 showToast("error", "فشل في حذف القالب")
            }
        } finally {
            setIsDeleting(false)
        }
    }

    const filteredTemplates = templatesList.filter((t: Doc<"templates">) => {
        const matchesSearch = t.name.includes(search) || (t.components && JSON.stringify(t.components).includes(search))
        const matchesTab = activeTab === "all" || t.status.toLowerCase() === activeTab.toLowerCase()
        return matchesSearch && matchesTab
    })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "APPROVED":
                return <Badge className="bg-success/10 text-success hover:bg-success/20 gap-1 shadow-none"><CheckCircle2 className="w-3 h-3" /> معتمد</Badge>
            case "PENDING":
                return <Badge variant="secondary" className="gap-1 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"><Clock className="w-3 h-3" /> قيد المراجعة</Badge>
            case "REJECTED":
                return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> مرفوض</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const getMediaIcon = (components: any[]) => {
        const header = components?.find((c: any) => c.type === "HEADER")
        if (!header) return <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary"><FileText className="h-5 w-5" /></div>

        switch (header.format) {
            case "IMAGE": return <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><ImageIcon className="h-5 w-5" /></div>
            case "VIDEO": return <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><Video className="h-5 w-5" /></div>
            default: return <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary"><FileText className="h-5 w-5" /></div>
        }
    }

    const getBodyText = (components: any[]) => {
        const body = components?.find((c: any) => c.type === "BODY")
        return body?.text || ""
    }

    const stats = {
        total: templatesList.length,
        approved: templatesList.filter((t: Doc<"templates">) => t.status === "APPROVED").length,
        pending: templatesList.filter((t: Doc<"templates">) => t.status === "PENDING").length,
        rejected: templatesList.filter((t: Doc<"templates">) => t.status === "REJECTED").length,
    }

    return (
        <div className="space-y-8 p-6 sm:p-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">قوالب الرسائل</h1>
                    <p className="text-muted-foreground text-lg">إدارة وتخصيص قوالب WhatsApp المعتمدة</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/templates/store">
                        <Button variant="outline" className="gap-2 rounded-xl">
                            متجر القوالب
                        </Button>
                    </Link>
                    <Button variant="outline" className="gap-2" onClick={handleSync} disabled={!effectivePhoneNumberId || isSyncing || isTokenAuthFailed}>
                        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        مزامنة
                    </Button>
                    <Link href="/templates/new">
                        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-none rounded-xl px-6">
                            <Plus className="h-5 w-5" />
                            قالب جديد
                        </Button>
                    </Link>
                </div>
            </div>

            {!effectivePhoneNumberId ? (
                <div className="rounded-lg border-2 border-dashed border-amber-300/70 bg-amber-50/80 dark:bg-amber-900/20 p-8 text-center">
                    <Phone className="h-12 w-12 mx-auto text-amber-600 dark:text-amber-400 mb-4" />
                    <p className="text-amber-900 dark:text-amber-200 font-medium text-lg">حدد رقماً لعرض ومزامنة قوالبه من Meta</p>
                    <p className="text-sm text-amber-800/90 dark:text-amber-300/90 mt-2 max-w-md mx-auto">
                        اختر رقماً محدداً من القائمة &quot;الرقم النشط&quot; في الشريط الجانبي لعرض القوالب المعتمدة لهذا الرقم ومزامنتها. القوالب مرتبطة بكل رقم على حدة لضمان التوافق مع Meta.
                    </p>
                </div>
            ) : (
            <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="إجمالي القوالب" 
                    value={stats.total} 
                    icon={<FileText className="h-4 w-4 text-primary" />} 
                />
                <StatCard 
                    title="معتمدة" 
                    value={stats.approved} 
                    icon={<CheckCircle2 className="h-4 w-4 text-success" />} 
                    variant="default"
                />
                <StatCard 
                    title="قيد المراجعة" 
                    value={stats.pending} 
                    icon={<Clock className="h-4 w-4 text-yellow-600" />} 
                    variant="default"
                />
                <StatCard 
                    title="مرفوضة" 
                    value={stats.rejected} 
                    icon={<AlertTriangle className="h-4 w-4 text-destructive" />} 
                    variant="default"
                />
            </div>

            {/* Search & Filter */}
            {isTokenAuthFailed && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    لا يمكن مزامنة القوالب لهذا الرقم حتى إعادة ربط Access Token من صفحة الإعدادات والربط.
                    {tokenAuthFailedMessage ? ` (${tokenAuthFailedMessage})` : ""}
                    <div className="mt-2">
                        <Link href="/integrations" className="underline underline-offset-2">
                            فتح الإعدادات والربط
                        </Link>
                    </div>
                </div>
            )}
            {enableExtendedCampaignApis && templateHealthQuery.unavailable && (
                <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                    معلومات صحة القوالب غير متاحة في نسخة Convex الحالية. يمكنك المتابعة بالمزامنة والإدارة من هذه الصفحة.
                </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 min-w-[200px] max-w-md w-full">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="بحث في القوالب..."
                        className="pr-10 bg-white dark:bg-muted/30 border-none shadow-none ring-1 ring-border/50 focus:ring-primary/20 rounded-xl h-11"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="bg-muted p-1 rounded-xl flex items-center w-full sm:w-auto">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-transparent p-0 w-full sm:w-auto">
                            <TabsTrigger value="all" className="rounded-lg px-4 flex-1 sm:flex-none">الكل</TabsTrigger>
                            <TabsTrigger value="approved" className="rounded-lg px-4 flex-1 sm:flex-none">معتمد</TabsTrigger>
                            <TabsTrigger value="pending" className="rounded-lg px-4 flex-1 sm:flex-none">مراجعة</TabsTrigger>
                            <TabsTrigger value="rejected" className="rounded-lg px-4 flex-1 sm:flex-none">مرفوض</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* Templates Grid */}
            {templatesList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/5 rounded-3xl border border-dashed border-muted-foreground/20">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                        <FileText className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">لا توجد قوالب حتى الآن</h3>
                    <p className="text-muted-foreground max-w-sm mb-8">
                        ابدأ بإنشاء قالبك الأول للتواصل مع عملائك.
                    </p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={handleSync}>مزامنة من Meta</Button>
                        <Link href="/templates/new">
                            <Button>إنشاء قالب</Button>
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template: Doc<"templates">) => (
                        <Card key={template._id} className="group overflow-hidden border-none ring-1 ring-border/50 shadow-none hover:shadow-lg hover:ring-primary/20 transition-all duration-300">
                            <CardHeader className="pb-3 pt-5 px-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        {getMediaIcon(template.components)}
                                        <div>
                                            <CardTitle className="text-base font-bold line-clamp-1">{template.name}</CardTitle>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal bg-muted/50 border-0 text-muted-foreground">
                                                    {template.category}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground uppercase">{template.language}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <Link href={`/templates/new?edit=${template.name}`}>
                                                <DropdownMenuItem>
                                                    <Edit className="h-4 w-4 ml-2" />
                                                    تعديل
                                                </DropdownMenuItem>
                                            </Link>
                                            <DropdownMenuItem 
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => setDeleteTemplateData(template)}
                                            >
                                                <Trash2 className="h-4 w-4 ml-2" />
                                                حذف
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                <div className="bg-muted/30 rounded-xl p-3 mb-4 min-h-[80px]">
                                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                        {getBodyText(template.components) || template.content || "لا يوجد محتوى نصي"}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between mt-auto">
                                    {getStatusBadge(template.status)}
                                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/5 -ml-2" onClick={() => setPreviewTemplate(template)}>
                                        <Eye className="h-4 w-4 ml-1" />
                                        معاينة
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            </>
            )}

            {/* Preview Modal */}
            <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>معاينة القالب</DialogTitle>
                        <DialogDescription>عرض القالب بشكل مبسط بدون إطار الجهاز.</DialogDescription>
                    </DialogHeader>
                    {previewTemplate ? (
                        <Card className="border shadow-none">
                            <CardContent className="space-y-3 bg-muted/20 p-4">
                                <div className="text-sm font-medium text-muted-foreground">{previewTemplate.name}</div>
                                <TemplatePreview template={previewTemplate} />
                            </CardContent>
                        </Card>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteTemplateData} onOpenChange={(open) => !open && setDeleteTemplateData(null)}>
                <DialogContent className="max-w-sm rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>حذف القالب</DialogTitle>
                        <DialogDescription>تأكيد حذف القالب من النظام ومن Meta عند توفر الصلاحية.</DialogDescription>
                    </DialogHeader>
                    {deleteTemplateData && (
                        <div className="space-y-4">
                            <div className="bg-destructive/10 p-4 rounded-xl flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                <p className="text-sm text-destructive-foreground">
                                    هل أنت متأكد من حذف القالب <strong>&quot;{deleteTemplateData.name}&quot;</strong>؟
                                    سيتم حذفه من حساب Meta أيضاً ولا يمكن التراجع عن هذا الإجراء.
                                </p>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <Button variant="outline" onClick={() => setDeleteTemplateData(null)} className="rounded-xl">إلغاء</Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="rounded-xl">
                                    {isDeleting ? "جاري الحذف..." : "تأكيد الحذف"}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-50 animate-in slide-in-from-bottom-5 duration-300 ${
                    toast.type === "success" ? "bg-black text-white" : "bg-destructive text-white"
                }`}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}
