"use client"

import { Component, ErrorInfo, ReactNode, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authStorage } from "@/lib/auth-storage"
import { Loader2 } from "lucide-react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/** Catches Convex auth errors (e.g. invalid userId from corrupted localStorage) and recovers by clearing auth. */
export class AuthErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[AuthErrorBoundary]", error.message, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const msg = this.state.error.message || ""
      const isInvalidUserId =
        msg.includes("ArgumentValidationError") &&
        msg.includes("does not match the table name") &&
        (msg.includes("v.id(\"users\")") || msg.includes(".userId"))

      if (isInvalidUserId) {
        return <AuthRecoveryFallback onRecovered={this.reset} />
      }
      throw this.state.error
    }
    return this.props.children
  }
}

function AuthRecoveryFallback({ onRecovered }: { onRecovered: () => void }) {
  const router = useRouter()

  useEffect(() => {
    authStorage.clearAuth()
    router.push("/login")
    onRecovered()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8" dir="rtl">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-foreground font-medium">جاري إعادة التوجيه...</p>
      <p className="mt-2 text-sm text-muted-foreground">تم مسح بيانات تسجيل الدخول غير الصالحة</p>
    </div>
  )
}
