"use client"

import { useParams, useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/mock/convex-api"
import { Id } from "@/mock/dataModel"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  ArrowRight, 
  Clock, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  Users,
  BarChart3,
  Calendar,
  Phone,
  Send,
  Eye,
  XCircle,
  SkipForward,
  Shield
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import React, { useState } from "react"

type StatusFilter = "all" | "sent" | "delivered" | "read" | "failed" | "skipped"

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawCampaignId = params?.campaignId
  const id = typeof rawCampaignId === "string" ? rawCampaignId : undefined
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const campaigns = useQuery(api.campaigns.list, {})
  const campaign = (campaigns || []).find(c => String(c._id) === id)
  
  // Fetch campaign logs - only when we have a valid campaign
  const campaignLogs = useQuery(
    api.campaigns.getCampaignLogs,
    campaign ? { campaignId: campaign._id as Id<"campaigns"> } : "skip"
  )

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
        <div className="bg-muted/30 p-8 rounded-full mb-4">
          <SearchX className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">رابط الحملة غير صالح</h2>
        <p className="text-muted-foreground mb-6">تأكد من الرابط ثم حاول مرة أخرى</p>
        <Link href="/campaigns">
          <Button variant="outline">العودة إلى الحملات</Button>
        </Link>
      </div>
    )
  }

  if (campaigns === undefined) {
      return <div className="p-8 text-center animate-pulse">جاري التحميل...</div>
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
        <div className="bg-muted/30 p-8 rounded-full mb-4">
            <SearchX className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">لم يتم العثور على الحملة</h2>
        <p className="text-muted-foreground mb-6">قد تكون هذه الحملة قد حذفت أو أن الرابط غير صحيح</p>
        <Link href="/campaigns">
          <Button variant="outline">العودة إلى الحملات</Button>
        </Link>
      </div>
    )
  }

  const progress = campaign.stats.total > 0 
    ? (campaign.stats.sent / campaign.stats.total) * 100 
    : 0
  const effectiveSendingConfig = {
    messagesPerSecond: campaign.sendingConfig?.messagesPerSecond ?? 10,
    delayBetweenMessages: campaign.sendingConfig?.delayBetweenMessages ?? 100,
    maxRetries: campaign.sendingConfig?.maxRetries ?? 3,
    skipRecentlyContacted: campaign.sendingConfig?.skipRecentlyContacted ?? true,
    recentContactHours: campaign.sendingConfig?.recentContactHours ?? 24,
  }

  return (
    <div className="space-y-8 p-6 sm:p-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/campaigns")} className="mt-1 rounded-xl">
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
                  <Badge variant={
                    campaign.status === 'COMPLETED' ? 'secondary' :
                    campaign.status === 'PROCESSING' ? 'default' :
                    campaign.status === 'FAILED' ? 'destructive' : 'outline'
                  } className="text-sm px-3 py-0.5">
                    {campaign.status === 'COMPLETED' && 'مكتملة'}
                    {campaign.status === 'PROCESSING' && 'جاري الإرسال'}
                    {campaign.status === 'SCHEDULED' && 'مجدولة'}
                    {campaign.status === 'DRAFT' && 'مسودة'}
                    {campaign.status === 'FAILED' && 'فشلت'}
                  </Badge>
              </div>
              <div className="flex items-center gap-6 text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Calendar className="h-4 w-4" />
                    تم الإنشاء: {format(campaign.createdAt, "PPP", { locale: ar })}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-4 w-4" />
                    الجدولة: {format(campaign.scheduledAt, "PPP p", { locale: ar })}
                  </span>
              </div>
            </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
            title="إجمالي الجمهور" 
            value={campaign.stats.total} 
            icon={<Users className="h-4 w-4 text-primary" />} 
        />
        <StatCard 
            title="تم الإرسال" 
            value={campaign.stats.sent} 
            icon={<CheckCircle2 className="h-4 w-4 text-success" />} 
            trend={`${Math.round(progress)}%`}
        />
        <StatCard 
            title="تم التخطي" 
            value={campaign.stats.skipped || 0} 
            icon={<SkipForward className="h-4 w-4 text-yellow-500" />} 
            variant="default"
        />
        <StatCard 
            title="فشل الإرسال" 
            value={campaign.stats.failed} 
            icon={<AlertCircle className="h-4 w-4 text-destructive" />} 
            variant="default"
        />
        <StatCard 
            title="نسبة القراءة" 
            value={`${Math.round((campaign.stats.read / Math.max(1, campaign.stats.delivered)) * 100)}%`} 
            icon={<BarChart3 className="h-4 w-4 text-orange-500" />}
            variant="primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details & Progress */}
        <div className="lg:col-span-2 space-y-6">
            {/* Progress Card */}
            {campaign.status === "PROCESSING" && (
                <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                            </span>
                            جاري إرسال الحملة
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">{campaign.stats.sent} من {campaign.stats.total}</span>
                            <span className="font-bold text-blue-600">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-3" />
                        <p className="text-xs text-muted-foreground mt-4">
                            يتم إرسال الرسائل على دفعات (Batches) لضمان سلامة الرقم وتجنب الحظر.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Anti-Spam Protection Card */}
            {campaign.status === "PROCESSING" && (
                <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-900/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-green-700 dark:text-green-300 flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            حماية من الحظر مفعلة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                        <div className="flex justify-between py-1 border-b border-green-100 dark:border-green-800">
                            <span>معدل الإرسال:</span>
                            <span className="font-medium text-green-700 dark:text-green-300">{effectiveSendingConfig.messagesPerSecond} رسائل/ثانية</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-green-100 dark:border-green-800">
                            <span>التأخير بين الرسائل:</span>
                            <span className="font-medium text-green-700 dark:text-green-300">{effectiveSendingConfig.delayBetweenMessages}ms</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-green-100 dark:border-green-800">
                            <span>إعادة المحاولة:</span>
                            <span className="font-medium text-green-700 dark:text-green-300">{effectiveSendingConfig.maxRetries}</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span>تخطي المتصل مؤخراً:</span>
                            <span className="font-medium text-green-700 dark:text-green-300">
                              {effectiveSendingConfig.skipRecentlyContacted ? `${effectiveSendingConfig.recentContactHours} ساعة` : "معطل"}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Template Details */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle>تفاصيل الرسالة</CardTitle>
                            <CardDescription>القالب المستخدم في هذه الحملة</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="bg-muted/30 rounded-xl p-6 border">
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-semibold">{campaign.templateName}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{campaign.templateLanguage || "unknown"}</Badge>
                              <Badge variant="outline">WhatsApp Template</Badge>
                            </div>
                        </div>
                        <Separator className="mb-4" />
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                            {/* We don't have full template content here unless we fetch template separately or store it in campaign. 
                                Assuming campaign stores templateName, we might need to fetch template content if we want to show it fully.
                                For now, we rely on what we have or just show name. 
                                Actually, 'create' mutation stores templateName but not content.
                                If we really want content, we'd need to join or fetch template.
                                For this UI revamp, let's keep it simple or show a placeholder if we can't get content easily.
                            */}
                            محتوى القالب غير متوفر للعرض المباشر هنا (يتم استخدامه عبر المعرف).
                            يمكنك مراجعة القالب في قسم القوالب.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Right Column: Meta Info */}
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">معلومات تقنية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">معرف الحملة</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{String(campaign._id).slice(-8)}</code>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">تكرار (Cron)</span>
                        <span className="text-sm font-medium">{campaign.recurrenceCronSpec || "غير مكرر"}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-muted-foreground">الحالة</span>
                        <Badge variant="outline">{campaign.status}</Badge>
                    </div>
                </CardContent>
            </Card>

            {campaign.status === 'FAILED' && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            تشخيص الخطأ
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            واجهت الحملة أخطاء أثناء الإرسال. يرجى مراجعة سجلات النظام أو التأكد من رصيد الرسائل وحالة القالب.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
      </div>

      {/* Message Logs Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>سجل الرسائل</CardTitle>
                <CardDescription>تفاصيل إرسال الرسائل لكل جهة اتصال</CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={statusFilter === "all" ? "default" : "outline"} 
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                الكل
              </Button>
              <Button 
                variant={statusFilter === "sent" ? "default" : "outline"} 
                size="sm"
                onClick={() => setStatusFilter("sent")}
              >
                <Send className="h-3 w-3 ml-1" />
                مُرسل
              </Button>
              <Button 
                variant={statusFilter === "delivered" ? "default" : "outline"} 
                size="sm"
                onClick={() => setStatusFilter("delivered")}
              >
                <CheckCircle2 className="h-3 w-3 ml-1" />
                مُستلم
              </Button>
              <Button 
                variant={statusFilter === "read" ? "default" : "outline"} 
                size="sm"
                onClick={() => setStatusFilter("read")}
              >
                <Eye className="h-3 w-3 ml-1" />
                مقروء
              </Button>
              <Button 
                variant={statusFilter === "failed" ? "default" : "outline"} 
                size="sm"
                onClick={() => setStatusFilter("failed")}
              >
                <XCircle className="h-3 w-3 ml-1" />
                فشل
              </Button>
              <Button 
                variant={statusFilter === "skipped" ? "default" : "outline"} 
                size="sm"
                onClick={() => setStatusFilter("skipped")}
              >
                <SkipForward className="h-3 w-3 ml-1" />
                تم التخطي
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {campaignLogs === undefined ? (
            <div className="text-center py-8 text-muted-foreground animate-pulse">
              جاري تحميل السجلات...
            </div>
          ) : campaignLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد سجلات رسائل بعد
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">جهة الاتصال</TableHead>
                    <TableHead className="text-right">رقم الهاتف</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">معرف الرسالة</TableHead>
                    <TableHead className="text-right">الخطأ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignLogs
                    .filter(log => statusFilter === "all" || log.status === statusFilter)
                    .map((log) => (
                      <TableRow key={String(log._id)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-4 w-4 text-muted-foreground" />
                            </div>
                            {log.contactName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{log.contactPhone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              log.status === "read" ? "default" :
                              log.status === "delivered" ? "secondary" :
                              log.status === "sent" ? "outline" :
                              log.status === "skipped" ? "outline" :
                              "destructive"
                            }
                            className={`gap-1 ${log.status === "skipped" ? "border-yellow-500 text-yellow-600" : ""}`}
                          >
                            {log.status === "sent" && <Send className="h-3 w-3" />}
                            {log.status === "delivered" && <CheckCircle2 className="h-3 w-3" />}
                            {log.status === "read" && <Eye className="h-3 w-3" />}
                            {log.status === "failed" && <XCircle className="h-3 w-3" />}
                            {log.status === "skipped" && <SkipForward className="h-3 w-3" />}
                            {log.status === "sent" && "مُرسل"}
                            {log.status === "delivered" && "مُستلم"}
                            {log.status === "read" && "مقروء"}
                            {log.status === "failed" && "فشل"}
                            {log.status === "skipped" && "تم التخطي"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.metaMessageId ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded" dir="ltr">
                              {log.metaMessageId.slice(-12)}...
                            </code>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.error ? (
                            <span className="text-destructive text-sm" title={log.error}>
                              {log.error.length > 30 ? log.error.slice(0, 30) + "..." : log.error}
                            </span>
                          ) : log.status === "skipped" && log.skipReason ? (
                            <span className="text-yellow-600 text-sm">
                              {log.skipReason === "recently_contacted" && "تم التواصل مؤخراً"}
                              {log.skipReason === "rate_limited" && "تجاوز حد المعدل"}
                              {!["recently_contacted", "rate_limited"].includes(log.skipReason) && log.skipReason}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {campaignLogs.filter(log => statusFilter === "all" || log.status === statusFilter).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد رسائل بهذه الحالة
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SearchX(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m13.5 8.5-5 5" />
        <path d="m8.5 8.5 5 5" />
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    )
}
