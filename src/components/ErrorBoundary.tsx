"use client"

import { useEffect, Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { track404Error } from "@/lib/error-handling"

interface ErrorBoundaryProps {
  children: React.ReactNode
}

function ErrorBoundaryInner({ children }: ErrorBoundaryProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Client-side error:", event.error)
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason)
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [pathname, searchParams])

  return <>{children}</>
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return (
    <Suspense fallback={null}>
      <ErrorBoundaryInner>{children}</ErrorBoundaryInner>
    </Suspense>
  )
}

// Component to handle 404 errors in client-side routing
function ClientSide404HandlerInner() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname && !isValidRoute(pathname)) {
      track404Error(pathname, document.referrer)
    }
  }, [pathname])

  return null
}

export function ClientSide404Handler() {
  return (
    <Suspense fallback={null}>
      <ClientSide404HandlerInner />
    </Suspense>
  )
}

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