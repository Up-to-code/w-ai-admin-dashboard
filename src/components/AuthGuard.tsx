"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { AccessDenied } from "@/components/AccessDenied"
import { Loader2 } from "lucide-react"

const PUBLIC_PATHS = ["/login", "/register", "/terms", "/privacy", "/error"]
const AGENT_ALLOWED_PATHS = ["/", "/chat", "/customers", "/products"]

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))
}

function isAgentAllowedPath(path: string): boolean {
  return AGENT_ALLOWED_PATHS.some((p) => path === p || path.startsWith(`${p}/`))
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isAdmin, isAgent, loading } = useAuth()
  const canAccessApp = isAdmin || isAgent

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

    if (isAuthenticated && !canAccessApp) {
      return
    }

    if (isAuthenticated && isAgent && !isAdmin && !isAgentAllowedPath(pathname ?? "")) {
      router.replace("/")
      return
    }
  }, [pathname, isAuthenticated, isAdmin, isAgent, canAccessApp, loading, router])

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

  if (isAuthenticated && !canAccessApp && !isPublicPath(pathname ?? "")) {
    return <AccessDenied />
  }

  if (isAuthenticated && isAgent && !isAdmin && !isAgentAllowedPath(pathname ?? "")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
