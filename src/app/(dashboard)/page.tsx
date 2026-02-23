"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import {
    MessageSquare,
    Users,
    Send,
    CheckCircle2,
    Eye,
    Clock,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    Radio,
    FileText,
    Zap,
    Plus,
    MoreHorizontal,
    ArrowRight
} from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@/mock/convex-api"
import { useWorkspace } from "@/contexts/WorkspaceContext"

export default function DashboardPage() {
    const { activePhoneNumberId } = useWorkspace()
    
    // "__all__" or null = show all stats (no filter). Convex expects undefined, not null.
    const effectivePhoneNumberId =
      !activePhoneNumberId || activePhoneNumberId === "__all__" ? undefined : activePhoneNumberId

    const stats = useQuery(api.stats.getDashboardStats, effectivePhoneNumberId ? { phoneNumberId: effectivePhoneNumberId } : {})

    // Fallback/Loading State
    if (!stats) {
        return <div className="p-4 sm:p-6 space-y-6 animate-pulse">
            <div className="h-20 bg-muted rounded-lg"></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="h-32 bg-muted rounded-xl"></div>
                <div className="h-32 bg-muted rounded-xl"></div>
                <div className="h-32 bg-muted rounded-xl"></div>
                <div className="h-32 bg-muted rounded-xl"></div>
            </div>
        </div>
    }

    const maxCampaigns = Math.max(...(stats.chartData || []).map((d: any) => d.campaigns))

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-background min-h-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">مرحباً بك 👋</h1>
                    <p className="text-muted-foreground mt-1">إليك نظرة عامة على أداء واتساب للأعمال</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/campaigns/new">
                        <Button className="gap-2 bg-[#004D3D] hover:bg-[#003D2D]">
                            <Plus className="h-4 w-4" />
                            حملة جديدة
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-muted-foreground">إجمالي الرسائل</p>
                                <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.totalMessages.toLocaleString()}</p>
                                <div className="flex items-center gap-1 mt-2 text-success text-sm">
                                    <TrendingUp className="h-4 w-4" />
                                    +12%
                                </div>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-muted-foreground">العملاء</p>
                                <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.totalContacts.toLocaleString()}</p>
                                <div className="flex items-center gap-1 mt-2 text-success text-sm">
                                    <TrendingUp className="h-4 w-4" />
                                    +8%
                                </div>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-success/10 flex items-center justify-center">
                                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-muted-foreground">معدل التسليم</p>
                                <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.deliveryRate ? stats.deliveryRate.toFixed(1) : 0}%</p>
                                <div className="flex items-center gap-1 mt-2 text-muted-foreground text-sm">
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                    ممتاز
                                </div>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-info/10 flex items-center justify-center">
                                <Send className="h-5 w-5 sm:h-6 sm:w-6 text-info" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-muted-foreground">معدل القراءة</p>
                                <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.readRate ? stats.readRate.toFixed(1) : 0}%</p>
                                <div className="flex items-center gap-1 mt-2 text-muted-foreground text-sm">
                                    <Eye className="h-4 w-4" />
                                    جيد جداً
                                </div>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                                <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle>أداء الأسبوع</CardTitle>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-primary" />
                                <span className="text-muted-foreground">حملات</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] flex items-end justify-between gap-2">
                            {stats.chartData?.map((data: any, i: number) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full flex gap-0.5 items-end h-[160px]">
                                        <div
                                            className="flex-1 bg-primary rounded-t transition-all hover:opacity-80 mx-2"
                                            style={{ height: `${(data.campaigns / (maxCampaigns || 1)) * 100}%` }}
                                            title={`حملات: ${data.campaigns}`}
                                        />
                                    </div>
                                    <span className="text-xs text-muted-foreground">{data.day}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                                        <Radio className="h-5 w-5 text-info" />
                                    </div>
                                    <div>
                                        <p className="font-medium">الحملات</p>
                                        <p className="text-sm text-muted-foreground">{stats.totalCampaigns} حملة</p>
                                    </div>
                                </div>
                                <Link href="/campaigns">
                                    <Button variant="ghost" size="icon">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                                        <Zap className="h-5 w-5 text-success" />
                                    </div>
                                    <div>
                                        <p className="font-medium">أتمتة نشطة</p>
                                        <p className="text-sm text-muted-foreground">5 قواعد</p>
                                    </div>
                                </div>
                                <Link href="/workflows">
                                    <Button variant="ghost" size="icon">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                                        <FileText className="h-5 w-5 text-warning" />
                                    </div>
                                    <div>
                                        <p className="font-medium">قوالب</p>
                                        <p className="text-sm text-muted-foreground">إدارة القوالب</p>
                                    </div>
                                </div>
                                <Link href="/templates">
                                    <Button variant="ghost" size="icon">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>النشاط الأخير</CardTitle>
                        <Button variant="ghost" size="sm" className="gap-1">
                            عرض الكل
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {stats.recentActivity?.map((activity: any) => (
                            <div key={activity.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activity.type === 'message' ? 'bg-primary/10' :
                                    activity.type === 'broadcast' ? 'bg-info/10' :
                                        activity.type === 'template' ? 'bg-success/10' :
                                            activity.type === 'workflow' ? 'bg-warning/10' :
                                                'bg-muted'
                                    }`}>
                                    {activity.type === 'message' && <MessageSquare className="h-5 w-5 text-primary" />}
                                    {activity.type === 'broadcast' && <Radio className="h-5 w-5 text-info" />}
                                    {activity.type === 'template' && <FileText className="h-5 w-5 text-success" />}
                                    {activity.type === 'customer' && <Users className="h-5 w-5 text-muted-foreground" />}
                                    {activity.type === 'workflow' && <Zap className="h-5 w-5 text-warning" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{activity.action}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(activity.time).toLocaleString('ar-EG')}</p>
                                </div>
                            </div>
                        ))}
                        {(!stats.recentActivity || stats.recentActivity.length === 0) && (
                            <div className="text-center py-4 text-muted-foreground">لا يوجد نشاط حديث</div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
