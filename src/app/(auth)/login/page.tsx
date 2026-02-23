"use client"

import { useState, Suspense } from "react"
import { useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Mail, Lock, Loader2, MessageSquare } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loginMutation = useMutation(api.auth.login)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail || !password.trim()) {
        throw new Error("يرجى ملء جميع الحقول")
      }

      const userId = await loginMutation({ email: normalizedEmail, password })
      if (userId) {
        const id = String(userId)
        login(id, id)
        // Defer redirect so auth state and storage are committed before navigation
        setTimeout(() => router.push("/"), 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center pb-8">
        <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
          <MessageSquare className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">تسجيل الدخول</CardTitle>
        <CardDescription className="text-muted-foreground">
          أدخل بريدك الإلكتروني وكلمة المرور للدخول إلى لوحة التحكم
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-right">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="example@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pr-10 text-end"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-right">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 text-end"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-xl text-center">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "تسجيل الدخول"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              إنشاء حساب
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
      <Suspense
        fallback={
          <div className="flex items-center justify-center">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
      <footer className="mt-8 flex items-center gap-4 text-sm text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground underline">
          سياسة الخصوصية
        </Link>
        <Link href="/terms" className="hover:text-foreground underline">
          الشروط والأحكام
        </Link>
      </footer>
    </div>
  )
}
