"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { track404Error } from "@/lib/error-handling"

export function ClientSide404Handler() {
  const pathname = usePathname()

  useEffect(() => {
    // Track 404 errors for client-side navigation
    if (pathname && !isValidRoute(pathname)) {
      track404Error(pathname, document.referrer)
    }
  }, [pathname])

  return null
}

// Helper function from error-handling.ts
function isValidRoute(pathname: string): boolean {
  const validRoutes = [
    "/",
    "/login",
    "/register",
    "/chat",
    "/campaigns",
    "/storage",
    "/ai-settings",
    "/integrations",
    "/settings",
  ]

  return validRoutes.includes(pathname)
}