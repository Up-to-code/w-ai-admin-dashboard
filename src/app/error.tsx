"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[AppErrorBoundary]", error);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background" dir="rtl">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>
        <p className="text-sm text-muted-foreground">
          تم إيقاف الصفحة لحمايتك من الانهيار. يمكنك إعادة المحاولة أو الرجوع للرئيسية.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={reset}>
            إعادة المحاولة
          </Button>
          <Button asChild>
            <Link href="/">العودة للرئيسية</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
