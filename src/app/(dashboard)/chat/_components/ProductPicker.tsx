"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAction, useQuery } from "convex/react"
import { api } from "@/mock/convex-api"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ShoppingBag, Search, Loader2 } from "lucide-react"

interface Product {
    id: string
    name: string
    price: number
    currency: string
    image: string
    sku: string
    url?: string
}
interface FetchProductsResult {
    connected: boolean
    status?: "connected" | "disconnected" | "token_invalid" | "refresh_failed"
    products: Product[]
    pagination?: {
        currentPage?: number
        totalPages?: number
        totalItems?: number
    }
    tokenError?: boolean
    apiError?: boolean
    errorMessage?: string
}

interface ProductPickerProps {
    onSelect: (product: Product) => void
    trigger?: React.ReactNode
}

export function ProductPicker({ onSelect, trigger }: ProductPickerProps) {
    const fetchProducts = useAction(api.salla.fetchProducts)
    const connection = useQuery(api.salla.getConnection)
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [tokenError, setTokenError] = useState(false)
    const isConnected = Boolean(connection?.connected)

    const loadProducts = async (page = 1) => {
        if (connection === undefined) {
            return
        }
        if (!isConnected) {
            setHasLoaded(true)
            setProducts([])
            setTokenError(true)
            setLoadError("انتهت صلاحية ربط سلة. أعد الربط من صفحة التكاملات.")
            return
        }
        setIsLoading(true)
        try {
            const result = await fetchProducts({ page }) as FetchProductsResult
            if (result.connected) {
                if (page === 1) {
                    setProducts(result.products)
                } else {
                    setProducts(prev => [...prev, ...result.products])
                }
                setCurrentPage(page)
                setTotalItems(result.pagination?.totalItems || 0)
                setLoadError(result.errorMessage || null)
                setTokenError(false)
            } else {
                setLoadError(result.errorMessage || "تعذر جلب منتجات سلة حالياً.")
                setTokenError(Boolean(result.tokenError))
            }
            setHasLoaded(true)
        } catch (error) {
            console.error("Failed to load products", error)
            setLoadError("حدث خطأ أثناء تحميل المنتجات.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)
        if (open && !hasLoaded && connection !== undefined) loadProducts(1)
    }

    useEffect(() => {
        if (isOpen && !hasLoaded && connection !== undefined) {
            void loadProducts(1)
        }
        // loadProducts intentionally omitted to avoid recreating effect on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, hasLoaded, connection])

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-[#54656f]">
                        <ShoppingBag className="h-6 w-6" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] h-[80vh] flex flex-col p-0 gap-0 bg-[#efeae2] dark:bg-[#0b141a]">
                <DialogHeader className="p-4 bg-[#f0f2f5] dark:bg-[#202c33] shrink-0">
                    <DialogTitle>اختر منتج من سلة</DialogTitle>
                    <DialogDescription>اختر منتجاً لإرساله مباشرة داخل المحادثة.</DialogDescription>
                </DialogHeader>

                {/* Search Bar Placeholder */}
                <div className="p-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-border/10">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="بحث عن منتج..." className="pr-10 h-9" />
                    </div>
                </div>

                <ScrollArea className="flex-1 p-2">
                    {loadError && !tokenError && (
                        <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                            {loadError}
                        </div>
                    )}
                    {tokenError && (
                        <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-300 space-y-2">
                            <p>{loadError || "انتهت صلاحية ربط سلة. أعد الربط من صفحة التكاملات."}</p>
                            <Link href="/integrations" className="inline-block">
                                <Button size="sm" className="h-7 bg-[#004D3D] hover:bg-[#003D2D] text-white">
                                    إعادة ربط سلة
                                </Button>
                            </Link>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                            <ShoppingBag className="h-10 w-10 mb-2 opacity-20" />
                            <p>لا توجد منتجات متاحة</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {products.map((product) => (
                                <div
                                    key={product.id}
                                    onClick={() => {
                                        onSelect(product)
                                        setIsOpen(false)
                                    }}
                                    className="bg-card rounded-xl overflow-hidden border border-border/10 cursor-pointer hover:border-primary transition-all group flex flex-col"
                                >
                                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                                        {product.image ? (
                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-muted-foreground/30 bg-muted/50">
                                                <ShoppingBag className="h-10 w-10" />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-xs font-medium">
                                            {product.sku}
                                        </div>
                                    </div>
                                    <div className="p-3 flex flex-col flex-1">
                                        <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-5 mb-auto" dir="rtl">{product.name}</h3>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/10">
                                            <span className="text-sm font-bold text-primary">{product.price} <span className="text-[10px] font-normal text-muted-foreground">{product.currency}</span></span>
                                            <Button size="sm" variant="ghost" className="h-7 w-7 rounded-full p-0">
                                                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination / Load More */}
                    {hasLoaded && (
                        <div className="p-4 flex justify-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadProducts(currentPage + 1)}
                                disabled={isLoading || tokenError || (products.length >= totalItems)}
                                className="w-full text-xs"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                ) : (
                                    "تحميل المزيد"
                                )}
                            </Button>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog >
    )
}
