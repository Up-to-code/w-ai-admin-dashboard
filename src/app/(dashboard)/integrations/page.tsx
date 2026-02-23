"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/mock/convex-api"
import type { Id } from "@/mock/dataModel"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
    Link2,
    Check,
    Copy,
    ExternalLink,
    RefreshCw,
    ShoppingBag,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    MessageSquare,
    Webhook,
    Lock,
    Key,
    Loader2
} from "lucide-react"

export default function IntegrationsPage() {
    const searchParams = useSearchParams()
    const success = searchParams.get("success")
    const error = searchParams.get("error")

    const { activePhoneNumberId } = useWorkspace()
    const connection = useQuery(api.salla.getConnection)
    const disconnect = useMutation(api.salla.disconnect)
    const webhookSettings = useQuery(api.webhookSettings.get)
    const setWebhookSettings = useMutation(api.webhookSettings.set)
    const runHealthCheck = useAction(api.whatsappNumbers.checkHealth)
    const syncNumbersFromMeta = useAction(api.whatsappNumbers.syncFromMeta)
    const testAccessToken = useAction(api.whatsapp.testAccessToken)
    const updateWhatsappNumber = useMutation(api.whatsappNumbers.update)
    const addWhatsappNumber = useMutation(api.whatsappNumbers.add)
    const numbersQuery = useQuery(api.whatsappNumbers.list)
    const numbers = useMemo(() => numbersQuery ?? [], [numbersQuery])
    const upsertAgent = useMutation(api.agents.upsertByPhoneNumberId)
    const toggleAgent = useMutation(api.agents.toggleByPhoneNumberId)

    const [isConnecting, setIsConnecting] = useState(false)
    const [showNotification, setShowNotification] = useState(!!success || !!error)

    const [webhookVerifyToken, setWebhookVerifyToken] = useState("")
    const [webhookAccessToken, setWebhookAccessToken] = useState("")
    const [webhookAppId, setWebhookAppId] = useState("")
    const [defaultPhoneNumberId, setDefaultPhoneNumberId] = useState("")
    const [webhookSaving, setWebhookSaving] = useState(false)
    const [webhookSaved, setWebhookSaved] = useState(false)
    const [tokenTestLoading, setTokenTestLoading] = useState(false)
    const [tokenTestResult, setTokenTestResult] = useState<{ success: boolean; phoneId?: string; displayPhoneNumber?: string | null; error?: string; details?: unknown } | null>(null)
    const [health, setHealth] = useState<Record<string, { appSubscribed: boolean; profileReadable: boolean; mediaEndpointReadable: boolean; issues: string[] }>>({})
    const [healthLoading, setHealthLoading] = useState(false)
    const [agentSaving, setAgentSaving] = useState(false)
    const [agentPhoneNumberId, setAgentPhoneNumberId] = useState("")
    const [agentEnabled, setAgentEnabled] = useState(false)
    const [agentName, setAgentName] = useState("Assistant")
    const [agentPrompt, setAgentPrompt] = useState("")
    const [agentModel, setAgentModel] = useState("stepfun/step-3.5-flash:free")
    const [agentRecommendProducts, setAgentRecommendProducts] = useState(true)
    const [agentToolsEnabled, setAgentToolsEnabled] = useState<string[]>([
        "send_text",
        "send_image",
        "send_link",
        "send_audio",
        "send_product",
        "transfer_to_human",
    ])
    const [agentOpenRouterKey, setAgentOpenRouterKey] = useState("")
    const [editingTokenFor, setEditingTokenFor] = useState<Id<"whatsapp_numbers"> | null>(null)
    const [numberTokenValue, setNumberTokenValue] = useState("")
    const [numberTokenSaving, setNumberTokenSaving] = useState(false)
    const [syncingFromMeta, setSyncingFromMeta] = useState(false)
    const [addingNumber, setAddingNumber] = useState(false)
    const [newNumberName, setNewNumberName] = useState("")
    const [newNumberPhone, setNewNumberPhone] = useState("")
    const [newBusinessNumberId, setNewBusinessNumberId] = useState("")
    const [newBusinessAccountId, setNewBusinessAccountId] = useState("")
    const [tokenTestLoadingFor, setTokenTestLoadingFor] = useState<string | null>(null)
    const [tokenTestByNumber, setTokenTestByNumber] = useState<Record<string, { success: boolean; phoneId?: string; displayPhoneNumber?: string | null; error?: string; details?: unknown }>>({})

    useEffect(() => {
        if (numbers.length === 0) {
            setAgentPhoneNumberId("")
            return
        }
        setAgentPhoneNumberId((current) => {
            if (activePhoneNumberId && numbers.some((n) => n.businessNumberId === activePhoneNumberId)) {
                return activePhoneNumberId
            }
            if (current && numbers.some((n) => n.businessNumberId === current)) return current
            return numbers[0].businessNumberId
        })
    }, [activePhoneNumberId, numbers])

    const effectiveAgentPhoneNumberId = agentPhoneNumberId || undefined
    const selectedAgentWorkspace =
        numbers.find((n) => n.businessNumberId === effectiveAgentPhoneNumberId) ?? null
    const agentConfig = useQuery(
        api.agents.getByPhoneNumberId,
        effectiveAgentPhoneNumberId ? { phoneNumberId: effectiveAgentPhoneNumberId } : "skip"
    )

    useEffect(() => {
        if (webhookSettings !== undefined) {
            setWebhookVerifyToken(webhookSettings.verifyToken ?? "")
            setWebhookAccessToken(webhookSettings.accessToken ?? "")
            setWebhookAppId(webhookSettings.appId ?? "")
            setDefaultPhoneNumberId(webhookSettings.defaultPhoneNumberId ?? "")
        }
    }, [webhookSettings])

    useEffect(() => {
        if (showNotification) {
            const timer = setTimeout(() => setShowNotification(false), 5000)
            return () => clearTimeout(timer)
        }
    }, [showNotification])

    useEffect(() => {
        let cancelled = false
        async function loadHealth() {
            if (numbers.length === 0) return
            setHealthLoading(true)
            try {
                const result = await runHealthCheck()
                if (cancelled) return
                const mapped: Record<string, { appSubscribed: boolean; profileReadable: boolean; mediaEndpointReadable: boolean; issues: string[] }> = {}
                for (const item of result) {
                    mapped[item.businessNumberId] = {
                        appSubscribed: item.appSubscribed,
                        profileReadable: item.profileReadable,
                        mediaEndpointReadable: item.mediaEndpointReadable,
                        issues: item.issues ?? [],
                    }
                }
                setHealth(mapped)
            } catch (error) {
                console.error("Failed to load WhatsApp number health", error)
            } finally {
                if (!cancelled) setHealthLoading(false)
            }
        }
        void loadHealth()
        return () => {
            cancelled = true
        }
    }, [numbers.length, runHealthCheck])

    useEffect(() => {
        if (!agentConfig) return
        setAgentEnabled(agentConfig.isActive)
        setAgentName(agentConfig.agentName ?? "Assistant")
        setAgentPrompt(agentConfig.systemPrompt ?? "")
        setAgentModel(agentConfig.model ?? "stepfun/step-3.5-flash:free")
        setAgentRecommendProducts(agentConfig.recommendProducts ?? true)
        setAgentToolsEnabled(agentConfig.toolsEnabled ?? [])
        setAgentOpenRouterKey((agentConfig as { openRouterApiKeyConfigured?: boolean }).openRouterApiKeyConfigured ? "__CONFIGURED__" : "")
    }, [agentConfig])

    const handleConnect = () => {
        setIsConnecting(true)
        const clientId = process.env.NEXT_PUBLIC_SALLA_CLIENT_ID
        const redirectUri = process.env.NEXT_PUBLIC_SALLA_REDIRECT_URI

        if (!clientId || !redirectUri) {
            console.error("Missing Salla OAuth configuration")
            setIsConnecting(false)
            return
        }

        const authUrl = new URL("https://accounts.salla.sa/oauth2/auth")
        authUrl.searchParams.set("client_id", clientId)
        authUrl.searchParams.set("redirect_uri", redirectUri)
        authUrl.searchParams.set("response_type", "code")
        authUrl.searchParams.set("scope", "offline_access")
        authUrl.searchParams.set("state", crypto.randomUUID());

        window.location.href = authUrl.toString();
    }

    const handleDisconnect = async () => {
        if (confirm("هل تريد بالتأكيد قطع الاتصال بمتجر سلة؟")) {
            await disconnect()
        }
    }

    const convexSiteBase = typeof process.env.NEXT_PUBLIC_CONVEX_URL === "string"
        ? process.env.NEXT_PUBLIC_CONVEX_URL.replace(".convex.cloud", ".convex.site")
        : ""
    const defaultWebhookUrl = convexSiteBase ? `${convexSiteBase}/whatsapp/webhook` : ""

    const handleSaveWebhookSettings = async (e: React.FormEvent) => {
        e.preventDefault()
        setWebhookSaving(true)
        setWebhookSaved(false)
        setTokenTestResult(null)
        try {
            await setWebhookSettings({
                verifyToken: webhookVerifyToken.trim() || undefined,
                accessToken: webhookAccessToken.trim() || undefined,
                appId: webhookAppId.trim() || undefined,
                defaultPhoneNumberId: defaultPhoneNumberId || undefined,
            })
            setWebhookSaved(true)
            setTimeout(() => setWebhookSaved(false), 3000)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setTokenTestResult({ success: false, error: msg })
        } finally {
            setWebhookSaving(false)
        }
    }

    const handleTestAccessToken = async () => {
        setTokenTestLoading(true)
        setTokenTestResult(null)
        try {
            const result = await testAccessToken({ phoneNumberId: defaultPhoneNumberId || undefined })
            setTokenTestResult(
                result.success
                    ? { success: true, phoneId: result.phoneId, displayPhoneNumber: result.displayPhoneNumber ?? null }
                    : { success: false, error: (result as { error?: string }).error ?? "Unknown", details: (result as { details?: unknown }).details }
            )
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setTokenTestResult({ success: false, error: msg })
        } finally {
            setTokenTestLoading(false)
        }
    }

    const handleSaveNumberToken = async (id: Id<"whatsapp_numbers">) => {
        setNumberTokenSaving(true)
        try {
            await updateWhatsappNumber({ id, accessToken: numberTokenValue.trim() || undefined })
            setEditingTokenFor(null)
            setNumberTokenValue("")
            setTokenTestByNumber((prev) => {
                const next = { ...prev }
                const num = numbers.find((n) => n._id === id)
                if (num) delete next[num.businessNumberId]
                return next
            })
        } finally {
            setNumberTokenSaving(false)
        }
    }

    const handleSyncFromMeta = async () => {
        const token =
            webhookAccessToken.trim() ||
            numbers.find((n) => n.accessToken?.trim())?.accessToken?.trim() ||
            ""
        if (!token) {
            setTokenTestResult({
                success: false,
                error: "لا يوجد Access Token. أضفه أولاً ثم أعد المزامنة.",
            })
            return
        }
        setSyncingFromMeta(true)
        try {
            const result = await syncNumbersFromMeta({
                accessToken: token,
            })

            setTokenTestResult({
                success: true,
                displayPhoneNumber: `discovered=${result.discovered}, inserted=${result.inserted}, updated=${result.updated}`,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setTokenTestResult({ success: false, error: msg })
        } finally {
            setSyncingFromMeta(false)
        }
    }

    const handleAddNumber = async (e: React.FormEvent) => {
        e.preventDefault()
        const businessNumberId = newBusinessNumberId.trim()
        const phone = newNumberPhone.trim()
        const name = newNumberName.trim()
        const businessAccountId =
            newBusinessAccountId.trim() || numbers[0]?.businessAccountId?.trim() || ""

        if (!businessNumberId || !phone || !name || !businessAccountId) {
            setTokenTestResult({
                success: false,
                error: "أدخل الاسم، الرقم، phone_number_id، و business_account_id",
            })
            return
        }

        setAddingNumber(true)
        try {
            await addWhatsappNumber({
                businessAccountId,
                businessNumberId,
                phone,
                name,
            })
            setNewNumberName("")
            setNewNumberPhone("")
            setNewBusinessNumberId("")
            setTokenTestResult({
                success: true,
                displayPhoneNumber: phone,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setTokenTestResult({ success: false, error: msg })
        } finally {
            setAddingNumber(false)
        }
    }

    const handleTestNumberToken = async (businessNumberId: string) => {
        setTokenTestLoadingFor(businessNumberId)
        try {
            const result = await testAccessToken({ phoneNumberId: businessNumberId })
            setTokenTestByNumber((prev) => ({
                ...prev,
                [businessNumberId]: result.success
                    ? { success: true, phoneId: result.phoneId, displayPhoneNumber: result.displayPhoneNumber ?? null }
                    : { success: false, error: (result as { error?: string }).error ?? "Unknown error", details: (result as { details?: unknown }).details },
            }))
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setTokenTestByNumber((prev) => ({
                ...prev,
                [businessNumberId]: { success: false, error: msg },
            }))
        } finally {
            setTokenTestLoadingFor(null)
        }
    }

    const handleToggleAgent = async (next: boolean) => {
        const targetNumberIds = effectiveAgentPhoneNumberId ? [effectiveAgentPhoneNumberId] : []
        if (targetNumberIds.length === 0) return
        setAgentEnabled(next)
        await Promise.all(
            targetNumberIds.map((phoneNumberId) =>
                toggleAgent({ phoneNumberId, isActive: next })
            )
        )
    }

    const handleToolToggle = (tool: string, checked: boolean) => {
        setAgentToolsEnabled((prev) =>
            checked ? Array.from(new Set([...prev, tool])) : prev.filter((t) => t !== tool)
        )
    }

    const handleSaveAgentSettings = async () => {
        const targetNumberIds = effectiveAgentPhoneNumberId ? [effectiveAgentPhoneNumberId] : []
        if (targetNumberIds.length === 0) return
        setAgentSaving(true)
        try {
            await Promise.all(
                targetNumberIds.map((phoneNumberId) =>
                    upsertAgent({
                        phoneNumberId,
                        isActive: agentEnabled,
                        agentName: agentName.trim() || "Assistant",
                        systemPrompt: agentPrompt.trim() || "You are a helpful sales assistant.",
                        model: agentModel.trim() || "stepfun/step-3.5-flash:free",
                        recommendProducts: agentRecommendProducts,
                        toolsEnabled: agentToolsEnabled,
                        ...(agentOpenRouterKey !== "__CONFIGURED__" && { openRouterApiKey: agentOpenRouterKey }),
                    })
                )
            )
            setWebhookSaved(true)
            setTimeout(() => setWebhookSaved(false), 2000)
        } finally {
            setAgentSaving(false)
        }
    }

    const hasNumbers = numbers.length > 0
    const allNumberTokensReady = hasNumbers && numbers.every((n) => Boolean(n.accessToken?.trim()))
    const allNumbersWebhookReady =
        hasNumbers &&
        !healthLoading &&
        numbers.every((n) => {
            const h = health[n.businessNumberId]
            return Boolean(h?.appSubscribed && h?.profileReadable)
        })
    const fallbackReady = numbers.length <= 1 || Boolean(defaultPhoneNumberId)
    const verifyTokenReady = Boolean(webhookVerifyToken.trim())
    const appIdReady = Boolean(webhookAppId.trim())

    const productionChecks = [
        {
            label: "Numbers Added",
            ok: hasNumbers,
            detail: hasNumbers ? `${numbers.length} number(s) configured` : "Add at least one WhatsApp number",
        },
        {
            label: "Per-Number Access Tokens",
            ok: allNumberTokensReady,
            detail: allNumberTokensReady ? "All numbers have tokens" : "One or more numbers are missing tokens",
        },
        {
            label: "Webhook Runtime Health",
            ok: allNumbersWebhookReady,
            detail: healthLoading
                ? "Checking health..."
                : allNumbersWebhookReady
                  ? "Webhook app/profile checks pass for all numbers"
                  : "Fix webhook issues shown in number health",
        },
        {
            label: "Fallback Number",
            ok: fallbackReady,
            detail: fallbackReady
                ? (numbers.length <= 1 ? "Single-number setup" : "Default fallback number selected")
                : "Select a default fallback number",
        },
        {
            label: "Webhook Verify Token",
            ok: verifyTokenReady,
            detail: verifyTokenReady ? "Verify token is configured" : "Set verify token",
        },
        {
            label: "Meta App ID",
            ok: appIdReady,
            detail: appIdReady ? "App ID is configured" : "Set Meta App ID",
        },
    ]

    const productionReadyCount = productionChecks.filter((c) => c.ok).length
    const productionReady = productionReadyCount === productionChecks.length

    const isConnected = Boolean(connection?.connected)
    const sallaStatus = connection?.status ?? "disconnected"
    const sallaStatusLabel =
        sallaStatus === "connected"
            ? "متصل"
            : sallaStatus === "token_invalid"
              ? "الرمز غير صالح"
              : sallaStatus === "refresh_failed"
                ? "فشل تجديد الرمز"
                : "غير متصل"

    return (
        <div className="space-y-8 p-6 sm:p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
            {/* Notification */}
            {showNotification && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 shadow-lg border animate-in slide-in-from-top-4 ${success ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'
                    }`}>
                    {success ? (
                        <>
                            <CheckCircle2 className="h-5 w-5" />
                            <span className="font-medium">تم ربط متجر سلة بنجاح!</span>
                        </>
                    ) : (
                        <>
                            <XCircle className="h-5 w-5" />
                            <span className="font-medium">فشل الربط: {error}</span>
                        </>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">الإعدادات والربط</h1>
                <p className="text-muted-foreground">إدارة تكامل سلة وواتساب للأعمال</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Salla Integration Card */}
                <Card className="border-none ring-1 ring-border/50 shadow-none overflow-hidden hover:ring-primary/20 transition-all">
                    <div className="h-2 bg-[#004D3D]" />
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-xl bg-[#004D3D]/10 flex items-center justify-center">
                                <ShoppingBag className="h-6 w-6 text-[#004D3D]" />
                            </div>
                            {isConnected ? (
                                <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 shadow-none">
                                    <Check className="h-3 w-3 mr-1" /> {sallaStatusLabel}
                                </Badge>
                            ) : (
                                <Badge variant="outline" className={`border-dashed shadow-none ${sallaStatus === "token_invalid" || sallaStatus === "refresh_failed" ? "border-amber-500/40 text-amber-700 dark:text-amber-300" : ""}`}>
                                    {sallaStatusLabel}
                                </Badge>
                            )}
                        </div>
                        <CardTitle className="text-xl mt-4">سلة</CardTitle>
                        <CardDescription>الربط لمزامنة المنتجات والطلبات</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isConnected && connection ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">المتجر المتصل</p>
                                    <p className="font-bold text-lg">{connection.storeName || "متجر غير معروف"}</p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        تاريخ الربط: {new Date(connection.connectedAt ?? Date.now()).toLocaleDateString('ar-SA')}
                                    </p>
                                    {(sallaStatus === "token_invalid" || sallaStatus === "refresh_failed") && (
                                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                                            {connection.lastTokenErrorMessage || "رمز الوصول منتهي أو غير صالح. أعد الربط لتحديث البيانات."}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Link href="/products" className="flex-1">
                                        <Button variant="outline" className="w-full h-11 rounded-xl group transition-all">
                                            عرض المنتجات
                                            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-11 w-11 rounded-xl text-destructive hover:bg-destructive/10"
                                        onClick={handleDisconnect}
                                    >
                                        <XCircle className="h-5 w-5" />
                                    </Button>
                                </div>
                                {(sallaStatus === "token_invalid" || sallaStatus === "refresh_failed") && (
                                    <Button
                                        className="w-full h-11 rounded-xl bg-[#004D3D] hover:bg-[#003D2D] text-white"
                                        onClick={handleConnect}
                                        disabled={isConnecting}
                                    >
                                        {isConnecting ? (
                                            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                                        ) : (
                                            <Link2 className="h-5 w-5 mr-2" />
                                        )}
                                        إعادة ربط سلة
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button
                                className="w-full h-12 rounded-xl bg-[#004D3D] hover:bg-[#003D2D] text-white shadow-lg shadow-[#004D3D]/20 transition-all active:scale-95"
                                onClick={handleConnect}
                                disabled={isConnecting}
                            >
                                {isConnecting ? (
                                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <Link2 className="h-5 w-5 mr-2" />
                                )}
                                ربط متجر سلة الآن
                            </Button>
                        )}
                        <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">التكامل الرسمي عبر Salla App Store</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                {/* WhatsApp Numbers Card */}
                <Card className="border-none ring-1 ring-border/50 shadow-none overflow-hidden hover:ring-primary/20 transition-all">
                    <div className="h-2 bg-[#25D366]" />
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                                <MessageSquare className="h-6 w-6 text-[#25D366]" />
                            </div>
                            <Badge className="bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 shadow-none">
                                {numbers.length} أرقام نشطة
                            </Badge>
                        </div>
                        <CardTitle className="text-xl mt-4">واتساب للأعمال</CardTitle>
                        <CardDescription>إدارة الأرقام المرتبطة بالخدمة</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleAddNumber} className="rounded-xl border border-border/50 p-3 bg-muted/20 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground">إضافة رقم جديد</p>
                            <div className="grid sm:grid-cols-2 gap-2">
                                <Input
                                    value={newNumberName}
                                    onChange={(e) => setNewNumberName(e.target.value)}
                                    placeholder="اسم الرقم"
                                />
                                <Input
                                    value={newNumberPhone}
                                    onChange={(e) => setNewNumberPhone(e.target.value)}
                                    placeholder="+966..."
                                    dir="ltr"
                                />
                                <Input
                                    value={newBusinessNumberId}
                                    onChange={(e) => setNewBusinessNumberId(e.target.value)}
                                    placeholder="phone_number_id"
                                    dir="ltr"
                                />
                                <Input
                                    value={newBusinessAccountId}
                                    onChange={(e) => setNewBusinessAccountId(e.target.value)}
                                    placeholder={`business_account_id${numbers[0]?.businessAccountId ? " (optional)" : ""}`}
                                    dir="ltr"
                                />
                            </div>
                            <Button type="submit" size="sm" disabled={addingNumber}>
                                {addingNumber ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                                {addingNumber ? "جاري الإضافة..." : "إضافة الرقم"}
                            </Button>
                        </form>

                        <div className="space-y-2">
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={handleSyncFromMeta}
                                    disabled={syncingFromMeta}
                                >
                                    {syncingFromMeta ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                                    مزامنة من Meta
                                </Button>
                            </div>
                            {numbers.map((n) => (
                                <div
                                    key={n._id}
                                    className="rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors overflow-hidden"
                                >
                                    <div className="group flex flex-wrap items-center justify-between gap-4 p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-background border flex items-center justify-center">
                                                <Check className="h-5 w-5 text-success" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm tracking-tight">{n.name}</p>
                                                <p className="text-xs text-muted-foreground font-mono" dir="ltr">{n.phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="bg-success/10 text-[10px] px-2 py-0.5 rounded-full text-success font-bold uppercase tracking-widest">
                                                Active
                                            </div>
                                            <div
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                                                    n.tokenStatus === "auth_failed"
                                                        ? "bg-destructive/10 text-destructive"
                                                        : n.accessToken
                                                          ? "bg-blue-500/10 text-blue-600"
                                                          : "bg-amber-500/10 text-amber-700"
                                                }`}
                                            >
                                                {n.tokenStatus === "auth_failed"
                                                    ? "Auth Failed"
                                                    : n.accessToken
                                                      ? "Token Ready"
                                                      : "Token Missing"}
                                            </div>
                                            {defaultPhoneNumberId === n.businessNumberId && (
                                                <div className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest bg-primary/10 text-primary">
                                                    Default Fallback
                                                </div>
                                            )}
                                            <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${(health[n.businessNumberId]?.appSubscribed && health[n.businessNumberId]?.profileReadable) ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"}`}>
                                                {healthLoading ? "Checking..." : (health[n.businessNumberId]?.appSubscribed && health[n.businessNumberId]?.profileReadable) ? "Webhook Ready" : "Needs Fix"}
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                                    onClick={() => {
                                                        setEditingTokenFor(editingTokenFor === n._id ? null : n._id)
                                                        setNumberTokenValue("")
                                                    }}
                                                >
                                                    <Key className="h-3.5 w-3.5" />
                                                    {n.accessToken ? "تحديث الرمز" : "تعيين الرمز"}
                                                </Button>
                                                {n.accessToken && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                                        onClick={() => handleTestNumberToken(n.businessNumberId)}
                                                        disabled={tokenTestLoadingFor === n.businessNumberId}
                                                    >
                                                        {tokenTestLoadingFor === n.businessNumberId ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            "اختبار"
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                            {tokenTestByNumber[n.businessNumberId] && (() => {
                                                const t = tokenTestByNumber[n.businessNumberId]
                                                return (
                                                    <div className={`text-[10px] mt-1 ${t?.success ? "text-green-600" : "text-red-600"}`}>
                                                        {t?.success ? `✓ ${t.displayPhoneNumber ?? "صالح"}` : `✗ ${t?.error ?? "خطأ"}`}
                                                    </div>
                                                )
                                            })()}
                                            {n.tokenStatus === "auth_failed" && (
                                                <div className="text-[10px] mt-1 text-destructive max-w-[220px] text-right">
                                                    {n.lastAuthErrorMessage || "Meta authentication failed for this number. Reconnect token."}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {editingTokenFor === n._id && (
                                        <div className="border-t border-border/50 p-4 space-y-2">
                                            <Label className="text-xs">رمز الوصول (Access Token) لهذا الرقم</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="password"
                                                    placeholder="EAAxxxxx..."
                                                    className="font-mono text-sm"
                                                    value={numberTokenValue}
                                                    onChange={(e) => setNumberTokenValue(e.target.value)}
                                                    dir="ltr"
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => handleSaveNumberToken(n._id)}
                                                    disabled={numberTokenSaving || !numberTokenValue.trim()}
                                                >
                                                    {numberTokenSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => { setEditingTokenFor(null); setNumberTokenValue("") }}
                                                >
                                                    إلغاء
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {numbers.some((n) => (health[n.businessNumberId]?.issues?.length ?? 0) > 0) && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                <p className="font-semibold">Runtime health issues detected:</p>
                                {numbers.map((n) => (
                                    (health[n.businessNumberId]?.issues?.length ?? 0) > 0 ? (
                                        <p key={n._id}>
                                            {n.name}: {health[n.businessNumberId].issues.join(" | ")}
                                        </p>
                                    ) : null
                                ))}
                            </div>
                        )}

                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-4 mt-2">
                            <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                يمكنك تعيين أو تحديث رمز الوصول (Access Token) لكل رقم باستخدام زر «تعيين الرمز» أو «تحديث الرمز» أعلاه.
                                لإضافة أرقام جديدة أو تعديل الاسم/الرقم، يرجى التواصل مع الدعم الفني.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Webhook Configuration */}
            <Card className="border-none ring-1 ring-border/50 shadow-none overflow-hidden max-w-3xl mx-auto">
                <CardHeader className="pb-0">
                    <div className="flex items-center gap-3">
                        <Webhook className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">إعدادات الويب هوك (Meta)</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    {defaultWebhookUrl && (
                        <div className="space-y-2">
                            <Label className="text-sm font-bold opacity-70">رابط Webhook (Callback URL)</Label>
                            <div className="flex gap-2">
                                <div className="flex-1 px-4 py-3 bg-muted/30 rounded-xl font-mono text-sm break-all border" dir="ltr">
                                    {defaultWebhookUrl}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 rounded-xl shrink-0"
                                    onClick={() => {
                                        navigator.clipboard.writeText(defaultWebhookUrl);
                                        setWebhookSaved(true);
                                        setTimeout(() => setWebhookSaved(false), 2000);
                                    }}
                                >
                                    {webhookSaved ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-300 space-y-1">
                        <p className="font-semibold">Meta webhook subscription checklist</p>
                        <p>- Subscribe the app to WABA and enable `messages` events.</p>
                        <p>- Verify token in Meta must match the token saved here.</p>
                        <p>- If signature checks fail, confirm Convex `WHATSAPP_APP_SECRET` matches Meta App Secret.</p>
                    </div>

                    <form onSubmit={handleSaveWebhookSettings} className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>رمز التحقق (Verify Token)</Label>
                                <Input
                                    type="password"
                                    value={webhookVerifyToken}
                                    onChange={(e) => setWebhookVerifyToken(e.target.value)}
                                    placeholder="Verify Token من Meta"
                                    className="h-11 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>معرف التطبيق (App ID)</Label>
                                <Input
                                    type="text"
                                    value={webhookAppId}
                                    onChange={(e) => setWebhookAppId(e.target.value)}
                                    placeholder="Meta App ID"
                                    className="h-11 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>رمز الوصول العام (Global Access Token)</Label>
                            <Input
                                type="password"
                                value={webhookAccessToken}
                                onChange={(e) => setWebhookAccessToken(e.target.value)}
                                placeholder="EAAM..."
                                className="h-11 rounded-xl"
                            />
                        </div>

                        {numbers.length > 0 && (
                            <div className="space-y-2">
                                <Label>الرقم الافتراضي عند غياب phone_number_id</Label>
                                <select
                                    value={defaultPhoneNumberId}
                                    onChange={(e) => setDefaultPhoneNumberId(e.target.value)}
                                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="">اختيار تلقائي (أول رقم مفعّل)</option>
                                    {numbers.map((n) => (
                                        <option key={n._id} value={n.businessNumberId}>
                                            {n.name} ({n.phone})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">
                                    يستخدمه النظام كخيار احتياطي عند وصول webhook بدون phone_number_id.
                                </p>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                type="submit"
                                disabled={webhookSaving}
                                className="h-11 px-8 rounded-xl relative overflow-hidden group shadow-lg shadow-primary/20"
                            >
                                <div className="relative z-10 flex items-center gap-2">
                                    {webhookSaving ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : webhookSaved ? (
                                        <Check className="h-4 w-4" />
                                    ) : null}
                                    {webhookSaving ? "جاري الحفظ..." : webhookSaved ? "تم الحفظ" : "حفظ التغييرات"}
                                </div>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={tokenTestLoading || webhookSaving}
                                className="h-11 px-6 rounded-xl"
                                onClick={handleTestAccessToken}
                            >
                                {tokenTestLoading ? (
                                    <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                                ) : null}
                                {tokenTestLoading ? "جاري التحقق..." : "اختبار رمز الوصول"}
                            </Button>
                        </div>

                        {tokenTestResult && (
                            <div
                                className={`p-4 rounded-xl border text-sm ${
                                    tokenTestResult.success
                                        ? "bg-success/10 border-success/20 text-success-foreground"
                                        : "bg-destructive/10 border-destructive/20 text-destructive"
                                }`}
                            >
                                {tokenTestResult.success ? (
                                    <p className="font-medium flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                                        رمز الوصول صالح. الرقم: {tokenTestResult.displayPhoneNumber ?? tokenTestResult.phoneId ?? "—"}
                                    </p>
                                ) : (
                                    <div>
                                        <p className="font-medium flex items-center gap-2">
                                            <XCircle className="h-5 w-5 shrink-0" />
                                            {tokenTestResult.error}
                                        </p>
                                        {"details" in tokenTestResult && tokenTestResult.details != null && (
                                            <p className="mt-2 text-xs opacity-90">
                                                {typeof tokenTestResult.details === "string"
                                                    ? tokenTestResult.details
                                                    : JSON.stringify(tokenTestResult.details)}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 shadow-none overflow-hidden max-w-3xl mx-auto">
                <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-lg">Production Readiness</CardTitle>
                        <Badge className={productionReady ? "bg-success/10 text-success border-success/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"}>
                            {productionReadyCount}/{productionChecks.length}
                        </Badge>
                    </div>
                    <CardDescription>
                        Quick go-live checklist for multi-number WhatsApp + agent setup.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {productionChecks.map((check) => (
                        <div key={check.label} className="flex items-start justify-between gap-3 rounded-xl border p-3 bg-muted/20">
                            <div>
                                <p className="text-sm font-semibold">{check.label}</p>
                                <p className="text-xs text-muted-foreground">{check.detail}</p>
                            </div>
                            <Badge className={check.ok ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                                {check.ok ? "Ready" : "Action Needed"}
                            </Badge>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 shadow-none overflow-hidden max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-lg">Agent Settings</CardTitle>
                    <CardDescription>
                        {selectedAgentWorkspace
                            ? `Editing number: ${selectedAgentWorkspace.phone}`
                            : "Choose a number below to configure its assistant"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <Label>Number for Agent Settings</Label>
                        <select
                            value={agentPhoneNumberId}
                            onChange={(e) => setAgentPhoneNumberId(e.target.value)}
                            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {numbers.length === 0 ? (
                                <option value="">No numbers configured</option>
                            ) : (
                                <>
                                    {numbers.map((n) => (
                                        <option key={n._id} value={n.businessNumberId}>
                                            {n.phone}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                        <p className="text-xs text-muted-foreground">
                            Configure each number separately to keep brand identity isolated.
                        </p>
                    </div>

                    {!effectiveAgentPhoneNumberId ? (
                        <p className="text-sm text-muted-foreground">No active number selected.</p>
                    ) : (
                        <>
                            <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/20">
                                <div>
                                    <p className="font-semibold text-sm">Auto Reply</p>
                                    <p className="text-xs text-muted-foreground">
                                        Enable or disable this assistant for the selected scope.
                                    </p>
                                </div>
                                <Switch checked={agentEnabled} onCheckedChange={handleToggleAgent} />
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Agent Name</Label>
                                    <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Assistant" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Model (LLM)</Label>
                                    <Input value={agentModel} onChange={(e) => setAgentModel(e.target.value)} placeholder="stepfun/step-3.5-flash:free" />
                                    <p className="text-xs text-muted-foreground">OpenRouter model ID. Overrides env default.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>OpenRouter API Key</Label>
                                <Input
                                    type="password"
                                    value={agentOpenRouterKey === "__CONFIGURED__" ? "" : agentOpenRouterKey}
                                    onChange={(e) => setAgentOpenRouterKey(e.target.value)}
                                    placeholder={agentOpenRouterKey === "__CONFIGURED__" ? "•••••••••••••••• (configured — enter new key to replace)" : "sk-or-... (optional — leave empty to use system default)"}
                                    className="font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Applies to selected scope. Leave empty to use system default OPENROUTER_KEY.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>System Prompt</Label>
                                <Textarea
                                    value={agentPrompt}
                                    onChange={(e) => setAgentPrompt(e.target.value)}
                                    className="min-h-[120px]"
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/20">
                                <div>
                                    <p className="font-semibold text-sm">Product Recommendation</p>
                                    <p className="text-xs text-muted-foreground">
                                        Let the assistant recommend products from your catalog.
                                    </p>
                                </div>
                                <Switch checked={agentRecommendProducts} onCheckedChange={setAgentRecommendProducts} />
                            </div>

                            <div className="space-y-2">
                                <Label>Enabled Tools</Label>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {[
                                        "send_text",
                                        "send_image",
                                        "send_link",
                                        "send_audio",
                                        "send_product",
                                        "transfer_to_human",
                                    ].map((tool) => (
                                        <label key={tool} className="flex items-center gap-2 rounded-lg border p-2">
                                            <input
                                                type="checkbox"
                                                checked={agentToolsEnabled.includes(tool)}
                                                onChange={(e) => handleToolToggle(tool, e.target.checked)}
                                            />
                                            <span className="font-mono text-xs">{tool}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <Button onClick={handleSaveAgentSettings} disabled={agentSaving} className="h-11 px-6 rounded-xl">
                                {agentSaving ? "Saving..." : "Save Agent Settings"}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
