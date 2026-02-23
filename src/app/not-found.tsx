import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, MessageSquare, ArrowRight, AlertCircle } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 font-sans" dir="rtl">
      <div className="max-w-lg w-full text-center">
        {/* Error Icon */}
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-3xl flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Error Code */}
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-muted/50">404</h1>
          <h2 className="text-2xl font-semibold text-foreground mt-4">الصفحة غير موجودة</h2>
          <p className="text-muted-foreground mt-2">
            الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى عنوان آخر.
          </p>
        </div>

        {/* Navigation Options */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button className="w-full sm:w-auto gap-2">
                <Home className="h-4 w-4" />
                الذهاب للرئيسية
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="outline" className="w-full sm:w-auto gap-2">
                <MessageSquare className="h-4 w-4" />
                فتح المحادثات
              </Button>
            </Link>
          </div>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-border">
          <h3 className="text-sm font-medium text-foreground mb-4">أو جرب هذه الأقسام:</h3>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/campaigns" className="text-primary hover:text-primary/80 transition-colors">
              الحملات
            </Link>
            <Link href="/storage" className="text-primary hover:text-primary/80 transition-colors">
              الملفات
            </Link>
            <Link href="/ai-settings" className="text-primary hover:text-primary/80 transition-colors">
              الذكاء الاصطناعي
            </Link>
            <Link href="/integrations" className="text-primary hover:text-primary/80 transition-colors">
              الربط والتكامل
            </Link>
            <Link href="/settings" className="text-primary hover:text-primary/80 transition-colors">
              الإعدادات
            </Link>
          </div>
        </div>

        {/* Branding */}
        <div className="mt-8 pt-8 border-t border-border">
          <div className="flex items-center justify-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">ChatCB</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            لوحة تحكم إدارة واتساب للأعمال
          </p>
        </div>
      </div>
    </div>
  )
}