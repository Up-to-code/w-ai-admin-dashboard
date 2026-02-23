"use client"

import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "@/mock/convex-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatCard } from "@/components/ui/stat-card"
import {
  Plus,
  Search,
  MessageSquare,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Trash2,
  Calendar as CalendarIcon,
  Play,
  Smartphone
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth } from "date-fns"
import { ar } from "date-fns/locale"
import type { Id } from "@/mock/dataModel"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useAuth } from "@/contexts/AuthContext"
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery"

export default function CampaignsPage() {
  const enableExtendedCampaignApis = process.env.NEXT_PUBLIC_EXTENDED_CAMPAIGN_APIS === "1"
  const { isAdmin } = useAuth()
  const { activePhoneNumberId, numbers } = useWorkspace()
  
  // "__all__" or null = show all. Convex expects undefined, not null.
  const effectivePhoneNumberId =
    !activePhoneNumberId || activePhoneNumberId === "__all__" ? undefined : activePhoneNumberId

  const campaigns = useQuery(api.campaigns.list, effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : {}) as any[] | undefined
  const quickCampaignPhoneNumberId =
    effectivePhoneNumberId ?? (activePhoneNumberId && activePhoneNumberId !== "__all__" ? activePhoneNumberId : numbers[0]?.businessNumberId)
  const sendReadinessQuery = useOptionalConvexQuery<any>(
    (api as any).campaigns.getSendReadiness,
    enableExtendedCampaignApis && quickCampaignPhoneNumberId
      ? { phoneNumberId: quickCampaignPhoneNumberId }
      : "skip",
    enableExtendedCampaignApis
  )
  const sendReadiness = sendReadinessQuery.data
  const recentAuthBlocksQuery = useOptionalConvexQuery<any[]>(
    (api as any).campaigns.listRecentAuthBlocks,
    enableExtendedCampaignApis && isAdmin ? { limit: 8 } : "skip",
    enableExtendedCampaignApis && isAdmin
  )
  const recentAuthBlocks = recentAuthBlocksQuery.data
  const removeCampaign = useMutation(api.campaigns.remove)
  const createQuickScopedCampaign = useAction((api as any).campaigns.createQuickScopedCampaign)
  const [searchQuery, setSearchQuery] = useState("")
  const [view, setView] = useState<"list" | "calendar">("list")
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [quickCampaignError, setQuickCampaignError] = useState<string | null>(null)
  const [isQuickCampaignLoading, setIsQuickCampaignLoading] = useState(false)
  const quickCampaignBlockingReason = sendReadiness?.blockingReason as string | null | undefined
  const isQuickCampaignHardBlocked =
    quickCampaignBlockingReason === "AUTH_FAILED" ||
    quickCampaignBlockingReason === "TOKEN_MISSING" ||
    quickCampaignBlockingReason === "NUMBER_NOT_FOUND"
  const quickCampaignApisUnavailable = !enableExtendedCampaignApis || sendReadinessQuery.unavailable

  const calendarDays = useMemo(() => {
    const startMonth = startOfMonth(currentMonth)
    const endMonthDate = endOfMonth(currentMonth)
    const startDate = startOfWeek(startMonth, { locale: ar })
    const endDate = endOfWeek(endMonthDate, { locale: ar })
    const days: Date[] = []
    let day = startDate
    while (day <= endDate) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  const sortedCampaigns = useMemo(() => {
    if (!campaigns) return []
    return [...campaigns].sort((a, b) => {
      const aTime = a.scheduledAt ?? a.createdAt ?? 0
      const bTime = b.scheduledAt ?? b.createdAt ?? 0
      return bTime - aTime
    })
  }, [campaigns])

  const stats = useMemo(() => {
    if (!campaigns) return { total: 0, sent: 0, readRate: 0, deliveredRate: 0 }
    const total = campaigns.length
    const sent = campaigns.reduce((acc, c) => acc + (c.stats.sent || 0), 0)
    const totalDelivered = campaigns.reduce((acc, c) => acc + (c.stats.delivered || 0), 0)
    const totalRead = campaigns.reduce((acc, c) => acc + (c.stats.read || 0), 0)
    
    return {
      total,
      sent,
      readRate: totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0,
      deliveredRate: sent > 0 ? Math.round((totalDelivered / sent) * 100) : 0
    }
  }, [campaigns])

  const handleQuickCampaign = async () => {
    const phoneNumberId = quickCampaignPhoneNumberId ?? undefined
    if (!phoneNumberId || phoneNumberId === "__all__") {
      setQuickCampaignError("اختر رقم إرسال محدد قبل إنشاء حملة سريعة.")
      return
    }
    if (quickCampaignApisUnavailable) {
      setQuickCampaignError(
        "لا يمكن إنشاء حملة سريعة لأن واجهات التحقق المطلوبة غير متاحة على نسخة Convex الحالية. قم بنشر دوال الحملات على hardy-gopher-480."
      )
      return
    }
    if (isQuickCampaignHardBlocked) {
      setQuickCampaignError(
        (sendReadiness?.recommendedAction as string | undefined) ||
          "This number is not ready for campaign sending."
      )
      return
    }
    setQuickCampaignError(null)
    setIsQuickCampaignLoading(true)
    try {
      await createQuickScopedCampaign({ phoneNumberId })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isFunctionNotFound = message.includes("Could not find public function") || message.includes("createQuickScopedCampaign")
      setQuickCampaignError(
        isFunctionNotFound
          ? "Quick campaign is not deployed yet. Run npx convex dev (or deploy), or create a campaign from New Campaign."
          : message || "تعذر إنشاء حملة سريعة. تأكد من وجود قالب معتمد لهذا الرقم."
      )
    } finally {
      setIsQuickCampaignLoading(false)
    }
  }

  const handleDelete = async (id: Id<"campaigns">) => {
    try {
      await removeCampaign({ id })
    } catch (e) {
      console.error("Failed to delete campaign", e)
    }
  }

  return (
    <div className="space-y-8 p-6 sm:p-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">الحملات التسويقية</h1>
          <p className="text-muted-foreground text-lg">أداة قوية لإدارة رسائل WhatsApp الجماعية</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-muted p-1 rounded-xl flex items-center">
             <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
                <TabsList className="bg-transparent p-0">
                  <TabsTrigger value="list" className="rounded-lg px-4">قائمة</TabsTrigger>
                  <TabsTrigger value="calendar" className="rounded-lg px-4">تقويم</TabsTrigger>
                </TabsList>
             </Tabs>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleQuickCampaign}
            disabled={isQuickCampaignLoading || isQuickCampaignHardBlocked || quickCampaignApisUnavailable}
            className="hidden sm:flex"
          >
            <Play className="h-4 w-4 ml-2 text-primary" />
            {isQuickCampaignLoading ? "جارٍ الإنشاء..." : "حملة سريعة"}
          </Button>

          <Link href="/campaigns/new">
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-none rounded-xl px-6">
              <Plus className="h-5 w-5" />
              حملة جديدة
            </Button>
          </Link>
        </div>
      </div>

      {quickCampaignError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {quickCampaignError}
        </div>
      ) : null}
      {(quickCampaignApisUnavailable || (enableExtendedCampaignApis && recentAuthBlocksQuery.unavailable)) ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          بعض وظائف الحملات غير متاحة في نسخة Convex الحالية. تم تعطيل الإجراءات الحساسة حتى نشر الدوال المطلوبة على `hardy-gopher-480`.
        </div>
      ) : null}
      {isQuickCampaignHardBlocked && !quickCampaignError ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {(sendReadiness?.recommendedAction as string | undefined) ||
            "Quick campaign is blocked for this number until auth/token readiness is fixed."}
        </div>
      ) : null}

      {isAdmin && (recentAuthBlocks?.length ?? 0) > 0 ? (
        <Card className="p-4 border border-destructive/20 bg-destructive/5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-destructive">Auth Incident Panel</h2>
            <Link href="/integrations" className="text-xs underline underline-offset-2 text-destructive">
              Reconnect numbers
            </Link>
          </div>
          <div className="space-y-2">
            {recentAuthBlocks!.map((row) => (
              <div key={`${row.source}-${row.phoneNumberId}-${row.createdAt}-${row.campaignId ?? "none"}`} className="rounded-lg border border-destructive/20 bg-background/70 px-3 py-2 text-xs">
                <div className="font-medium">
                  {(row.phoneNumberName || row.phoneNumberId) as string}
                </div>
                <div className="text-muted-foreground">
                  {(row.error || row.lastAuthErrorMessage || "Authentication issue detected") as string}
                </div>
                <div className="text-muted-foreground mt-1">
                  {row.campaignName ? `Campaign: ${row.campaignName} · ` : ""}
                  {new Date(row.createdAt).toLocaleString("en-US")}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="إجمالي الحملات" 
          value={stats.total} 
          icon={<MessageSquare className="h-4 w-4 text-primary" />} 
        />
        <StatCard 
          title="رسائل مرسلة" 
          value={stats.sent.toLocaleString()} 
          icon={<CheckCircle2 className="h-4 w-4 text-success" />} 
          trend="+12%"
        />
        <StatCard 
          title="معدل الوصول" 
          value={`${stats.deliveredRate}%`} 
          icon={<Users className="h-4 w-4 text-blue-500" />}
          trend="+5%" 
        />
        <StatCard 
          title="معدل القراءة" 
          value={`${stats.readRate}%`} 
          icon={<BarChart3 className="h-4 w-4 text-orange-500" />}
          variant="primary"
          trend="+8%"
        />
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {view === "list" && (
          <>
             <div className="relative max-w-md">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في الحملات..."
                  className="pl-4 pr-10 bg-white dark:bg-muted/30 border-none shadow-none ring-1 ring-border/50 focus:ring-primary/20 rounded-xl h-11"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {!campaigns ? (
                <div className="grid grid-cols-1 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-2xl bg-muted/20 animate-pulse" />
                  ))}
                </div>
              ) : sortedCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/5 rounded-3xl border border-dashed border-muted-foreground/20">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <MessageSquare className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">لا توجد حملات حتى الآن</h3>
                  <p className="text-muted-foreground max-w-sm mb-8">
                    ابدأ بإنشاء حملتك الأولى للتواصل مع عملائك عبر WhatsApp بسهولة.
                  </p>
                  <Link href="/campaigns/new">
                    <Button size="lg" className="rounded-xl px-8">إنشاء حملة جديدة</Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {sortedCampaigns
                    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((campaign) => (
                      <Card key={campaign._id} className="p-0 overflow-hidden border-none ring-1 ring-border/50 shadow-none hover:bg-muted/30 transition-colors">
                        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-6">
                          {/* Icon & Name */}
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                              campaign.status === 'COMPLETED' ? 'bg-success/10 text-success' :
                              campaign.status === 'PROCESSING' ? 'bg-blue-500/10 text-blue-600' :
                              campaign.status === 'FAILED' ? 'bg-destructive/10 text-destructive' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {campaign.status === 'PROCESSING' ? (
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                </span>
                              ) : (
                                <MessageSquare className="h-6 w-6" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <Link href={`/campaigns/${campaign._id}`} className="font-bold text-lg hover:text-primary transition-colors">
                                  {campaign.name}
                                </Link>
                                <Badge variant={
                                  campaign.status === 'COMPLETED' ? 'secondary' :
                                  campaign.status === 'PROCESSING' ? 'default' :
                                  campaign.status === 'FAILED' ? 'destructive' : 'outline'
                                } className="rounded-md font-normal px-2">
                                  {campaign.status}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <CalendarIcon className="h-3.5 w-3.5" />
                                  {format(campaign.createdAt, "d MMM yyyy", { locale: ar })}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5" />
                                  {campaign.stats.total} مستلم
                                </span>
                                {numbers.length > 1 && (
                                  <span className="flex items-center gap-1.5" dir="ltr">
                                    <Smartphone className="h-3.5 w-3.5" />
                                    من: {numbers.find((n) => n.businessNumberId === campaign.phoneNumberId)?.name ?? campaign.phoneNumberId ?? "افتراضي"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Mini Stats */}
                          <div className="flex items-center gap-8 text-sm sm:mr-auto">
                            <div className="text-center min-w-[60px]">
                              <div className="font-bold text-lg">{campaign.stats.sent}</div>
                              <div className="text-xs text-muted-foreground">تم الإرسال</div>
                            </div>
                            <div className="text-center min-w-[60px]">
                              <div className="font-bold text-lg text-success">
                                {Math.round((campaign.stats.read / Math.max(1, campaign.stats.delivered)) * 100)}%
                              </div>
                              <div className="text-xs text-muted-foreground">قراءة</div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 border-r pr-4 mr-4 sm:border-r-0 sm:pr-0 sm:mr-0">
                             <Link href={`/campaigns/${campaign._id}`}>
                                <Button variant="ghost" size="sm">التفاصيل</Button>
                             </Link>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="rounded-lg">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDelete(campaign._id as Id<"campaigns">)}
                                    disabled={campaign.status === 'PROCESSING'}
                                  >
                                    <Trash2 className="h-4 w-4 ml-2" />
                                    حذف الحملة
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                          </div>
                        </div>
                        
                        {/* Progress Bar for Processing */}
                        {campaign.status === 'PROCESSING' && (
                          <div className="h-1 w-full bg-muted/50">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-1000 ease-in-out" 
                              style={{ width: `${(campaign.stats.sent / Math.max(1, campaign.stats.total)) * 100}%` }}
                            />
                          </div>
                        )}
                      </Card>
                    ))}
                </div>
              )}
          </>
        )}

        {view === "calendar" && (
          <div className="bg-card rounded-3xl border p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                 <div className="bg-muted rounded-xl flex">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-r-xl rounded-l-none">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="px-4 py-2 font-bold min-w-[140px] text-center border-x border-background">
                      {format(currentMonth, "MMMM yyyy", { locale: ar })}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-l-xl rounded-r-none">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                 </div>
              </div>
              <Badge variant="secondary" className="text-base py-1 px-4 rounded-lg">
                 {campaigns?.length || 0} حملات مجدولة
              </Badge>
            </div>

            <div className="grid grid-cols-7 gap-px bg-muted/20 rounded-2xl overflow-hidden border">
               {["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"].map((d) => (
                  <div key={d} className="bg-muted/5 p-4 text-center text-sm font-bold text-muted-foreground">{d}</div>
               ))}
               {calendarDays.map((day) => {
                  const dayCampaigns = sortedCampaigns.filter(c => isSameDay(new Date(c.scheduledAt), day))
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isToday = isSameDay(day, new Date())
                  
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`min-h-[140px] bg-background p-3 transition-colors hover:bg-muted/20 ${!isCurrentMonth ? 'bg-muted/5 opacity-50' : ''}`}
                    >
                       <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                            {format(day, "d")}
                          </span>
                          {dayCampaigns.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{dayCampaigns.length}</Badge>
                          )}
                       </div>
                       
                       <div className="space-y-1.5">
                          {dayCampaigns.map(c => (
                            <Link key={c._id} href={`/campaigns/${c._id}`}>
                              <div className={`text-xs p-2 rounded-lg border truncate transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ${
                                c.status === 'COMPLETED' ? 'bg-success/5 border-success/20 text-success-foreground' :
                                c.status === 'PROCESSING' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' :
                                'bg-muted/30 border-transparent hover:bg-muted'
                              }`}>
                                {c.name}
                              </div>
                            </Link>
                          ))}
                       </div>
                    </div>
                  )
               })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
