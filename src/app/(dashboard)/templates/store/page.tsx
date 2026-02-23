"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/mock/convex-api"
import { Id, Doc } from "@/mock/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  FileText,
  LayoutTemplate,
  ArrowRight,
  Search,
  Loader2,
  Trash2,
  Store,
  Eye,
  RefreshCw,
} from "lucide-react"
import { TemplatePreview } from "@/components/TemplatePreview"

function getBodyPreview(components: unknown[] | undefined): string {
  if (!components || !Array.isArray(components)) return ""
  const body = components.find((c) => (c as { type?: string })?.type === "BODY")
  const text = body && typeof body === "object" && "text" in body ? String((body as { text: string }).text) : ""
  return text.slice(0, 120) + (text.length > 120 ? "…" : "")
}

const TAG_LABELS: Record<string, string> = {
  welcome: "ترحيب",
  product: "منتج",
  marketing: "تسويق",
  offer: "عرض",
  customer: "عميل",
  list: "قائمة",
  order: "طلب",
  utility: "خدمي",
  appointment: "موعد",
  reminder: "تذكير",
  catalog: "كتالوج",
  cart: "سلة",
  gift: "هدية",
  thanks: "شكر",
  feedback: "تقييم",
  discount: "خصم",
  shipping: "شحن",
  survey: "استبيان",
  event: "حدث",
  invite: "دعوة",
  support: "دعم",
  contact: "تواصل",
  new: "جديد",
  sale: "تخفيض",
  payment: "دفع",
  loyalty: "ولاء",
  birthday: "عيد ميلاد",
}
function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag
}

function categoryLabel(category: string): string {
  switch (category) {
    case "MARKETING": return "تسويق"
    case "UTILITY": return "خدمي"
    case "AUTHENTICATION": return "توثيق"
    default: return category
  }
}

function languageLabel(lang: string): string {
  return lang === "ar" ? "عربي" : lang === "en" ? "إنجليزي" : lang.toUpperCase()
}

// Arabic display names and descriptions for e-commerce templates
const TEMPLATE_DISPLAY: Record<string, { name: string; description: string }> = {
  product_offer: { name: "عرض المنتج", description: "عرض منتج أو ترويجي مع متغير وزر رابط." },
  product_offers_list: { name: "قائمة عروض المنتجات", description: "قائمة عروض المنتجات مع زر عرض كل العروض." },
  order_confirmation: { name: "تأكيد الطلب", description: "تأكيد استلام الطلب مع أزرار تتبع والتواصل." },
  catalog_link: { name: "رابط الكتالوج", description: "رابط لتصفح الكتالوج واختيار المنتجات." },
  thank_you: { name: "شكراً لك", description: "رسالة شكر بعد الشراء مع زر تقييم الخدمة." },
  discount_code: { name: "كود الخصم", description: "إرسال كود خصم للعميل مع تاريخ الصلاحية." },
  shipping_update: { name: "تحديث الشحن", description: "تحديث حالة الشحن مع تاريخ التوصيل المتوقع." },
  feedback_request: { name: "طلب التقييم", description: "طلب تقييم التجربة مع أزرار رد سريع." },
  new_arrivals: { name: "وصل جديد", description: "إعلان وصول منتجات جديدة مع زر العرض." },
  flash_sale: { name: "تخفيض خاطف", description: "تخفيضات خاطفة مع كود أو رابط." },
  payment_reminder: { name: "تذكير الدفع", description: "تذكير بالدفع للطلب المعلق." },
  welcome_back: { name: "أهلاً بعودتك", description: "ترحيب بعودة العميل مع عروض خاصة." },
  customer_welcome: { name: "ترحيب العميل", description: "ترحيب بالعميل الجديد مع خصم ترحيبي." },
  product_recommendation: { name: "توصية منتج", description: "توصية منتج للعميل حسب اهتماماته." },
  gift_card: { name: "بطاقة هدية", description: "إرسال بطاقة أو كود هدية للعميل." },
  abandoned_cart: { name: "سلة مهجورة", description: "تذكير العميل بالسلة المهجورة مع رابط الإكمال." },
  product_back_in_stock: { name: "المنتج متوفر", description: "إبلاغ العميل بتوفر منتج كان نفد." },
  customer_birthday: { name: "عيد ميلاد العميل", description: "تهنئة العميل بعيد ميلاده مع خصم أو هدية." },
}
function templateDisplayName(name: string): string {
  return TEMPLATE_DISPLAY[name]?.name ?? name
}
function templateDisplayDescription(name: string, fallback: string | undefined): string {
  return TEMPLATE_DISPLAY[name]?.description ?? fallback ?? "—"
}

export default function TemplateStorePage() {
  const searchParams = useSearchParams()
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined)
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState("")
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [previewStoreTemplate, setPreviewStoreTemplate] = useState<Doc<"template_store"> | null>(null)
  const [isAutoSeeding, setIsAutoSeeding] = useState(false)
  const autoSeedDone = useRef(false)
  const [loadTimeout, setLoadTimeout] = useState(false)

  const addedParam = searchParams?.get("added") ?? null
  useEffect(() => {
    if (addedParam === "1") {
      setToast({ type: "success", message: "تم حفظ القالب في المتجر" })
      setTimeout(() => setToast(null), 3000)
      window.history.replaceState({}, "", "/templates/store")
    }
  }, [addedParam])

  const list = useQuery(api.templateStore.list, {
    tag: tagFilter ?? undefined,
    category: categoryFilter ?? undefined,
  }) as Doc<"template_store">[] | undefined
  const seedDefaults = useMutation(api.templateStore.seedDefaults)
  const remove = useMutation(api.templateStore.remove)

  // Show hint if Convex takes too long (likely not running)
  useEffect(() => {
    if (list !== undefined) return
    const t = setTimeout(() => setLoadTimeout(true), 6000)
    return () => clearTimeout(t)
  }, [list])

  // Auto-load default templates when store is empty (first visit or after refresh)
  useEffect(() => {
    if (autoSeedDone.current || list === undefined) return
    if (list.length > 0) {
      setIsAutoSeeding(false)
      return
    }
    autoSeedDone.current = true
    setIsAutoSeeding(true)
    seedDefaults({})
      .then((result) => {
        if (result.seeded > 0) {
          setToast({ type: "success", message: result.message ?? "تم تحميل القوالب الافتراضية" })
          setTimeout(() => setToast(null), 3000)
        }
        setIsAutoSeeding(false)
      })
      .catch((e) => {
        console.error("Auto-seed failed:", e)
        setToast({ type: "error", message: "فشل التحميل التلقائي. شغّل: npx convex dev ثم حدّث الصفحة." })
        setTimeout(() => setToast(null), 5000)
        autoSeedDone.current = false
        setIsAutoSeeding(false)
      })
  }, [list, seedDefaults])

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSeedDefaults = async () => {
    setSeeding(true)
    try {
      const result = await seedDefaults({})
      showToast("success", result.message ?? "تم تحميل القوالب الافتراضية")
    } catch (e) {
      console.error(e)
      showToast("error", e instanceof Error ? e.message : "فشل تحميل القوالب الافتراضية")
    } finally {
      setSeeding(false)
    }
  }

  const handleRefreshDefaults = async () => {
    setSeeding(true)
    try {
      const result = await seedDefaults({ force: true })
      const count = result?.seeded ?? 0
      if (count > 0) {
        const msg =
            count < 10
            ? `تم تحميل ${count} قوالب. لتحميل قوالب المتجر الكاملة شغّل: npx convex dev ثم حدّث مرة أخرى.`
            : (result?.message ?? `تم تحميل ${count} قوالب افتراضية.`)
        showToast("success", msg)
        // Convex reactivity updates list automatically; no reload needed
      } else {
        showToast("error", "لم يُحمّل أي قالب. شغّل في الطرفية: npx convex dev ثم جرّب التحديث مرة أخرى.")
      }
    } catch (e) {
      console.error(e)
      showToast("error", e instanceof Error ? e.message : "فشل تحديث القوالب الافتراضية")
    } finally {
      setSeeding(false)
    }
  }

  const handleRemove = async (id: Id<"template_store">) => {
    try {
      await remove({ id })
      showToast("success", "تم حذف القالب من المتجر")
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "فشل الحذف")
    }
  }

  const storeTemplates = (list ?? []) as Array<{
    _id: Id<"template_store">
    name: string
    description?: string
    category: string
    language: string
    tags?: string[]
    components?: unknown[]
    isDefault?: boolean
  }>

  const filtered = storeTemplates.filter((t) => {
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
    return matchSearch
  })

  const allTags: string[] = Array.from(
    new Set(storeTemplates.flatMap((t) => t.tags ?? []))
  ).sort()
  const allCategories: string[] = Array.from(
    new Set(storeTemplates.map((t) => t.category))
  ).sort()

  const OLD_TEMPLATE_NAMES = ["welcome_assistant", "getting_started", "appointment_reminder", "event_invite", "support_contact"]
  const hasOldDefaults =
    list &&
    list.length > 0 &&
    (list.length < 10 ||
      list.some((t) => t.language === "en") ||
      list.some((t) => OLD_TEMPLATE_NAMES.includes(t.name)))

  return (
    <div className="space-y-8 p-6 sm:p-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      {hasOldDefaults && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
          <p className="text-sm text-amber-900 dark:text-amber-100 flex-1 font-medium">
            يوجد تحديث: قوالب عربية جديدة متاحة. اضغط &quot;تحديث القوالب الافتراضية&quot; لتحميلها.
          </p>
          <Button
            size="sm"
            className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-500 shrink-0 font-medium"
            onClick={handleRefreshDefaults}
            disabled={seeding}
          >
            <RefreshCw className={`h-4 w-4 ml-1 ${seeding ? "animate-spin" : ""}`} />
            تحديث الآن
          </Button>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Store className="h-8 w-8 text-primary" />
            متجر القوالب
          </h1>
          <p className="text-muted-foreground text-lg">
            قوالب إلكترونية جاهزة للعملاء والمنتجات والطلبات
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={handleRefreshDefaults}
            disabled={seeding}
          >
            <RefreshCw className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`} />
            تحديث القوالب الافتراضية
          </Button>
          <Link href="/templates">
            <Button variant="outline" className="gap-2 rounded-xl">
              <FileText className="h-4 w-4" />
              قوالب Meta
            </Button>
          </Link>
          <Link href="/templates/new">
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-none rounded-xl px-6">
              قالب جديد
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-stretch sm:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md w-full">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث في المتجر..."
            className="pe-10 ps-4 bg-background dark:bg-muted/30 border border-input rounded-xl h-11 focus-visible:ring-2 focus-visible:ring-primary/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            className="h-11 min-w-[140px] rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            value={categoryFilter ?? ""}
            onChange={(e) =>
              setCategoryFilter(e.target.value ? e.target.value : undefined)
            }
          >
            <option value="">كل التصنيفات</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={tagFilter === undefined ? "secondary" : "outline"}
              size="sm"
              className="rounded-lg"
              onClick={() => setTagFilter(undefined)}
            >
              الكل
            </Button>
            {allTags.map((tag) => (
              <Button
                key={tag}
                variant={tagFilter === tag ? "secondary" : "outline"}
                size="sm"
                className="rounded-lg"
                onClick={() => setTagFilter(tag)}
              >
                {tagLabel(tag)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {list === undefined && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/5 rounded-3xl border border-dashed border-muted-foreground/20">
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">جاري تحميل المتجر...</p>
          {loadTimeout && (
            <p className="text-sm text-amber-600 dark:text-amber-500 mt-4 max-w-sm">
              إذا استمر التأخير، شغّل في الطرفية: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">npx convex dev</code>
            </p>
          )}
        </div>
      )}

      {/* Auto-seeding in progress (empty store, seeding) */}
      {list && list.length === 0 && isAutoSeeding && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/5 rounded-3xl border border-dashed border-muted-foreground/20">
          <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">جاري تحميل القوالب الافتراضية...</p>
          <p className="text-sm text-muted-foreground/80 mt-1">ستظهر القوالب تلقائياً خلال ثوانٍ</p>
        </div>
      )}

      {/* Empty state + Seed (empty store, not auto-seeding) */}
      {list && list.length === 0 && !isAutoSeeding && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/5 rounded-3xl border border-dashed border-muted-foreground/20">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <LayoutTemplate className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">لا توجد قوالب في المتجر</h3>
          <p className="text-muted-foreground max-w-sm mb-8">
            حمّل قوالب المتجر الإلكتروني (عملاء، منتجات، طلبات، هدايا) أو أنشئ قالباً جديداً.
          </p>
          <Button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="gap-2 rounded-xl"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LayoutTemplate className="h-4 w-4" />
            )}
            تحميل القوالب الافتراضية
          </Button>
        </div>
      )}

      {/* No search results */}
      {list && list.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 rounded-2xl bg-muted/30 border border-dashed border-muted-foreground/20">
          <p className="text-muted-foreground">لا توجد نتائج تطابق البحث. جرّب تغيير الكلمات أو التصفية.</p>
        </div>
      )}

      {list && list.length > 0 && filtered.length > 0 && (
        <div className="relative">
          {seeding && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[2px] min-h-[200px]">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/90 dark:bg-muted/80 px-6 py-4 shadow-lg">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-medium text-foreground">جاري تحديث القوالب...</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((t) => (
            <Card
              key={t._id}
              className="group overflow-hidden rounded-2xl border-none ring-1 ring-border/50 shadow-none hover:shadow-lg hover:ring-primary/20 transition-all duration-300"
            >
              <CardHeader className="pb-2 pt-5 px-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                      <LayoutTemplate className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold line-clamp-1">
                        {templateDisplayName(t.name)}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 px-1.5 font-normal bg-muted/50 border-0 text-muted-foreground"
                        >
                          {categoryLabel(t.category)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {languageLabel(t.language)}
                        </span>
                        {t.isDefault && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            افتراضي
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pt-2 pb-5">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                  {templateDisplayDescription(t.name, t.description)}
                </p>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 mb-4">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">نص القالب</p>
                  <p className="text-xs text-foreground/80 line-clamp-3 leading-relaxed">
                    {getBodyPreview(t.components) || "—"}
                  </p>
                </div>
                {t.tags && t.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {t.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        {tagLabel(tag)}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-lg shrink-0"
                    onClick={() => setPreviewStoreTemplate(t)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    معاينة
                  </Button>
                  <Link href={`/templates/new?fromStore=${t._id}`} className="min-w-0">
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                    >
                      استخدام القالب
                      <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Button>
                  </Link>
                  {!t.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(t._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
      )}

      {/* Preview Modal – WhatsApp-style */}
      <Dialog open={!!previewStoreTemplate} onOpenChange={(open) => !open && setPreviewStoreTemplate(null)}>
        <DialogContent className="max-w-[360px] p-4 sm:p-6 overflow-y-auto bg-background border border-border shadow-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>معاينة قالب المتجر</DialogTitle>
            <DialogDescription>عرض شكل القالب قبل استخدامه أو إرساله للمراجعة.</DialogDescription>
          </DialogHeader>
          {previewStoreTemplate && (
            <>
              <p className="text-sm font-medium text-center text-muted-foreground mb-3">معاينة القالب</p>
              <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-900 border-[14px] rounded-[2.5rem] h-[560px] w-[280px] sm:w-[300px] shadow-xl flex flex-col flex-shrink-0">
                <div className="w-[120px] sm:w-[130px] h-[14px] bg-gray-800 top-0 rounded-b-[0.75rem] left-1/2 -translate-x-1/2 absolute z-20" />
                <div className="bg-[#008069] dark:bg-[#202c33] p-3 pt-7 flex items-center gap-2 text-white z-10 rounded-t-[2rem]">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {templateDisplayName(previewStoreTemplate.name)}
                    </div>
                    <div className="text-[10px] opacity-80">حساب أعمال</div>
                  </div>
                </div>
                <div className="flex-1 p-3 overflow-y-auto bg-[#E5DDD5] dark:bg-[#111b21] relative rounded-b-[2rem]">
                  <TemplatePreview template={{ components: previewStoreTemplate.components }} />
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-center items-stretch sm:items-center mt-4 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setPreviewStoreTemplate(null)} className="rounded-xl order-2 sm:order-1">
                  إغلاق
                </Button>
                <Link href={`/templates/new?fromStore=${previewStoreTemplate._id}`} onClick={() => setPreviewStoreTemplate(null)} className="order-1 sm:order-2 sm:flex-1 sm:max-w-[280px]">
                  <Button className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">
                    استخدام القالب وإرساله للمراجعة
                  </Button>
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium z-50 ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-destructive text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
