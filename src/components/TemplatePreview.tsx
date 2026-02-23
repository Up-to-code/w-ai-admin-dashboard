"use client"

import { Image as ImageIcon, Video, FileText, Link2, Phone, Copy, ShoppingBag } from "lucide-react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface TemplatePreviewProps {
  template: {
    components?: any[]
    content?: string
  } | null
  className?: string
}

function detectTemplateType(components: any[]): "STANDARD" | "CAROUSEL" | "PRODUCT_CAROUSEL" | "CATALOG" {
  if (components.find((c: any) => c.type === "PRODUCT_CAROUSEL" || c.type === "product_carousel")) return "PRODUCT_CAROUSEL"
  if (components.find((c: any) => c.type === "CATALOG" || c.type === "catalog")) return "CATALOG"
  if (components.find((c: any) => c.type === "CAROUSEL" || c.type === "carousel")) return "CAROUSEL"
  return "STANDARD"
}

function StandardPreview({ components }: { components: any[] }) {
  const headerComp = components.find((c: any) => c.type === "HEADER" || c.type === "header")
  const bodyComp = components.find((c: any) => c.type === "BODY" || c.type === "body")
  const footerComp = components.find((c: any) => c.type === "FOOTER" || c.type === "footer")
  const buttonsComp = components.find((c: any) => c.type === "BUTTONS" || c.type === "buttons")

  return (
    <div className="bg-white dark:bg-[#202c33] p-3 rounded-lg rounded-tl-none border border-border/50 mb-2">
      {/* Header */}
      {headerComp && (
        <div className="mb-3">
          {headerComp.format === "TEXT" && (
            <p className="font-bold text-sm text-gray-800 dark:text-gray-100">
              {headerComp.text || headerComp.example?.header_text?.[0] || "عنوان الرسالة"}
            </p>
          )}
          {(headerComp.format === "IMAGE" || headerComp.format === "VIDEO") && (
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-32 flex items-center justify-center overflow-hidden">
              {headerComp.format === "VIDEO" ? (
                <Video className="h-8 w-8 text-muted-foreground" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
          )}
          {headerComp.format === "DOCUMENT" && (
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3 flex items-center gap-2">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">مستند</span>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
        {bodyComp?.text || "نص الرسالة..."}
      </p>

      {/* Footer */}
      {footerComp?.text && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
          {footerComp.text}
        </p>
      )}

      {/* Buttons */}
      {buttonsComp?.buttons && buttonsComp.buttons.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 mt-3 pt-3 space-y-1">
          {buttonsComp.buttons.map((btn: any, i: number) => (
            <div 
              key={i} 
              className="text-center text-sm text-[#00a884] font-medium py-1.5 flex items-center justify-center gap-2"
            >
              {btn.type === "URL" && <Link2 className="h-3 w-3" />}
              {btn.type === "PHONE_NUMBER" && <Phone className="h-3 w-3" />}
              {btn.type === "COPY_CODE" && <Copy className="h-3 w-3" />}
              {btn.type === "CATALOG" && <ShoppingBag className="h-3 w-3" />}
              <span>{btn.text || "زر"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-2">
        {format(new Date(), "p", { locale: ar })}
      </div>
    </div>
  )
}

function CarouselPreview({ components }: { components: any[] }) {
  const bodyComp = components.find((c: any) => c.type === "BODY" || c.type === "body")
  const carouselComp = components.find((c: any) => c.type === "CAROUSEL" || c.type === "carousel")
  const cards = carouselComp?.cards || []

  return (
    <div className="space-y-2">
      {/* Main Body */}
      <div className="bg-white dark:bg-[#202c33] p-3 rounded-lg rounded-tl-none border border-border/50 mb-2">
        <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
          {bodyComp?.text || "مقدمة الكاروسيل..."}
        </p>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-2">
          {format(new Date(), "p", { locale: ar })}
        </div>
      </div>

      {/* Carousel Cards */}
      {cards.length > 0 && (
        <div className="flex overflow-x-auto gap-3 pb-2 -mx-3 px-3 scrollbar-hide">
          {cards.map((card: any, i: number) => {
            const cardHeader = card.components?.find((c: any) => c.type === "HEADER" || c.type === "header")
            const cardBody = card.components?.find((c: any) => c.type === "BODY" || c.type === "body")
            const cardButtons = card.components?.find((c: any) => c.type === "BUTTONS" || c.type === "buttons")

            return (
              <div 
                key={i} 
                className="bg-white dark:bg-[#202c33] rounded-lg border border-border/50 min-w-[200px] max-w-[200px] overflow-hidden shrink-0"
              >
                {/* Card Header */}
                {cardHeader && (
                  <div className="h-24 bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    {cardHeader.format === "VIDEO" ? (
                      <Video className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                )}

                {/* Card Body */}
                <div className="p-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {cardBody?.text || "وصف البطاقة..."}
                  </p>

                  {/* Card Buttons */}
                  {cardButtons?.buttons && cardButtons.buttons.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {cardButtons.buttons.map((btn: any, bI: number) => (
                        <div 
                          key={bI} 
                          className="bg-gray-50 dark:bg-gray-800 p-1.5 text-center text-xs text-[#00a884] rounded border border-gray-200 dark:border-gray-700"
                        >
                          {btn.text || "زر"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProductCarouselPreview({ components }: { components: any[] }) {
  const bodyComp = components.find((c: any) => c.type === "BODY" || c.type === "body")
  const productCarouselComp = components.find((c: any) => 
    c.type === "PRODUCT_CAROUSEL" || c.type === "product_carousel"
  )
  const products = productCarouselComp?.products || []

  return (
    <div className="space-y-2">
      {/* Main Body */}
      <div className="bg-white dark:bg-[#202c33] p-3 rounded-lg rounded-tl-none border border-border/50 mb-2">
        <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
          {bodyComp?.text || "رسالة المنتجات..."}
        </p>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-2">
          {format(new Date(), "p", { locale: ar })}
        </div>
      </div>

      {/* Product Cards */}
      {products.length > 0 ? (
        <div className="flex overflow-x-auto gap-3 pb-2 -mx-3 px-3 scrollbar-hide">
          {products.map((product: any, i: number) => (
            <div 
              key={i} 
              className="bg-white dark:bg-[#202c33] rounded-lg shadow-sm min-w-[200px] max-w-[200px] overflow-hidden shrink-0"
            >
              {/* Product Image */}
              <div className="h-24 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>

              {/* Product Info */}
              <div className="p-2">
                <p className="text-xs text-muted-foreground font-mono mb-1">
                  {product.product_retailer_id || product.productId || "Product ID"}
                </p>
                {product.body && (
                  <p className="text-sm text-gray-800 dark:text-gray-100 mb-2">
                    {product.body}
                  </p>
                )}
                {product.button && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-1.5 text-center text-xs text-[#00a884] rounded border border-gray-200 dark:border-gray-700">
                    {product.button.type === "VIEW" ? "عرض" : "رابط"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground text-sm p-4 bg-white dark:bg-[#202c33] rounded-lg">
          اختر المنتجات للمعاينة
        </div>
      )}
    </div>
  )
}

function CatalogPreview({ components }: { components: any[] }) {
  const headerComp = components.find((c: any) => c.type === "HEADER" || c.type === "header")
  const bodyComp = components.find((c: any) => c.type === "BODY" || c.type === "body")
  const footerComp = components.find((c: any) => c.type === "FOOTER" || c.type === "footer")

  return (
    <div className="bg-white dark:bg-[#202c33] p-3 rounded-lg rounded-tl-none border border-border/50 mb-2">
      {/* Header Image */}
      {headerComp && headerComp.format === "IMAGE" && (
        <div className="mb-3">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-32 flex items-center justify-center overflow-hidden">
            {headerComp.example?.header_handle ? (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
        {bodyComp?.text || "عرض كتالوجنا..."}
      </p>

      {/* Footer */}
      {footerComp?.text && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
          {footerComp.text}
        </p>
      )}

      {/* Catalog Button */}
      <div className="border-t border-gray-200 dark:border-gray-700 mt-3 pt-3">
        <div className="text-center text-sm text-[#00a884] font-medium py-1.5 flex items-center justify-center gap-2">
          <ShoppingBag className="h-3 w-3" />
          <span>عرض الكتالوج</span>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-2">
        {format(new Date(), "p", { locale: ar })}
      </div>
    </div>
  )
}

export function TemplatePreview({ template, className }: TemplatePreviewProps) {
  if (!template) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-xs">
        اختر قالباً للمعاينة
      </div>
    )
  }

  const components = template.components || []
  const type = detectTemplateType(components)

  return (
    <div className={cn("w-full", className)}>
      {type === "STANDARD" && <StandardPreview components={components} />}
      {type === "CAROUSEL" && <CarouselPreview components={components} />}
      {type === "PRODUCT_CAROUSEL" && <ProductCarouselPreview components={components} />}
      {type === "CATALOG" && <CatalogPreview components={components} />}
    </div>
  )
}
