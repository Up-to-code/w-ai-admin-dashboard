"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAction } from "convex/react"
import { api } from "@/mock/convex-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    ArrowRight,
    Package,
    RefreshCw,
    ExternalLink,
    ShoppingBag,
    CheckCircle2,
    XCircle,
    Tag,
    Share2
} from "lucide-react"
import Link from "next/link"

export default function ProductDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const getProduct = useAction(api.salla.getProduct)
    const rawId = params?.id
    const productId = typeof rawId === "string" ? rawId : ""

    const [product, setProduct] = useState<any | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)

    useEffect(() => {
        if (!productId) {
            setIsLoading(false)
            return
        }
        let cancelled = false
        const fetchProduct = async () => {
            try {
                const data = await getProduct({ id: productId })
                if (cancelled) return
                setProduct(data)
                setSelectedImage(data.image)
            } catch (error) {
                console.error("Failed to fetch product:", error)
            } finally {
                if (cancelled) return
                setIsLoading(false)
            }
        }
        void fetchProduct()
        return () => {
            cancelled = true
        }
    }, [productId, getProduct])

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground">جاري تحميل تفاصيل المنتج...</p>
            </div>
        )
    }

    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
                <h2 className="text-xl font-bold mb-2">المنتج غير موجود</h2>
                <Button variant="outline" onClick={() => router.back()}>
                    عودة للمنتجات
                </Button>
            </div>
        )
    }

    const allImages = [product.image, ...(product.images?.map((img: any) => img.url) || [])].filter(Boolean)
    const uniqueImages = Array.from(new Set(allImages))

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <Button
                    variant="ghost"
                    className="gap-2 text-muted-foreground hover:text-foreground mb-4 pl-0"
                    onClick={() => router.back()}
                >
                    <ArrowRight className="h-4 w-4" />
                    عودة للمنتجات
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                {/* Images Section */}
                <div className="space-y-4">
                    <div className="aspect-square bg-muted rounded-2xl overflow-hidden border">
                        {selectedImage ? (
                            <img
                                src={selectedImage}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-20 w-20 text-muted-foreground/30" />
                            </div>
                        )}
                    </div>

                    {/* Thumbnails */}
                    {uniqueImages.length > 1 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {uniqueImages.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedImage(img)}
                                    className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${selectedImage === img
                                        ? 'border-[#004D3D]'
                                        : 'border-transparent hover:border-muted-foreground/30'
                                        }`}
                                >
                                    <img
                                        src={img}
                                        alt={`Product view ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details Section */}
                <div className="space-y-8">
                    {/* Basic Info */}
                    <div>
                        <div className="flex items-start justify-between gap-4">
                            <h1 className="text-3xl font-bold text-foreground leading-tight">
                                {product.name}
                            </h1>
                            <div className="flex gap-2">
                                <Button size="icon" variant="outline">
                                    <Share2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-3 text-muted-foreground">
                            <Badge variant="outline" className="font-mono">
                                {product.sku}
                            </Badge>
                            <span>•</span>
                            <span className={product.status === 'active' ? 'text-success' : 'text-muted-foreground'}>
                                {product.status === 'active' ? 'نشط' : 'غير نشط'}
                            </span>
                        </div>
                    </div>

                    {/* Price and Action */}
                    <div className="p-6 bg-muted/30 rounded-2xl border space-y-6">
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">السعر الحالي</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-[#004D3D]">
                                        {product.price}
                                    </span>
                                    <span className="text-lg text-muted-foreground">
                                        {product.currency}
                                    </span>
                                </div>
                                {product.originalPrice > product.price && (
                                    <p className="text-sm text-muted-foreground line-through mt-1">
                                        {product.originalPrice} {product.currency}
                                    </p>
                                )}
                            </div>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${product.inStock ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                }`}>
                                {product.inStock ? (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        متوفر ({product.stock})
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="h-4 w-4" />
                                        غير متوفر
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {product.url && (
                                <Button variant="outline" size="lg" className="w-full gap-2" asChild>
                                    <a href={product.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                        عرض في المتجر
                                    </a>
                                </Button>
                            )}
                            <Button size="lg" className="w-full gap-2 bg-[#004D3D] hover:bg-[#003D2D]" asChild>
                                <Link href={`/templates/new?salla_product_id=${product.id}`}>
                                    <ShoppingBag className="h-4 w-4" />
                                    استخدام في قالب
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Description */}
                    {product.description && (
                        <div className="space-y-3">
                            <h3 className="font-semibold text-lg">الوصف</h3>
                            <div
                                className="text-muted-foreground leading-relaxed prose prose-neutral max-w-none"
                                dangerouslySetInnerHTML={{ __html: product.description }}
                            />
                        </div>
                    )}

                    {/* Options / Variants */}
                    {product.options?.length > 0 && (
                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="font-semibold text-lg">خيارات المنتج</h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {product.options.map((option: any, idx: number) => (
                                    <div key={idx} className="p-4 rounded-xl border bg-card">
                                        <p className="font-medium text-sm mb-3 text-muted-foreground">{option.name}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {option.values?.map((val: any, vIdx: number) => (
                                                <Badge key={vIdx} variant="secondary" className="px-3 py-1">
                                                    {val.name || val.value}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function AlertCircle(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
    )
}
