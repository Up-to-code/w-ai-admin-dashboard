"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { AccessDenied } from "@/components/AccessDenied"
import { Loader2 } from "lucide-react"

const PUBLIC_PATHS = ["/login", "/register", "/terms", "/privacy", "/error"]

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isAdmin, loading } = useAuth()

  useEffect(() => {
    if (loading) return

    if (isPublicPath(pathname ?? "")) {
      if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
        router.replace("/")
      }
      return
    }

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname ?? "/")}`)
      return
    }

    if (isAuthenticated && !isAdmin) {
      // Non-admin authenticated user on non-public path - AccessDenied handles display
      return
    }
  }, [pathname, isAuthenticated, isAdmin, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated && !isPublicPath(pathname ?? "")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isAuthenticated && !isAdmin && !isPublicPath(pathname ?? "")) {
    return <AccessDenied />
  }

  return <>{children}</>
}
