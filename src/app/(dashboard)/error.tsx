"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[DashboardErrorBoundary]", error);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-lg font-bold">تعذر تحميل صفحة لوحة التحكم</h2>
        <p className="text-sm text-muted-foreground">
          غالباً يوجد تعارض مؤقت بين نسخة الواجهة ونسخة Convex. أعد المحاولة أو انتقل لصفحة أخرى.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={reset}>
            إعادة المحاولة
          </Button>
          <Button asChild>
            <Link href="/campaigns">الحملات</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
