"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useAction } from "convex/react";
import { api } from "@/mock/convex-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Package, RefreshCw, Link2, ShoppingBag, Info, AlertCircle } from "lucide-react";
  

export function SallaProductsTab() {
  const connection = useQuery(api.salla.getConnection);
  const fetchProducts = useAction(api.salla.fetchProducts);

  type Product = {
    id: string | number;
    name: string;
    sku: string;
    price: number;
    originalPrice: number;
    currency: string;
    stock: number;
    image?: string | null;
    inStock: boolean;
    description?: string;
    url?: string;
    status?: string;
    options?: unknown[];
    images?: unknown[];
  };
  type FetchResult = {
    connected: boolean;
    status?: "connected" | "disconnected" | "token_invalid" | "refresh_failed";
    products: Product[];
    pagination?: {
      currentPage?: number;
      totalPages?: number;
      totalItems?: number;
    };
    tokenError?: boolean;
    apiError?: boolean;
    errorMessage?: string;
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isConnected = Boolean(connection?.connected);
  const connectionStatus = connection?.status;

  const handleFetchProducts = useCallback(async (initial?: boolean) => {
    if (initial) {
      setIsLoading(true);
      try {
        const result = await fetchProducts({ page: 1, perPage: 50 }) as FetchResult;
        if (result.connected) {
          setProducts(result.products);
          setPage(result.pagination?.currentPage || 1);
          setTotalPages(result.pagination?.totalPages || 1);
          setLoadError(result.errorMessage || null);
          setTokenError(false);
        } else {
          setLoadError(result.errorMessage || "تعذر جلب المنتجات من سلة.");
          setTokenError(Boolean(result.tokenError));
        }
        setHasFetched(true);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    if (isLoadingMore || page >= totalPages) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await fetchProducts({ page: nextPage, perPage: 50 }) as FetchResult;
      if (result.connected) {
        setProducts((prev) => [...prev, ...result.products]);
        setPage(result.pagination?.currentPage || nextPage);
        setTotalPages(result.pagination?.totalPages || totalPages);
        if (result.errorMessage) setLoadError(result.errorMessage);
        setTokenError(false);
      } else if (result.errorMessage) {
        setLoadError(result.errorMessage);
        setTokenError(Boolean(result.tokenError));
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchProducts, isLoadingMore, page, totalPages]);

  useEffect(() => {
    if (isConnected && !hasFetched && !isLoading) {
      handleFetchProducts(true);
    }
  }, [isConnected, hasFetched, isLoading, handleFetchProducts]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasFetched || tokenError) return;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && !isLoading && !isLoadingMore && search.trim() === "") {
        handleFetchProducts(false);
      }
    }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasFetched, isLoading, isLoadingMore, search, page, tokenError, totalPages, handleFetchProducts]);

  const filteredProducts = products.filter((p) => p.name?.includes(search) || p.sku?.includes(search));

  if (connection === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin ml-2" />
        جاري تحميل حالة الربط...
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <div className="w-16 h-16 rounded-full bg-[#004D3D]/10 flex items-center justify-center mb-4">
          <ShoppingBag className="h-8 w-8 text-[#004D3D]" />
        </div>
        <h2 className="text-lg font-bold mb-2">
          {connectionStatus === "token_invalid" || connectionStatus === "refresh_failed"
            ? "انتهت صلاحية ربط سلة"
            : "لم يتم ربط متجر سلة"}
        </h2>
        <p className="text-muted-foreground mb-4 max-w-sm">
          {connectionStatus === "token_invalid" || connectionStatus === "refresh_failed"
            ? "رمز سلة غير صالح حالياً. أعد الربط من صفحة التكاملات."
            : "قم بربط متجرك على سلة لعرض المنتجات"}
        </p>
        <Link href="/integrations">
          <Button className="gap-2 bg-[#004D3D] hover:bg-[#003D2D]">
            <Link2 className="h-4 w-4" />
            إعادة ربط سلة
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">منتجات سلة</h2>
          <p className="text-muted-foreground text-sm">{connection?.storeName || "متجر سلة"} • {products.length} منتج</p>
        </div>
        <Button variant="outline" onClick={() => handleFetchProducts(true)} disabled={isLoading || tokenError} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث بالاسم أو SKU..." className="pr-10 h-11" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loadError && !tokenError && (
        <Card className="border-amber-300/60 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="py-3 px-4 flex items-start gap-2 text-amber-900 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">{loadError}</p>
          </CardContent>
        </Card>
      )}

      {tokenError && (
        <Card className="border-amber-300/60 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="py-3 px-4 flex items-start justify-between gap-3 text-amber-900 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm">{loadError || "انتهت صلاحية ربط سلة. أعد الربط للمتابعة."}</p>
            </div>
            <Link href="/integrations">
              <Button size="sm" className="bg-[#004D3D] hover:bg-[#003D2D]">
                إعادة الربط
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {filteredProducts.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">لا توجد منتجات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="group cursor-pointer rounded-xl border bg-card text-card-foreground transition-all hover:border-[#004D3D]/50"
              onClick={() => setSelectedProduct(product)}
            >
              <div className="aspect-square bg-muted rounded-t-xl overflow-hidden relative">
                {product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
                {!product.inStock && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <Badge variant="destructive">نفد من المخزون</Badge>
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium text-sm line-clamp-1 mb-1">{product.name}</h3>
              </div>
            </div>
          ))}
          <div ref={sentinelRef} />
        </div>
      )}

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>نظرة سريعة</DialogTitle>
            <DialogDescription>تفاصيل المنتج الأساسية</DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                {selectedProduct.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-16 w-16 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <h2 className="text-lg font-bold line-clamp-2">{selectedProduct.name}</h2>
              <Link href={`/products/${selectedProduct.id}`} className="w-full">
                <Button className="w-full gap-2 bg-[#004D3D] hover:bg-[#003D2D]">
                  <Info className="h-4 w-4" />
                  عرض التفاصيل الكاملة
                </Button>
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
