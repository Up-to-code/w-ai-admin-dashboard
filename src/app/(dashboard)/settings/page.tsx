"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/mock/convex-api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Webhook,
  Shield,
  UserCog,
  Link2,
  Copy,
  ExternalLink,
  MessageSquare,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery";
import { FeatureUnavailableBanner } from "@/components/FeatureUnavailableBanner";
import { toUserSafeConvexMessage } from "@/lib/convexErrors";

function getWebhookUrl(): string {
  const base = typeof process.env.NEXT_PUBLIC_CONVEX_URL === "string"
    ? process.env.NEXT_PUBLIC_CONVEX_URL
    : "";
  if (!base) return "";
  const site = base.replace(".convex.cloud", ".convex.site");
  return `${site}/whatsapp/webhook`;
}

type Role = "admin" | "agent" | "user";

export default function SettingsPage() {
  const { activeWorkspace, numbers } = useWorkspace();
  const currentUser = useQuery(api.users.getCurrentUserRole);
  const sallaConnection = useQuery(api.salla.getConnection);
  const notificationPreferencesQuery = useOptionalConvexQuery<{
    humanHandoffPushEnabled: boolean;
    suppressPushWhenChatActive: boolean;
  }>(
    (api as any).notificationPreferences.get,
    {}
  );
  const notificationPreferences = notificationPreferencesQuery.data;
  const updateNotificationPreferences = useMutation((api as any).notificationPreferences.set);
  const [notificationSaving, setNotificationSaving] = useState(false);

  const role: Role | null = currentUser?.role ?? null;
  const isAdmin = role === "admin";
  const canManageUsers = isAdmin;
  const canManageIntegrations = isAdmin;
  const canManageNotificationSettings = isAdmin;
  const canSeeWebhook = role === "admin" || role === "agent";
  const canCopyWebhook = canSeeWebhook;
  const prefs = notificationPreferences ?? {
    humanHandoffPushEnabled: true,
    suppressPushWhenChatActive: true,
  };

  const webhookUrl = getWebhookUrl();

  const handleCopyWebhook = () => {
    if (!webhookUrl) {
      toast.error("رابط الويب هوك غير متوفر");
      return;
    }
    navigator.clipboard.writeText(webhookUrl);
    toast.success("تم نسخ الرابط");
  };

  const updatePushPreferences = async (patch: {
    humanHandoffPushEnabled?: boolean;
    suppressPushWhenChatActive?: boolean;
  }) => {
    if (!canManageNotificationSettings) return;
    setNotificationSaving(true);
    try {
      await updateNotificationPreferences(patch);
      toast.success("تم تحديث إعدادات إشعارات الجوال");
    } catch (error) {
      toast.error(
        toUserSafeConvexMessage(
          error,
          "تعذر حفظ الإعدادات",
          "ميزة إعدادات الإشعارات غير متاحة حالياً على نسخة الخادم الحالية."
        )
      );
    } finally {
      setNotificationSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground text-sm mt-1">إعدادات النظام والتكاملات</p>
      </div>

      {/* 1. Workspace & context */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>الفضاء الحالي</CardTitle>
              <CardDescription>رقم واتساب الأعمال النشط</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeWorkspace ? (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{activeWorkspace.name}</p>
                  <p className="text-sm text-muted-foreground">{activeWorkspace.phone}</p>
                </div>
              </div>
            </div>
          ) : numbers.length > 0 ? (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">كل الأرقام</p>
                  <p className="text-sm text-muted-foreground">عرض مجمّع لجميع الأرقام</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">لا يوجد رقم نشط. أضف رقماً من التكاملات.</p>
          )}
          {canManageIntegrations && (
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/integrations">
                <Link2 className="h-4 w-4" />
                إدارة الأرقام
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 2. Integrations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>التكاملات</CardTitle>
              <CardDescription>حالة اتصال واتساب وسلة</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <span className="text-sm font-medium">أرقام واتساب</span>
              <span className="text-sm text-muted-foreground">{numbers.length} متصل</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <span className="text-sm font-medium">سلة</span>
              <span className="text-sm text-muted-foreground">
                {sallaConnection ? "متصل" : "غير متصل"}
              </span>
            </div>
          </div>
          {canManageIntegrations && (
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/integrations">
                <ExternalLink className="h-4 w-4" />
                إدارة التكاملات
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 3. Webhook */}
      {canSeeWebhook && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                <Webhook className="h-5 w-5 text-info" />
              </div>
              <div>
                <CardTitle>Webhook</CardTitle>
                <CardDescription>استقبال الرسائل والتحديثات من Meta</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">رابط Webhook</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={webhookUrl || "—"}
                  className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono"
                />
                {canCopyWebhook && (
                  <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">استخدم هذا الرابط في إعدادات تطبيق Meta Developer</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Verify Token</p>
              <p className="text-xs text-muted-foreground">
                يُحفظ في قاعدة البيانات من صفحة التكاملات (ربط المتجر). يمكن أيضاً استخدام متغير البيئة <code className="bg-muted px-1 rounded">WHATSAPP_VERIFY_TOKEN</code> في Convex. استخدم نفس القيمة في تحقق الويب هوك في تطبيق Meta.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              يستقبل هذا الويب هوك الرسائل لجميع الأرقام؛ التوجيه يتم حسب phone_number_id من Meta.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 4. Mobile push policy */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>إشعارات الجوال</CardTitle>
              <CardDescription>سياسة إشعارات التدخل البشري في تطبيق Expo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationPreferencesQuery.unavailable && (
            <FeatureUnavailableBanner message="إعدادات إشعارات الجوال غير متاحة في نسخة Convex الحالية. سيتم استخدام القيم الافتراضية." />
          )}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="human-handoff-push" className="text-sm font-medium">
                إشعار عند الحاجة لتدخل بشري
              </Label>
              <p className="text-xs text-muted-foreground">
                مفعّل افتراضياً. عند تحويل المحادثة لموظف، يُرسل إشعار للجوال.
              </p>
            </div>
            <Switch
              id="human-handoff-push"
              checked={prefs.humanHandoffPushEnabled}
              disabled={!canManageNotificationSettings || notificationSaving || notificationPreferences === undefined || notificationPreferencesQuery.unavailable}
              onCheckedChange={(checked) => updatePushPreferences({ humanHandoffPushEnabled: checked })}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="suppress-active-chat-push" className="text-sm font-medium">
                إيقاف الإشعار أثناء المتابعة الحية
              </Label>
              <p className="text-xs text-muted-foreground">
                لا يتم إرسال إشعار إذا كان مدير/موظف يتابع نفس المحادثة حالياً.
              </p>
            </div>
            <Switch
              id="suppress-active-chat-push"
              checked={prefs.suppressPushWhenChatActive}
              disabled={!canManageNotificationSettings || notificationSaving || notificationPreferences === undefined || notificationPreferencesQuery.unavailable}
              onCheckedChange={(checked) => updatePushPreferences({ suppressPushWhenChatActive: checked })}
            />
          </div>

          {!canManageNotificationSettings && (
            <p className="text-xs text-muted-foreground">فقط المدير يمكنه تعديل إعدادات إشعارات الجوال.</p>
          )}
        </CardContent>
      </Card>

      {/* 5. Security & environment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle>الأمان والبيئة</CardTitle>
              <CardDescription>إعدادات حساسة</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            الإعدادات الحساسة (رموز الوصول، Verify Token، رابط الويب هوك، App ID) تُخزَّن في قاعدة البيانات من صفحة التكاملات أو في متغيرات بيئة Convex. لا تُدخل أسراراً في هذه الواجهة.
          </p>
        </CardContent>
      </Card>

      {/* 6. Team & permissions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>الفريق والصلاحيات</CardTitle>
              <CardDescription>إدارة المستخدمين والأدوار</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {role && (
            <p className="text-sm text-muted-foreground">
              دورك الحالي: <span className="font-medium text-foreground">{role === "admin" ? "مدير" : role === "agent" ? "وكيل" : "مستخدم"}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            إدارة من يمكنه الوصول إلى لوحة التحكم وأدوارهم (مدير، وكيل، مستخدم) تتم من صفحة إدارة المستخدمين.
          </p>
          {canManageUsers && (
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/users">
                <UserCog className="h-4 w-4" />
                إدارة المستخدمين والصلاحيات
              </Link>
            </Button>
          )}
          {!canManageUsers && role === "user" && (
            <p className="text-xs text-muted-foreground">فقط المديرون يمكنهم إدارة المستخدمين.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
