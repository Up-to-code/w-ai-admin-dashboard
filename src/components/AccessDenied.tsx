"use client"

import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"

export function AccessDenied() {
  const { logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8" dir="rtl">
      <div className="w-28 h-28 rounded-full bg-muted flex items-center justify-center mb-6">
        <Lock className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">الوصول مرفوض</h1>
      <p className="text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
        ليس لديك صلاحية للوصول إلى هذا التطبيق.
        <br />
        يرجى التواصل مع المسؤول.
      </p>
      <Button onClick={handleLogout} size="lg" className="gap-2">
        تسجيل الخروج
      </Button>
    </div>
  )
}
