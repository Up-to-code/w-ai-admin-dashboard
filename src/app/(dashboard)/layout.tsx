"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/mock/convex-api"
import type { Id } from "@/mock/dataModel"
import { WorkspaceProvider } from "@/contexts/WorkspaceContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Settings,
  LogOut,
  Search,
  Bell,
  Menu,
  FileText,
  Zap,
  Users,
  Package,
  Link2,
  Bot,
  UserCog,
  Store,
  Phone
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { DashboardHeaderProvider, useDashboardHeader } from "@/components/DashboardHeaderContext"
import { Toaster } from "sonner"
import { GlobalNotification } from "@/components/GlobalNotification"
import { Suspense } from "react"

const ALL_NUMBERS_SENTINEL = "__all__"

// Sidebar Content Component
function SidebarContent({ pathname }: { pathname: string }) {
  const { userId, logout } = useAuth()
  const { numbers, activePhoneNumberId, setActivePhoneNumberId } = useWorkspace()
  const router = useRouter()
  const user = useQuery(api.auth.getUser, userId ? { userId: userId as Id<"users"> } : "skip")

  const handleLogout = () => {
    logout()
    router.push("/login")
  }
  const menuItems = [
    { href: "/", icon: LayoutDashboard, label: "لوحة التحكم" },
    { href: "/chat", icon: MessageSquare, label: "المحادثات" },
    { href: "/customers", icon: Users, label: "العملاء" },
    { href: "/products", icon: Package, label: "المنتجات" },
    { href: "/campaigns", icon: Megaphone, label: "الحملات" },
    { href: "/templates", icon: FileText, label: "القوالب" },
    { href: "/templates/store", icon: Store, label: "متجر القوالب" },
    { href: "/workflows", icon: Zap, label: "الأتمتة" },
    { href: "/ai-settings", icon: Bot, label: "الذكاء الاصطناعي" },
    { href: "/users", icon: UserCog, label: "إدارة المستخدمين" },
    { href: "/integrations", icon: Link2, label: "التكاملات" },
    { href: "/settings", icon: Settings, label: "الإعدادات" },
  ]

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-4 border-b border-sidebar-border space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">الرقم النشط</p>
        {numbers.length === 0 ? (
          <div className="h-9 px-3 flex items-center gap-2 rounded-md border border-sidebar-border/70 bg-sidebar/60 text-sidebar-foreground text-xs" dir="ltr">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            لا يوجد رقم
          </div>
        ) : (
          <Select
            value={activePhoneNumberId ?? ALL_NUMBERS_SENTINEL}
            onValueChange={(value) =>
              setActivePhoneNumberId(value === ALL_NUMBERS_SENTINEL ? null : value)
            }
          >
            <SelectTrigger className="h-9 bg-sidebar/60 border-sidebar-border/70 text-sidebar-foreground text-xs">
              <SelectValue placeholder="اختر الرقم" />
            </SelectTrigger>
            <SelectContent>
              {numbers.length > 1 && (
                <SelectItem value={ALL_NUMBERS_SENTINEL}>
                  كل الأرقام
                </SelectItem>
              )}
              {numbers.map((n) => (
                <SelectItem key={n._id} value={n.businessNumberId} dir="ltr">
                  {n.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={active ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-3 h-10 rounded-lg ${active
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50 mb-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {(user?.name || user?.email || "م")[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name || "المستخدم"}
            </p>
            <p className="text-xs text-muted-foreground truncate" dir="ltr">
              {user?.email || userId?.slice(0, 8) || "—"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  )
}

function DashboardHeader({ pathname }: { pathname: string }) {
  const { content } = useDashboardHeader()

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 gap-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 border-l border-sidebar-border w-[min(320px,90vw)] sm:w-80">
            <SidebarContent pathname={pathname} />
          </SheetContent>
        </Sheet>

        {content ? (
          <div className="flex-1 min-w-0">{content}</div>
        ) : (
          <div className="relative max-w-md w-full hidden sm:block">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="البحث..." className="pe-10 ps-4 bg-background border-border text-start" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1 end-1 w-2 h-2 bg-destructive rounded-full" />
        </Button>
      </div>
    </header>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <WorkspaceProvider>
    <DashboardHeaderProvider>
      <div className="flex h-screen bg-background font-sans" dir="rtl">
        <aside className="hidden md:flex w-64 border-l border-sidebar-border flex-col">
          <SidebarContent pathname={pathname} />
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader pathname={pathname} />

          <main className="flex-1 overflow-auto bg-background">{children}</main>
        </div>

        {/* Global Notifications */}
        <Toaster position="top-right" expand={true} richColors visibleToasts={4} />
        <Suspense fallback={null}>
          <GlobalNotification />
        </Suspense>
      </div>
    </DashboardHeaderProvider>
    </WorkspaceProvider>
  )
}
